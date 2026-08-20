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
import { CURRENCY_SYMBOLS } from '@/utils/format';
import { cn } from '@/lib/utils';
import type { CreditCard, Currency } from '@/types/models';

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
    defaultValues: { color: COLOR_OPTIONS[9], currency: 'HNL' },
  });

  const color = watch('color');
  const currency = (watch('currency') ?? 'HNL') as Currency;
  const symbol = CURRENCY_SYMBOLS[currency];

  useEffect(() => {
    if (!open) return;
    reset({
      name: initial?.name ?? '',
      bank: initial?.bank ?? '',
      currency: initial?.currency ?? 'HNL',
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

        <Field label="Moneda">
          <div className="grid grid-cols-2 gap-2">
            {(['HNL', 'USD'] as const).map((cur) => (
              <button
                key={cur}
                type="button"
                onClick={() => setValue('currency', cur)}
                className={cn(
                  'rounded-[var(--radius)] border p-2.5 text-sm font-medium transition-colors',
                  currency === cur
                    ? 'border-primary bg-accent text-accent-foreground'
                    : 'border-border text-muted-foreground hover:bg-muted',
                )}
              >
                {cur === 'HNL' ? 'Lempiras (L)' : 'Dólares ($)'}
              </button>
            ))}
          </div>
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
                {symbol}
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
                {symbol}
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
