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
import type { Category, TransactionType, TransactionWithCategory } from '@/types/models';

interface TransactionFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: TransactionInput) => Promise<void>;
  categories: Category[];
  initial?: TransactionWithCategory | null;
  defaultType?: TransactionType;
}

export function TransactionForm({
  open,
  onClose,
  onSubmit,
  categories,
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
      description: '',
      transaction_date: todayISO(),
    },
  });

  const type = watch('type');

  // Reinicia el formulario al abrir o al cambiar el registro a editar.
  useEffect(() => {
    if (!open) return;
    reset({
      type: initial?.type ?? defaultType,
      amount: initial?.amount,
      category_id: initial?.category_id ?? null,
      description: initial?.description ?? '',
      transaction_date: initial?.transaction_date ?? todayISO(),
    });
  }, [open, initial, defaultType, reset]);

  const options = categories.filter((c) => c.type === type);

  const setType = (next: TransactionType) => {
    setValue('type', next);
    // Si la categoría seleccionada no corresponde al nuevo tipo, límpiala.
    const current = watch('category_id');
    if (current && !categories.some((c) => c.id === current && c.type === next)) {
      setValue('category_id', null);
    }
  };

  const submit = async (values: TransactionInput) => {
    try {
      await onSubmit(values);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Editar transacción' : 'Nueva transacción'}
    >
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        {/* Tipo */}
        <div className="grid grid-cols-2 gap-2">
          {(['EXPENSE', 'INCOME'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setType(value)}
              className={cn(
                'rounded-[var(--radius)] border p-2.5 text-sm font-medium transition-colors',
                type === value
                  ? value === 'EXPENSE'
                    ? 'border-expense bg-expense-soft text-expense'
                    : 'border-income bg-income-soft text-income'
                  : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              {value === 'EXPENSE' ? 'Gasto' : 'Ingreso'}
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

        <Field label="Categoría" htmlFor="category_id" error={errors.category_id?.message}>
          <Select
            id="category_id"
            aria-invalid={!!errors.category_id}
            {...register('category_id', { setValueAs: (v) => (v === '' ? null : v) })}
          >
            <option value="">Sin categoría</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

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
