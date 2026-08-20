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
    defaultValues: { color: COLOR_OPTIONS[9], opening_balance: 0, opening_balance_usd: 0 },
  });

  const color = watch('color');

  useEffect(() => {
    if (!open) return;
    reset({
      name: initial?.name ?? '',
      bank: initial?.bank ?? '',
      opening_balance: initial?.opening_balance ?? 0,
      opening_balance_usd: initial?.opening_balance_usd ?? 0,
      credit_limit: initial?.credit_limit ?? undefined,
      credit_limit_usd: initial?.credit_limit_usd ?? undefined,
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

  const money = (id: keyof CreditCardInput, symbol: string, placeholder = '0.00') => (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        {symbol}
      </span>
      <Input
        id={id}
        type="number"
        step="0.01"
        min="0"
        inputMode="decimal"
        placeholder={placeholder}
        className="pl-7"
        {...register(id)}
      />
    </div>
  );

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

        <p className="text-xs text-muted-foreground">
          Deja en 0 la moneda que no uses. Las tarjetas pueden manejar Lempiras y Dólares a la vez.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Deuda en Lempiras"
            htmlFor="opening_balance"
            error={errors.opening_balance?.message}
          >
            {money('opening_balance', 'L')}
          </Field>
          <Field
            label="Deuda en Dólares"
            htmlFor="opening_balance_usd"
            error={errors.opening_balance_usd?.message}
          >
            {money('opening_balance_usd', '$')}
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Límite L (opcional)"
            htmlFor="credit_limit"
            error={errors.credit_limit?.message}
          >
            {money('credit_limit', 'L')}
          </Field>
          <Field
            label="Límite $ (opcional)"
            htmlFor="credit_limit_usd"
            error={errors.credit_limit_usd?.message}
          >
            {money('credit_limit_usd', '$')}
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
