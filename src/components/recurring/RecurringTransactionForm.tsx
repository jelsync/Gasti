import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { recurringTransactionSchema, type RecurringTransactionInput } from '@/lib/validations';
import { getCurrentMonthYear, monthRange } from '@/utils/date';
import { getIncomeCategories } from '@/constants/incomeCategories';
import type {
  Category,
  CreditCardWithBalance,
  RecurringTransactionWithRelations,
  SavingsAccountWithBalance,
} from '@/types/models';

type RecurringType = 'INCOME' | 'EXPENSE';
type PaymentMethod = 'ACCOUNT' | 'CARD';

interface RecurringTransactionFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: RecurringTransactionInput) => Promise<void>;
  categories: Category[];
  accounts: SavingsAccountWithBalance[];
  cards: CreditCardWithBalance[];
  initial?: RecurringTransactionWithRelations | null;
}

function currentMonthStart(): string {
  const current = getCurrentMonthYear();
  return monthRange(current.year, current.month).start;
}

export function RecurringTransactionForm({
  open,
  onClose,
  onSubmit,
  categories,
  accounts,
  cards,
  initial,
}: RecurringTransactionFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<RecurringType>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'HNL' | 'USD'>('HNL');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('ACCOUNT');
  const [accountId, setAccountId] = useState('');
  const [cardId, setCardId] = useState('');
  const [description, setDescription] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState(String(new Date().getDate()));
  const [startDate, setStartDate] = useState(currentMonthStart);
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const visibleCategories = useMemo(
    () =>
      type === 'INCOME'
        ? getIncomeCategories(categories)
        : categories.filter((category) => category.type === 'EXPENSE'),
    [categories, type],
  );

  useEffect(() => {
    if (!open) return;
    const nextType = initial?.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
    setName(initial?.name ?? '');
    setType(nextType);
    setAmount(initial ? String(initial.amount) : '');
    setCurrency(initial?.currency ?? 'HNL');
    setCategoryId(initial?.category_id ?? '');
    setPaymentMethod(initial?.credit_card_id ? 'CARD' : 'ACCOUNT');
    setAccountId(initial?.savings_account_id ?? '');
    setCardId(initial?.credit_card_id ?? '');
    setDescription(initial?.description ?? '');
    setDayOfMonth(String(initial?.day_of_month ?? new Date().getDate()));
    setStartDate(initial?.start_date ?? currentMonthStart());
    setEndDate(initial?.end_date ?? '');
    setError(null);
  }, [open, initial]);

  const changeType = (nextType: RecurringType) => {
    setType(nextType);
    const nextCategories =
      nextType === 'INCOME'
        ? getIncomeCategories(categories)
        : categories.filter((category) => category.type === 'EXPENSE');
    setCategoryId(nextCategories[0]?.id ?? '');
    if (nextType === 'INCOME') {
      setPaymentMethod('ACCOUNT');
      setCardId('');
      setCurrency('HNL');
    }
  };

  const submit = async () => {
    const parsed = recurringTransactionSchema.safeParse({
      name,
      type,
      amount,
      currency,
      category_id: categoryId,
      savings_account_id:
        type === 'INCOME' || paymentMethod === 'ACCOUNT' ? accountId || null : null,
      credit_card_id: type === 'EXPENSE' && paymentMethod === 'CARD' ? cardId || null : null,
      description,
      day_of_month: dayOfMonth,
      start_date: startDate,
      end_date: endDate,
      is_active: initial?.is_active ?? true,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revisa los datos');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSubmit(parsed.data);
      onClose();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Editar movimiento recurrente' : 'Nuevo movimiento recurrente'}
      description="Se mostrará como pendiente cada mes y solo moverá dinero cuando lo confirmes."
      className="sm:max-w-xl"
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        noValidate
      >
        <Field label="Nombre" htmlFor="recurring-name">
          <Input
            id="recurring-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej. Spotify, salario o alquiler"
            autoFocus
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo" htmlFor="recurring-type">
            <Select
              id="recurring-type"
              value={type}
              onChange={(event) => changeType(event.target.value as RecurringType)}
            >
              <option value="EXPENSE">Gasto</option>
              <option value="INCOME">Ingreso</option>
            </Select>
          </Field>
          <Field label="Categoría" htmlFor="recurring-category">
            <Select
              id="recurring-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Selecciona una categoría…</option>
              {visibleCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-[1fr_7rem] gap-4">
          <Field label="Monto" htmlFor="recurring-amount">
            <Input
              id="recurring-amount"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label="Moneda" htmlFor="recurring-currency">
            <Select
              id="recurring-currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value as 'HNL' | 'USD')}
            >
              <option value="HNL">HNL</option>
              {type === 'EXPENSE' && paymentMethod === 'CARD' && <option value="USD">USD</option>}
            </Select>
          </Field>
        </div>

        {type === 'EXPENSE' && (
          <Field label="Forma de pago" htmlFor="recurring-payment-method">
            <Select
              id="recurring-payment-method"
              value={paymentMethod}
              onChange={(event) => {
                const nextMethod = event.target.value as PaymentMethod;
                setPaymentMethod(nextMethod);
                if (nextMethod === 'ACCOUNT') setCurrency('HNL');
              }}
            >
              <option value="ACCOUNT">Débito de una cuenta</option>
              <option value="CARD">Cargo a una tarjeta</option>
            </Select>
          </Field>
        )}

        {(type === 'INCOME' || paymentMethod === 'ACCOUNT') && (
          <Field
            label={type === 'INCOME' ? 'Depositar en cuenta (opcional)' : 'Debitar de cuenta'}
            htmlFor="recurring-account"
          >
            <Select
              id="recurring-account"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              <option value="">
                {type === 'INCOME' ? 'No asignar a una cuenta' : 'Selecciona una cuenta…'}
              </option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {type === 'EXPENSE' && paymentMethod === 'CARD' && (
          <Field label="Cargar a tarjeta" htmlFor="recurring-card">
            <Select
              id="recurring-card"
              value={cardId}
              onChange={(event) => setCardId(event.target.value)}
            >
              <option value="">Selecciona una tarjeta…</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Día de cada mes" htmlFor="recurring-day">
            <Input
              id="recurring-day"
              type="number"
              min="1"
              max="31"
              value={dayOfMonth}
              onChange={(event) => setDayOfMonth(event.target.value)}
            />
          </Field>
          <Field label="Desde" htmlFor="recurring-start">
            <Input
              id="recurring-start"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </Field>
          <Field label="Hasta (opcional)" htmlFor="recurring-end">
            <Input
              id="recurring-end"
              type="date"
              value={endDate}
              min={startDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </Field>
        </div>

        <Field label="Descripción (opcional)" htmlFor="recurring-description">
          <Input
            id="recurring-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Aparecerá en la transacción confirmada"
          />
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            {initial ? 'Guardar cambios' : 'Crear recurrente'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
