import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { transactionSchema, type TransactionInput } from '@/lib/validations';
import { CURRENCY_SYMBOL } from '@/utils/format';
import { todayISO } from '@/utils/date';
import { cn } from '@/lib/utils';
import type {
  Category,
  CreditCard,
  SavingsAccount,
  TransactionType,
  TransactionWithCategory,
} from '@/types/models';

interface TransactionFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: TransactionInput) => Promise<void>;
  categories: Category[];
  creditCards: Pick<CreditCard, 'id' | 'name'>[];
  savingsAccounts: Pick<SavingsAccount, 'id' | 'name'>[];
  initial?: TransactionWithCategory | null;
  defaultType?: TransactionType;
}

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'EXPENSE', label: 'Gasto' },
  { value: 'INCOME', label: 'Ingreso' },
  { value: 'SAVING', label: 'Ahorro' },
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
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TransactionInput>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: defaultType,
      category_id: null,
      credit_card_id: null,
      savings_account_id: null,
      description: '',
      transaction_date: todayISO(),
    },
  });

  const type = watch('type');

  useEffect(() => {
    if (!open) return;
    reset({
      type: initial?.type ?? defaultType,
      amount: initial?.amount,
      category_id: initial?.category_id ?? null,
      credit_card_id: initial?.credit_card_id ?? null,
      savings_account_id: initial?.savings_account_id ?? null,
      description: initial?.description ?? '',
      transaction_date: initial?.transaction_date ?? todayISO(),
    });
  }, [open, initial, defaultType, reset]);

  const categoryOptions = categories.filter((c) => c.type === type);

  const setType = (next: TransactionType) => {
    setValue('type', next);
    if (next !== 'EXPENSE') setValue('credit_card_id', null);
    if (next !== 'SAVING') setValue('savings_account_id', null);
    if (next === 'SAVING') setValue('category_id', null);
    const currentCat = watch('category_id');
    if (
      next !== 'SAVING' &&
      currentCat &&
      !categories.some((c) => c.id === currentCat && c.type === next)
    ) {
      setValue('category_id', null);
    }
  };

  const submit = async (values: TransactionInput) => {
    const clean: TransactionInput = {
      ...values,
      category_id: values.type === 'SAVING' ? null : values.category_id,
      credit_card_id: values.type === 'EXPENSE' ? (values.credit_card_id ?? null) : null,
      savings_account_id: values.type === 'SAVING' ? (values.savings_account_id ?? null) : null,
    };
    try {
      await onSubmit(clean);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    }
  };

  const activeClass =
    type === 'EXPENSE'
      ? 'border-expense bg-expense-soft text-expense'
      : type === 'INCOME'
        ? 'border-income bg-income-soft text-income'
        : 'border-primary bg-accent text-accent-foreground';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Editar transacción' : 'Nueva transacción'}
    >
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-3 gap-2">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setType(opt.value)}
              className={cn(
                'rounded-[var(--radius)] border p-2.5 text-sm font-medium transition-colors',
                type === opt.value
                  ? activeClass
                  : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <Field label="Monto" htmlFor="amount" error={errors.amount?.message}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {CURRENCY_SYMBOL}
            </span>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="0.00"
              className="pl-7"
              aria-invalid={!!errors.amount}
              {...register('amount')}
            />
          </div>
        </Field>

        {type !== 'SAVING' && (
          <Field label="Categoría" htmlFor="category_id" error={errors.category_id?.message}>
            <Select
              id="category_id"
              aria-invalid={!!errors.category_id}
              {...register('category_id', { setValueAs: (v) => (v === '' ? null : v) })}
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

        {type === 'EXPENSE' && (
          <Field label="Medio de pago" htmlFor="credit_card_id">
            <Select
              id="credit_card_id"
              {...register('credit_card_id', { setValueAs: (v) => (v === '' ? null : v) })}
            >
              <option value="">Efectivo / débito</option>
              {creditCards.map((card) => (
                <option key={card.id} value={card.id}>
                  Tarjeta: {card.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {type === 'SAVING' && (
          <Field
            label="Cuenta de ahorro"
            htmlFor="savings_account_id"
            hint={
              savingsAccounts.length === 0
                ? 'Crea una cuenta de ahorro para asignar tus aportes.'
                : undefined
            }
          >
            <Select
              id="savings_account_id"
              {...register('savings_account_id', { setValueAs: (v) => (v === '' ? null : v) })}
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

        <Field label="Descripción" htmlFor="description" error={errors.description?.message}>
          <Input
            id="description"
            placeholder="Opcional"
            aria-invalid={!!errors.description}
            {...register('description')}
          />
        </Field>

        <Field label="Fecha" htmlFor="transaction_date" error={errors.transaction_date?.message}>
          <Input
            id="transaction_date"
            type="date"
            aria-invalid={!!errors.transaction_date}
            {...register('transaction_date')}
          />
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {initial ? 'Guardar cambios' : 'Agregar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
