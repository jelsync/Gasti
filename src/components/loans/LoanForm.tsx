import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { loanSchema, type LoanInput } from '@/lib/validations';
import { CURRENCY_SYMBOL } from '@/utils/format';
import { todayISO } from '@/utils/date';
import type { Category, LoanWithCategory } from '@/types/models';

interface LoanFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: LoanInput) => Promise<void>;
  expenseCategories: Category[];
  initial?: LoanWithCategory | null;
}

export function LoanForm({ open, onClose, onSubmit, expenseCategories, initial }: LoanFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LoanInput>({
    resolver: zodResolver(loanSchema),
    defaultValues: { start_date: todayISO(), category_id: null, interest_rate: 0 },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      name: initial?.name ?? '',
      loan_number: initial?.loan_number ?? '',
      original_amount: initial?.original_amount,
      interest_rate: initial?.interest_rate ?? 0,
      term_months: initial?.term_months,
      installment: initial?.installment,
      current_balance: initial?.current_balance,
      start_date: initial?.start_date ?? todayISO(),
      end_date: initial?.end_date ?? '',
      category_id: initial?.category_id ?? null,
    });
  }, [open, initial, reset]);

  const submit = async (values: LoanInput) => {
    try {
      await onSubmit(values);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    }
  };

  const money = (id: keyof LoanInput, placeholder = '0.00') => (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        {CURRENCY_SYMBOL}
      </span>
      <Input
        id={id}
        type="number"
        step="0.01"
        min="0"
        inputMode="decimal"
        placeholder={placeholder}
        className="pl-7"
        aria-invalid={!!errors[id]}
        {...register(id)}
      />
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar préstamo' : 'Nuevo préstamo'}>
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <Field label="Nombre" htmlFor="name" error={errors.name?.message}>
          <Input
            id="name"
            placeholder="Ej. Préstamo Vivienda"
            aria-invalid={!!errors.name}
            {...register('name')}
          />
        </Field>

        <Field
          label="Número de préstamo (opcional)"
          htmlFor="loan_number"
          error={errors.loan_number?.message}
        >
          <Input id="loan_number" placeholder="Ej. 1020203389" {...register('loan_number')} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Monto original"
            htmlFor="original_amount"
            error={errors.original_amount?.message}
          >
            {money('original_amount')}
          </Field>
          <Field
            label="Saldo actual (banco)"
            htmlFor="current_balance"
            error={errors.current_balance?.message}
          >
            {money('current_balance')}
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cuota mensual" htmlFor="installment" error={errors.installment?.message}>
            {money('installment')}
          </Field>
          <Field
            label="Tasa anual (%)"
            htmlFor="interest_rate"
            error={errors.interest_rate?.message}
          >
            <Input
              id="interest_rate"
              type="number"
              step="0.001"
              min="0"
              inputMode="decimal"
              placeholder="9.00"
              aria-invalid={!!errors.interest_rate}
              {...register('interest_rate')}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Plazo (meses)" htmlFor="term_months" error={errors.term_months?.message}>
            <Input
              id="term_months"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              placeholder="179"
              aria-invalid={!!errors.term_months}
              {...register('term_months')}
            />
          </Field>
          <Field label="Fecha de inicio" htmlFor="start_date" error={errors.start_date?.message}>
            <Input
              id="start_date"
              type="date"
              aria-invalid={!!errors.start_date}
              {...register('start_date')}
            />
          </Field>
        </div>

        <Field
          label="Categoría de pago"
          htmlFor="category_id"
          error={errors.category_id?.message}
          hint="La cuota se registrará como gasto en esta categoría."
        >
          <Select
            id="category_id"
            aria-invalid={!!errors.category_id}
            {...register('category_id', { setValueAs: (v) => (v === '' ? null : v) })}
          >
            <option value="">Sin categoría</option>
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {initial ? 'Guardar cambios' : 'Agregar préstamo'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
