import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { CURRENCY_SYMBOL, formatCurrency } from '@/utils/format';
import type { CreditCardWithBalance } from '@/types/models';

interface CardPaymentModalProps {
  open: boolean;
  card: CreditCardWithBalance | null;
  onClose: () => void;
  onSubmit: (amount: number) => Promise<void>;
}

export function CardPaymentModal({ open, card, onClose, onSubmit }: CardPaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setAmount('');
  }, [open]);

  if (!card) return null;

  const value = Number(amount);
  const valid = amount !== '' && Number.isFinite(value) && value > 0;
  const newBalance = valid ? Math.max(0, card.balance - value) : card.balance;

  const submit = async () => {
    if (!valid) return;
    try {
      setLoading(true);
      await onSubmit(value);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar el pago');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pago a la tarjeta"
      description={`${card.name} · solo reduce la deuda (no es un gasto)`}
    >
      <div className="space-y-4">
        <Field label="Monto del pago" htmlFor="card-pay-amount">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {CURRENCY_SYMBOL}
            </span>
            <Input
              id="card-pay-amount"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="0.00"
              className="pl-7"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>
        </Field>

        <div className="rounded-[var(--radius)] bg-muted px-3 py-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Deuda actual</span>
            <span className="tabular-nums">{formatCurrency(card.balance)}</span>
          </div>
          <div className="mt-1 flex justify-between font-medium">
            <span>Nueva deuda</span>
            <span className="tabular-nums text-income">{formatCurrency(newBalance)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={loading} disabled={!valid}>
            Registrar pago
          </Button>
        </div>
      </div>
    </Modal>
  );
}
