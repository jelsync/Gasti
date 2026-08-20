import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { cardChargeSchema, type CardChargeInput } from '@/lib/validations';
import { CURRENCY_SYMBOLS } from '@/utils/format';
import { todayISO } from '@/utils/date';
import type { CreditCardWithBalance } from '@/types/models';

interface CardChargeModalProps {
  open: boolean;
  card: CreditCardWithBalance | null;
  onClose: () => void;
  onSubmit: (input: CardChargeInput) => Promise<void>;
}

export function CardChargeModal({ open, card, onClose, onSubmit }: CardChargeModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CardChargeInput>({
    resolver: zodResolver(cardChargeSchema),
    defaultValues: { charge_date: todayISO() },
  });

  useEffect(() => {
    if (open) reset({ amount: undefined, description: '', charge_date: todayISO() });
  }, [open, reset]);

  if (!card) return null;

  const submit = async (values: CardChargeInput) => {
    try {
      await onSubmit(values);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar la compra');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar compra"
      description={`${card.name} · aumenta la deuda de la tarjeta`}
    >
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <Field
          label={`Monto (${card.currency})`}
          htmlFor="charge-amount"
          error={errors.amount?.message}
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {CURRENCY_SYMBOLS[card.currency]}
            </span>
            <Input
              id="charge-amount"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="0.00"
              className="pl-7"
              aria-invalid={!!errors.amount}
              {...register('amount')}
              autoFocus
            />
          </div>
        </Field>

        <Field label="Descripción" htmlFor="charge-desc" error={errors.description?.message}>
          <Input id="charge-desc" placeholder="Opcional" {...register('description')} />
        </Field>

        <Field label="Fecha" htmlFor="charge-date" error={errors.charge_date?.message}>
          <Input id="charge-date" type="date" {...register('charge_date')} />
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Registrar compra
          </Button>
        </div>
      </form>
    </Modal>
  );
}
