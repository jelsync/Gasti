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
  /** IDs de categorías que ya tienen presupuesto este mes (para excluirlas al crear). */
  usedCategoryIds?: string[];
}

export function BudgetForm({
  open,
  onClose,
  onSubmit,
  expenseCategories,
  month,
  initial,
  usedCategoryIds = [],
}: BudgetFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BudgetInput>({
    resolver: zodResolver(budgetSchema),
    defaultValues: { category_id: '', amount: undefined, month: month.month, year: month.year },
  });

  const available = initial
    ? expenseCategories
    : expenseCategories.filter((c) => !usedCategoryIds.includes(c.id));

  useEffect(() => {
    if (!open) return;
    reset({
      category_id: initial?.category_id ?? available[0]?.id ?? '',
      amount: initial?.amount,
      month: month.month,
      year: month.year,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, month.month, month.year, reset]);

  const submit = async (values: BudgetInput) => {
    try {
      await onSubmit(values);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar presupuesto' : 'Nuevo presupuesto'}>
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <Field label="Categoría" htmlFor="category_id" error={errors.category_id?.message}>
          <Select
            id="category_id"
            disabled={!!initial}
            aria-invalid={!!errors.category_id}
            {...register('category_id')}
          >
            {available.length === 0 && <option value="">No hay categorías disponibles</option>}
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Monto mensual" htmlFor="amount" error={errors.amount?.message}>
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
          <Button type="submit" loading={isSubmitting} disabled={available.length === 0}>
            {initial ? 'Guardar cambios' : 'Crear'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
