import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import {
  cardChargeSchema,
  transactionSchema,
  type CardChargeInput,
  type TransactionInput,
} from '@/lib/validations';
import type { CardPaymentArgs } from '@/services/cards.service';
import { todayISO } from '@/utils/date';
import type {
  Category,
  CreditCardWithBalance,
  Currency,
  SavingsAccount,
  TransactionType,
  TransactionWithCategory,
} from '@/types/models';

type Kind = TransactionType | 'CARD_CHARGE_USD' | 'CARD_PAYMENT';

export type TransactionSubmit =
  | { kind: 'transaction'; input: TransactionInput }
  | { kind: 'cardChargeUsd'; cardId: string; input: CardChargeInput }
  | { kind: 'cardPayment'; cardId: string; cardName: string; args: CardPaymentArgs };

interface TransactionFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (submit: TransactionSubmit) => Promise<void>;
  categories: Category[];
  creditCards: CreditCardWithBalance[];
  savingsAccounts: Pick<SavingsAccount, 'id' | 'name'>[];
  initial?: TransactionWithCategory | null;
  defaultType?: TransactionType;
}

const KIND_OPTIONS: { value: Kind; label: string }[] = [
  { value: 'EXPENSE', label: 'Gasto' },
  { value: 'INCOME', label: 'Ingreso' },
  { value: 'SAVING', label: 'Ahorro' },
  { value: 'CARD_CHARGE_USD', label: 'Compra con tarjeta (dólares)' },
  { value: 'CARD_PAYMENT', label: 'Pago de tarjeta' },
];

export function TransactionForm({
  open,
  onClose,
  onSubmit,
  categories,
  creditCards,
  savingsAccounts,
  initial,
  defaultType = 'EXPENSE',
}: TransactionFormProps) {
  const [kind, setKind] = useState<Kind>(defaultType);
  const [amount, setAmount] = useState('');
  const [amountHnl, setAmountHnl] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [cardId, setCardId] = useState('');
  const [savingsId, setSavingsId] = useState('');
  const [payCurrency, setPayCurrency] = useState<Currency>('HNL');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isEditing = !!initial;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setKind(initial?.type ?? defaultType);
    setAmount(initial?.amount != null ? String(initial.amount) : '');
    setAmountHnl('');
    setCategoryId(initial?.category_id ?? '');
    setCardId(initial?.credit_card_id ?? '');
    setSavingsId(initial?.savings_account_id ?? '');
    setPayCurrency('HNL');
    setDescription(initial?.description ?? '');
    setDate(initial?.transaction_date ?? todayISO());
  }, [open, initial, defaultType]);

  const kindOptions = isEditing
    ? KIND_OPTIONS.filter((k) => ['EXPENSE', 'INCOME', 'SAVING'].includes(k.value))
    : KIND_OPTIONS;
  const categoryOptions = categories.filter((c) => c.type === kind);
  const symbol =
    kind === 'CARD_CHARGE_USD' || (kind === 'CARD_PAYMENT' && payCurrency === 'USD') ? '$' : 'L';
  const needsCard = kind === 'CARD_CHARGE_USD' || kind === 'CARD_PAYMENT';
  const noCards = needsCard && creditCards.length === 0;

  const fail = (msg: string) => {
    setError(msg);
    return false;
  };

  const buildSubmit = (): TransactionSubmit | null => {
    setError(null);
    const amt = Number(amount);

    if (kind === 'CARD_CHARGE_USD') {
      if (!cardId) return (fail('Selecciona una tarjeta'), null);
      const parsed = cardChargeSchema.safeParse({ amount, description, charge_date: date });
      if (!parsed.success)
        return (fail(parsed.error.issues[0]?.message ?? 'Datos inválidos'), null);
      return { kind: 'cardChargeUsd', cardId, input: parsed.data };
    }

    if (kind === 'CARD_PAYMENT') {
      if (!cardId) return (fail('Selecciona una tarjeta'), null);
      if (!(amt > 0)) return (fail('Ingresa un monto válido'), null);
      if (payCurrency === 'USD' && !(Number(amountHnl) > 0)) {
        return (fail('Ingresa el pago en lempiras'), null);
      }
      const card = creditCards.find((c) => c.id === cardId);
      return {
        kind: 'cardPayment',
        cardId,
        cardName: card?.name ?? 'tarjeta',
        args: {
          currency: payCurrency,
          amount: amt,
          amountHnl: payCurrency === 'USD' ? Number(amountHnl) : null,
        },
      };
    }

    // Gasto / Ingreso / Ahorro
    const input = {
      type: kind,
      amount,
      category_id: kind === 'SAVING' ? null : categoryId || null,
      credit_card_id: kind === 'EXPENSE' ? cardId || null : null,
      savings_account_id: kind === 'SAVING' ? savingsId || null : null,
      description,
      transaction_date: date,
    };
    const parsed = transactionSchema.safeParse(input);
    if (!parsed.success) return (fail(parsed.error.issues[0]?.message ?? 'Datos inválidos'), null);
    return { kind: 'transaction', input: parsed.data };
  };

  const submit = async () => {
    const payload = buildSubmit();
    if (!payload) return;
    try {
      setLoading(true);
      await onSubmit(payload);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Editar transacción' : 'Nueva transacción'}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-4"
        noValidate
      >
        <Field label="Tipo de movimiento" htmlFor="kind">
          <Select
            id="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            disabled={isEditing}
          >
            {kindOptions.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>

        {noCards ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            Primero crea una tarjeta en la sección Tarjetas.
          </p>
        ) : (
          <>
            {needsCard && (
              <Field label="Tarjeta" htmlFor="card">
                <Select id="card" value={cardId} onChange={(e) => setCardId(e.target.value)}>
                  <option value="">Selecciona…</option>
                  {creditCards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            {kind === 'CARD_PAYMENT' && (
              <Field label="Moneda del pago" htmlFor="pay-currency">
                <div className="grid grid-cols-2 gap-2">
                  {(['HNL', 'USD'] as const).map((cur) => (
                    <button
                      key={cur}
                      type="button"
                      onClick={() => setPayCurrency(cur)}
                      className={
                        'rounded-[var(--radius)] border p-2.5 text-sm font-medium transition-colors ' +
                        (payCurrency === cur
                          ? 'border-primary bg-accent text-accent-foreground'
                          : 'border-border text-muted-foreground hover:bg-muted')
                      }
                    >
                      {cur === 'HNL' ? 'Lempiras (L)' : 'Dólares ($)'}
                    </button>
                  ))}
                </div>
              </Field>
            )}

            <Field label={kind === 'CARD_PAYMENT' ? 'Abono' : 'Monto'} htmlFor="amount">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {symbol}
                </span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="pl-7"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </Field>

            {kind === 'CARD_PAYMENT' && payCurrency === 'USD' && (
              <Field
                label="Pago en lempiras (L)"
                htmlFor="amount-hnl"
                hint="Lo que realmente pagaste en lempiras. Se registra como gasto."
              >
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    L
                  </span>
                  <Input
                    id="amount-hnl"
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="pl-7"
                    value={amountHnl}
                    onChange={(e) => setAmountHnl(e.target.value)}
                  />
                </div>
              </Field>
            )}

            {(kind === 'EXPENSE' || kind === 'INCOME') && (
              <Field label="Categoría" htmlFor="category">
                <Select
                  id="category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">Sin categoría</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            {kind === 'EXPENSE' && (
              <Field label="Medio de pago" htmlFor="pay-method">
                <Select id="pay-method" value={cardId} onChange={(e) => setCardId(e.target.value)}>
                  <option value="">Efectivo / débito</option>
                  {creditCards.map((c) => (
                    <option key={c.id} value={c.id}>
                      Tarjeta: {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            {kind === 'SAVING' && (
              <Field
                label="Cuenta de ahorro"
                htmlFor="savings"
                hint={
                  savingsAccounts.length === 0 ? 'Crea una cuenta de ahorro primero.' : undefined
                }
              >
                <Select
                  id="savings"
                  value={savingsId}
                  onChange={(e) => setSavingsId(e.target.value)}
                >
                  <option value="">Sin asignar</option>
                  {savingsAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <Field label="Descripción" htmlFor="description">
              <Input
                id="description"
                placeholder="Opcional"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>

            <Field label="Fecha" htmlFor="date">
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading} disabled={noCards}>
            {isEditing ? 'Guardar cambios' : 'Agregar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
