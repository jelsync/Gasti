import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { creditCardSchema, type CreditCardInput } from '@/lib/validations';
import { COLOR_OPTIONS } from '@/lib/icons';
import { CURRENCY_SYMBOL } from '@/utils/format';
import { cn } from '@/lib/utils';
import type { CreditCard } from '@/types/models';

interface CreditCardFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreditCardInput) => Promise<void>;
  initial?: CreditCard | null;
}

export function CreditCardForm({ open, onClose, onSubmit, initial }: CreditCardFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreditCardInput>({
    resolver: zodResolver(creditCardSchema),
    defaultValues: { color: COLOR_OPTIONS[9] },
  });

  const color = watch('color');

  useEffect(() => {
    if (!open) return;
    reset({
      name: initial?.name ?? '',
      bank: initial?.bank ?? '',
      opening_balance: initial?.opening_balance ?? 0,
      credit_limit: initial?.credit_limit ?? undefined,
      color: initial?.color ?? COLOR_OPTIONS[9],
    });
  }, [open, initial, reset]);

  const submit = async (values: CreditCardInput) => {
    try {
      await onSubmit(values);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar tarjeta' : 'Nueva tarjeta'}>
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <Field label="Nombre" htmlFor="name" error={errors.name?.message}>
          <Input
            id="name"
            placeholder="Ej. Visa Oro"
            aria-invalid={!!errors.name}
            {...register('name')}
          />
        </Field>

        <Field label="Banco (opcional)" htmlFor="bank" error={errors.bank?.message}>
          <Input id="bank" placeholder="Ej. Atlántida" {...register('bank')} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Deuda actual"
            htmlFor="opening_balance"
            error={errors.opening_balance?.message}
            hint="Lo que debes hoy"
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
          <Field
            label="Límite (opcional)"
            htmlFor="credit_limit"
            error={errors.credit_limit?.message}
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {CURRENCY_SYMBOL}
              </span>
              <Input
                id="credit_limit"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="0.00"
                className="pl-7"
                {...register('credit_limit')}
              />
            </div>
          </Field>
        </div>

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
            {initial ? 'Guardar cambios' : 'Agregar tarjeta'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
