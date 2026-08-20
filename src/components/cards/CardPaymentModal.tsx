import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { CURRENCY_SYMBOLS, formatMoney } from '@/utils/format';
import type { CreditCardWithBalance } from '@/types/models';

export interface CardPaymentArgs {
  amount: number;
  amountHnl?: number | null;
}

interface CardPaymentModalProps {
  open: boolean;
  card: CreditCardWithBalance | null;
  onClose: () => void;
  onSubmit: (args: CardPaymentArgs) => Promise<void>;
}

export function CardPaymentModal({ open, card, onClose, onSubmit }: CardPaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [amountHnl, setAmountHnl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount('');
      setAmountHnl('');
    }
  }, [open]);

  if (!card) return null;

  const isUsd = card.currency === 'USD';
  const value = Number(amount);
  const valueHnl = Number(amountHnl);
  const validAmount = amount !== '' && Number.isFinite(value) && value > 0;
  const validHnl = !isUsd || (amountHnl !== '' && Number.isFinite(valueHnl) && valueHnl > 0);
  const valid = validAmount && validHnl;
  const newBalance = validAmount ? Math.max(0, card.balance - value) : card.balance;

  const submit = async () => {
    if (!valid) return;
    try {
      setLoading(true);
      await onSubmit({ amount: value, amountHnl: isUsd ? valueHnl : null });
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
      description={
        isUsd
          ? `${card.name} · el abono en dólares baja la deuda; el pago en lempiras es el gasto`
          : `${card.name} · solo reduce la deuda (no es un gasto)`
      }
    >
      <div className="space-y-4">
        <Field
          label={isUsd ? 'Abono en dólares (USD)' : 'Monto del pago'}
          htmlFor="card-pay-amount"
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {CURRENCY_SYMBOLS[card.currency]}
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

        {isUsd && (
          <Field
            label="Pago en lempiras (L)"
            htmlFor="card-pay-hnl"
            hint="Lo que realmente pagaste en lempiras. Se registra como gasto."
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                L
              </span>
              <Input
                id="card-pay-hnl"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="0.00"
                className="pl-7"
                value={amountHnl}
                onChange={(e) => setAmountHnl(e.target.value)}
              />
            </div>
          </Field>
        )}

        <div className="rounded-[var(--radius)] bg-muted px-3 py-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Deuda actual</span>
            <span className="tabular-nums">{formatMoney(card.balance, card.currency)}</span>
          </div>
          <div className="mt-1 flex justify-between font-medium">
            <span>Nueva deuda</span>
            <span className="tabular-nums text-income">
              {formatMoney(newBalance, card.currency)}
            </span>
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
