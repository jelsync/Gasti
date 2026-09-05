import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { budgetSchema, type BudgetInput } from '@/lib/validations';
import { CURRENCY_SYMBOL } from '@/utils/format';
import { cn } from '@/lib/utils';
import type { MonthYear } from '@/utils/date';
import type { Category } from '@/types/models';
import type { BudgetWithCategory } from '@/services/budgets.service';

interface BudgetFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: BudgetInput) => Promise<void>;
  expenseCategories: Category[];
  month: MonthYear;
  initial?: BudgetWithCategory | null;
  usedCategoryIds?: string[];
  /** Si ya existe una meta de ahorro este mes (para no duplicarla al crear). */
  savingsUsed?: boolean;
  initialCategoryId?: string | null;
}

export function BudgetForm({
  open,
  onClose,
  onSubmit,
  expenseCategories,
  month,
  initial,
  usedCategoryIds = [],
  savingsUsed = false,
  initialCategoryId = null,
}: BudgetFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BudgetInput>({
    resolver: zodResolver(budgetSchema),
    defaultValues: { kind: 'CATEGORY', category_id: null, month: month.month, year: month.year },
  });

  const kind = watch('kind');

  const available = initial
    ? expenseCategories
    : expenseCategories.filter((c) => !usedCategoryIds.includes(c.id));

  useEffect(() => {
    if (!open) return;
    reset({
      kind: initial?.kind ?? 'CATEGORY',
      category_id: initial?.category_id ?? initialCategoryId ?? available[0]?.id ?? null,
      amount: initial?.amount,
      month: month.month,
      year: month.year,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, initialCategoryId, month.month, month.year, reset]);

  const setKind = (value: 'CATEGORY' | 'SAVINGS') => {
    setValue('kind', value);
    setValue('category_id', value === 'SAVINGS' ? null : (available[0]?.id ?? null));
  };

  const submit = async (values: BudgetInput) => {
    try {
      await onSubmit(values);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    }
  };

  const savingsDisabled = !initial && savingsUsed;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Editar presupuesto' : 'Nuevo presupuesto'}
    >
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        {!initial && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setKind('CATEGORY')}
              className={cn(
                'rounded-[var(--radius)] border p-2.5 text-sm font-medium transition-colors',
                kind === 'CATEGORY'
                  ? 'border-primary bg-accent text-accent-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              Categoría de gasto
            </button>
            <button
              type="button"
              onClick={() => setKind('SAVINGS')}
              disabled={savingsDisabled}
              className={cn(
                'rounded-[var(--radius)] border p-2.5 text-sm font-medium transition-colors disabled:opacity-40',
                kind === 'SAVINGS'
                  ? 'border-primary bg-accent text-accent-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              Meta de ahorro
            </button>
          </div>
        )}

        {kind === 'CATEGORY' && (
          <Field label="Categoría" htmlFor="category_id" error={errors.category_id?.message}>
            <Select
              id="category_id"
              disabled={!!initial}
              aria-invalid={!!errors.category_id}
              {...register('category_id', { setValueAs: (v) => (v === '' ? null : v) })}
            >
              {available.length === 0 && <option value="">No hay categorías disponibles</option>}
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {kind === 'SAVINGS' && (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            Meta de cuánto te gustaría ahorrar este mes. Se mide con tus transacciones de tipo
            Ahorro.
          </p>
        )}

        <Field
          label={kind === 'SAVINGS' ? 'Meta mensual' : 'Monto mensual'}
          htmlFor="amount"
          error={errors.amount?.message}
        >
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

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={kind === 'CATEGORY' && available.length === 0}
          >
            {initial ? 'Guardar cambios' : 'Crear'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
