import { useEffect, useRef, useState } from 'react';
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
import { formatDate, todayISO } from '@/utils/date';
import type {
  Category,
  CreditCardWithBalance,
  Currency,
  SavingsAccountWithBalance,
  TransactionType,
  TransactionWithCategory,
} from '@/types/models';
import { getIncomeCategories } from '@/constants/incomeCategories';
import { formatCurrency, formatMoney } from '@/utils/format';
import type { ManualRecurringMatch } from '@/utils/manualRecurringGuard';
import { mapDbError } from '@/lib/errors';
import { HIDDEN_AMOUNT } from '@/components/ui/PrivacyToggle';
import { PRIVACY_KEYS, usePrivacy } from '@/contexts/privacy';

type Kind = TransactionType | 'CARD_CHARGE' | 'CARD_PAYMENT';

export type TransactionSubmit =
  | { kind: 'transaction'; input: TransactionInput }
  | { kind: 'cardCharge'; cardId: string; currency: Currency; input: CardChargeInput }
  | { kind: 'cardPayment'; cardId: string; cardName: string; args: CardPaymentArgs };

interface TransactionFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (submit: TransactionSubmit) => Promise<void>;
  checkRecurring: (submit: TransactionSubmit) => Promise<ManualRecurringMatch[]>;
  onSubmitRecurring: (submit: TransactionSubmit, match: ManualRecurringMatch) => Promise<void>;
  categories: Category[];
  creditCards: CreditCardWithBalance[];
  savingsAccounts: Pick<SavingsAccountWithBalance, 'id' | 'name' | 'balance'>[];
  initial?: TransactionWithCategory | null;
  defaultType?: TransactionType;
}

const KIND_OPTIONS: { value: Kind; label: string }[] = [
  { value: 'EXPENSE', label: 'Gasto (efectivo / débito)' },
  { value: 'INCOME', label: 'Ingreso' },
  { value: 'SAVING', label: 'Ahorro' },
  { value: 'TRANSFER', label: 'Transferencia entre cuentas' },
  { value: 'CARD_CHARGE', label: 'Compra con tarjeta' },
  { value: 'CARD_PAYMENT', label: 'Pago de tarjeta' },
];

export function TransactionForm({
  open,
  onClose,
  onSubmit,
  checkRecurring,
  onSubmitRecurring,
  categories,
  creditCards,
  savingsAccounts,
  initial,
  defaultType = 'EXPENSE',
}: TransactionFormProps) {
  const { isHidden } = usePrivacy();
  const [kind, setKind] = useState<Kind>(defaultType);
  const [amount, setAmount] = useState('');
  const [amountHnl, setAmountHnl] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [cardId, setCardId] = useState('');
  const [savingsId, setSavingsId] = useState('');
  const [destinationSavingsId, setDestinationSavingsId] = useState('');
  const [cardCurrency, setCardCurrency] = useState<Currency>('HNL');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  const [recurringReview, setRecurringReview] = useState<{
    payload: TransactionSubmit;
    matches: ManualRecurringMatch[];
  } | null>(null);

  const isEditing = !!initial;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setRecurringReview(null);
    setKind(initial?.type ?? defaultType);
    setAmount(initial?.amount != null ? String(initial.amount) : '');
    setAmountHnl('');
    setCategoryId(initial?.category_id ?? '');
    setCardId('');
    setSavingsId(initial?.savings_account_id ?? '');
    setDestinationSavingsId(initial?.destination_savings_account_id ?? '');
    setCardCurrency('HNL');
    setDescription(initial?.description ?? '');
    setDate(initial?.transaction_date ?? todayISO());
  }, [open, initial, defaultType]);

  const kindOptions = isEditing
    ? KIND_OPTIONS.filter((k) => ['EXPENSE', 'INCOME', 'SAVING', 'TRANSFER'].includes(k.value))
    : KIND_OPTIONS;
  const categoryType = kind === 'CARD_CHARGE' ? 'EXPENSE' : kind;
  const categoryOptions =
    categoryType === 'INCOME'
      ? getIncomeCategories(categories)
      : categories.filter((c) => c.type === categoryType);
  const needsCard = kind === 'CARD_CHARGE' || kind === 'CARD_PAYMENT';
  const showCategory = kind === 'EXPENSE' || kind === 'INCOME' || kind === 'CARD_CHARGE';
  const symbol = needsCard && cardCurrency === 'USD' ? '$' : 'L';
  const noCards = needsCard && creditCards.length === 0;
  const usesAccount =
    kind === 'EXPENSE' ||
    kind === 'INCOME' ||
    kind === 'SAVING' ||
    kind === 'TRANSFER' ||
    kind === 'CARD_PAYMENT';
  const accountRequired = kind === 'EXPENSE' || kind === 'TRANSFER' || kind === 'CARD_PAYMENT';
  const noRequiredAccounts =
    (accountRequired && savingsAccounts.length === 0) ||
    (kind === 'TRANSFER' && savingsAccounts.length < 2);
  const sourceAccount = savingsAccounts.find((account) => account.id === savingsId);
  const destinationAccount = savingsAccounts.find((account) => account.id === destinationSavingsId);
  const sourceAvailableBalance = sourceAccount
    ? sourceAccount.balance +
      (initial?.type === 'TRANSFER' && initial.savings_account_id === sourceAccount.id
        ? initial.amount
        : 0)
    : 0;

  const fail = (msg: string): null => {
    setError(msg);
    return null;
  };

  const buildSubmit = (): TransactionSubmit | null => {
    setError(null);
    const amt = Number(amount);

    if (kind === 'CARD_CHARGE') {
      if (!cardId) return fail('Selecciona una tarjeta');
      if (!categoryId) return fail('Selecciona la categoría de la compra');
      const parsed = cardChargeSchema.safeParse({
        amount,
        category_id: categoryId,
        description,
        charge_date: date,
      });
      if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return { kind: 'cardCharge', cardId, currency: cardCurrency, input: parsed.data };
    }

    if (kind === 'CARD_PAYMENT') {
      if (!cardId) return fail('Selecciona una tarjeta');
      if (!savingsId) return fail('Selecciona la cuenta desde donde pagaste');
      if (!(amt > 0)) return fail('Ingresa un monto válido');
      if (cardCurrency === 'USD' && !(Number(amountHnl) > 0)) {
        return fail('Ingresa el pago en lempiras');
      }
      const card = creditCards.find((c) => c.id === cardId);
      return {
        kind: 'cardPayment',
        cardId,
        cardName: card?.name ?? 'tarjeta',
        args: {
          currency: cardCurrency,
          amount: amt,
          amountHnl: cardCurrency === 'USD' ? Number(amountHnl) : null,
          accountId: savingsId,
        },
      };
    }

    if (kind === 'INCOME' && !categoryId) {
      return fail('Selecciona una categoría de ingreso');
    }
    if (kind === 'EXPENSE' && !savingsId) {
      return fail('Selecciona la cuenta de donde se debitará el gasto');
    }
    if (kind === 'TRANSFER' && sourceAccount && amt > sourceAvailableBalance) {
      return fail(
        `El monto supera el saldo disponible de ${formatCurrency(sourceAvailableBalance)}`,
      );
    }

    const input = {
      type: kind,
      amount,
      category_id: kind === 'SAVING' || kind === 'TRANSFER' ? null : categoryId || null,
      credit_card_id: null,
      savings_account_id: savingsId || null,
      destination_savings_account_id: kind === 'TRANSFER' ? destinationSavingsId || null : null,
      description,
      transaction_date: date,
    };
    const parsed = transactionSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos');
    return { kind: 'transaction', input: parsed.data };
  };

  const submit = async () => {
    if (busy.current) return;
    const payload = buildSubmit();
    if (!payload) return;
    try {
      busy.current = true;
      setLoading(true);
      if (!isEditing) {
        const matches = await checkRecurring(payload);
        if (matches.length) {
          setRecurringReview({ payload, matches });
          return;
        }
      }
      await onSubmit(payload);
      onClose();
    } catch (e) {
      const message = mapDbError(e, 'No se pudo verificar o guardar el movimiento');
      setError(message);
      toast.error(message);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  const resolveRecurring = async (match?: ManualRecurringMatch) => {
    if (!recurringReview || busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      if (match) await onSubmitRecurring(recurringReview.payload, match);
      else await onSubmit(recurringReview.payload);
      onClose();
    } catch (e) {
      const message = mapDbError(e, 'No se pudo guardar el movimiento');
      setError(message);
      toast.error(message);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  if (recurringReview) {
    return (
      <Modal
        open={open}
        onClose={loading ? () => {} : onClose}
        title="Revisar posible movimiento recurrente"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Encontramos coincidencias de categoría, monto, moneda y cuenta o tarjeta. Revisa si este
            movimiento corresponde a una de ellas antes de guardarlo.
          </p>
          {recurringReview.matches.map((match) => (
            <div
              key={`${match.rule.id}:${match.dueDate}`}
              className="space-y-2 rounded-[var(--radius)] border border-border p-3"
            >
              <p className="font-medium">{match.rule.name}</p>
              <p className="text-sm">
                {match.transaction ? 'Ya registrado' : 'Pendiente'} ·{' '}
                {(match.transaction?.type ?? match.rule.type) === 'INCOME' &&
                isHidden(PRIVACY_KEYS.income)
                  ? HIDDEN_AMOUNT
                  : formatMoney(
                      match.transaction?.amount ?? match.rule.amount,
                      match.transaction?.currency ?? match.rule.currency,
                    )}
                {' · '}
                {formatDate(match.transaction?.transaction_date ?? match.dueDate)}
              </p>
              {match.transaction ? (
                <p className="text-sm text-muted-foreground">
                  Este movimiento ya atendió la recurrencia del {formatDate(match.dueDate)}. Si es
                  el mismo, cancela para evitar contabilizarlo dos veces.
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Se guardará una sola vez con la fecha y el monto que ingresaste; también quedará
                    registrado en el calendario.
                  </p>
                  <Button
                    type="button"
                    loading={loading}
                    onClick={() => void resolveRecurring(match)}
                  >
                    Registrar y atender esta recurrencia
                  </Button>
                </>
              )}
            </div>
          ))}
          <p className="text-sm text-muted-foreground">
            Si se trata de otra operación, puedes guardarla como movimiento independiente. Esto
            agregará otro ingreso o gasto y no atenderá ninguna recurrencia pendiente.
          </p>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" disabled={loading} onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => {
                setRecurringReview(null);
                setError(null);
              }}
            >
              Volver al formulario
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={loading}
              onClick={() => void resolveRecurring()}
            >
              Es otro movimiento: guardar independiente
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
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

            {needsCard && (
              <Field label="Moneda">
                <div className="grid grid-cols-2 gap-2">
                  {(['HNL', 'USD'] as const).map((cur) => (
                    <button
                      key={cur}
                      type="button"
                      onClick={() => setCardCurrency(cur)}
                      className={
                        'rounded-[var(--radius)] border p-2.5 text-sm font-medium transition-colors ' +
                        (cardCurrency === cur
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

            {kind === 'CARD_PAYMENT' && cardCurrency === 'USD' && (
              <Field
                label="Pago en lempiras (L)"
                htmlFor="amount-hnl"
                hint="Lo que salió de tu cuenta; no se contará otra vez como gasto."
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

            {showCategory && (
              <Field label="Categoría" htmlFor="category">
                <Select
                  id="category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">{kind === 'INCOME' ? 'Selecciona…' : 'Sin categoría'}</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            {usesAccount && (
              <Field
                label={
                  kind === 'EXPENSE'
                    ? 'Debitar de cuenta'
                    : kind === 'CARD_PAYMENT'
                      ? 'Pagar desde cuenta'
                      : kind === 'TRANSFER'
                        ? 'Cuenta de origen'
                        : kind === 'INCOME'
                          ? 'Depositar en cuenta (opcional)'
                          : 'Cuenta'
                }
                htmlFor="savings"
                hint={
                  savingsAccounts.length === 0
                    ? 'Crea una cuenta primero en la sección Cuentas.'
                    : kind === 'EXPENSE'
                      ? 'El gasto reducirá el saldo de la cuenta seleccionada.'
                      : kind === 'CARD_PAYMENT'
                        ? 'El pago reducirá esta cuenta y también la deuda de la tarjeta.'
                        : kind === 'TRANSFER'
                          ? 'El dinero saldrá de esta cuenta sin contarse como gasto.'
                          : kind === 'INCOME'
                            ? 'El ingreso seguirá sumando al dashboard y también aumentará el saldo de la cuenta.'
                            : undefined
                }
              >
                <Select
                  id="savings"
                  value={savingsId}
                  onChange={(e) => setSavingsId(e.target.value)}
                >
                  <option value="">
                    {accountRequired ? 'Selecciona una cuenta…' : 'No asignar a una cuenta'}
                  </option>
                  {savingsAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {kind === 'TRANSFER'
                        ? ` — ${isHidden(PRIVACY_KEYS.account(a.id)) ? HIDDEN_AMOUNT : formatCurrency(a.balance)}`
                        : ''}
                    </option>
                  ))}
                </Select>
                {kind === 'TRANSFER' && sourceAccount && (
                  <span className="mt-2 inline-flex rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-primary">
                    Disponible:{' '}
                    {isHidden(PRIVACY_KEYS.account(sourceAccount.id))
                      ? HIDDEN_AMOUNT
                      : formatCurrency(sourceAvailableBalance)}
                  </span>
                )}
              </Field>
            )}

            {kind === 'TRANSFER' && (
              <Field
                label="Cuenta de destino"
                htmlFor="destination-savings"
                hint="El dinero entrará a esta cuenta sin contarse como ingreso."
              >
                <Select
                  id="destination-savings"
                  value={destinationSavingsId}
                  onChange={(e) => setDestinationSavingsId(e.target.value)}
                >
                  <option value="">Selecciona una cuenta…</option>
                  {savingsAccounts
                    .filter((account) => account.id !== savingsId)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} —{' '}
                        {isHidden(PRIVACY_KEYS.account(account.id))
                          ? HIDDEN_AMOUNT
                          : formatCurrency(account.balance)}
                      </option>
                    ))}
                </Select>
                {destinationAccount && (
                  <span className="mt-2 inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    Saldo actual:{' '}
                    {isHidden(PRIVACY_KEYS.account(destinationAccount.id))
                      ? HIDDEN_AMOUNT
                      : formatCurrency(destinationAccount.balance)}
                  </span>
                )}
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
          <Button type="button" variant="outline" disabled={loading} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading} disabled={noCards || noRequiredAccounts}>
            {isEditing ? 'Guardar cambios' : 'Agregar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
