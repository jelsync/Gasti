import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { savingsAccountSchema, type SavingsAccountInput } from '@/lib/validations';
import { COLOR_OPTIONS } from '@/lib/icons';
import { CURRENCY_SYMBOL } from '@/utils/format';
import { cn } from '@/lib/utils';
import type { SavingsAccount } from '@/types/models';

interface SavingsAccountFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: SavingsAccountInput) => Promise<void>;
  initial?: SavingsAccount | null;
}

export function SavingsAccountForm({ open, onClose, onSubmit, initial }: SavingsAccountFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SavingsAccountInput>({
    resolver: zodResolver(savingsAccountSchema),
    defaultValues: { color: COLOR_OPTIONS[7] },
  });

  const color = watch('color');

  useEffect(() => {
    if (!open) return;
    reset({
      name: initial?.name ?? '',
      institution: initial?.institution ?? '',
      opening_balance: initial?.opening_balance ?? 0,
      color: initial?.color ?? COLOR_OPTIONS[7],
    });
  }, [open, initial, reset]);

  const submit = async (values: SavingsAccountInput) => {
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
      title={initial ? 'Editar cuenta' : 'Nueva cuenta de ahorro'}
    >
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <Field label="Nombre" htmlFor="name" error={errors.name?.message}>
          <Input
            id="name"
            placeholder="Ej. Ahorro Cooperativa"
            aria-invalid={!!errors.name}
            {...register('name')}
          />
        </Field>

        <Field
          label="Institución (opcional)"
          htmlFor="institution"
          error={errors.institution?.message}
        >
          <Input
            id="institution"
            placeholder="Ej. Cooperativa / Banco"
            {...register('institution')}
          />
        </Field>

        <Field
          label="Saldo actual"
          htmlFor="opening_balance"
          error={errors.opening_balance?.message}
          hint="Lo que ya tienes ahorrado hoy"
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {CURRENCY_SYMBOL}
            </span>
            <Input
              id="opening_balance"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="0.00"
              className="pl-7"
              aria-invalid={!!errors.opening_balance}
              {...register('opening_balance')}
            />
          </div>
        </Field>

        <Field label="Color" error={errors.color?.message}>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setValue('color', c)}
                aria-label={`Color ${c}`}
                className={cn(
                  'h-7 w-7 rounded-full ring-offset-2 ring-offset-card transition',
                  color === c ? 'ring-2 ring-foreground' : '',
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {initial ? 'Guardar cambios' : 'Agregar cuenta'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
