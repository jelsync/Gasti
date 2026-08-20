import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { applyExtraPrincipal } from '@/utils/loan';
import { CURRENCY_SYMBOL, formatCurrency } from '@/utils/format';
import type { LoanWithCategory } from '@/types/models';

interface ExtraPaymentModalProps {
  open: boolean;
  loan: LoanWithCategory | null;
  onClose: () => void;
  onSubmit: (amount: number) => Promise<void>;
}

export function ExtraPaymentModal({ open, loan, onClose, onSubmit }: ExtraPaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && loan) setAmount(loan.extra_payment ? String(loan.extra_payment) : '');
  }, [open, loan]);

  if (!loan) return null;

  const value = Number(amount);
  const valid = amount !== '' && Number.isFinite(value) && value > 0;
  const newBalance = valid
    ? applyExtraPrincipal(loan.current_balance, value)
    : loan.current_balance;

  const submit = async () => {
    if (!valid) return;
    try {
      setLoading(true);
      await onSubmit(value);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar el abono');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Abono a capital"
      description={`${loan.name} · va 100% al capital`}
    >
      <div className="space-y-4">
        <Field
          label="Monto del abono"
          htmlFor="extra-amount"
          hint={loan.extra_payment ? 'Prellenado con tu abono habitual.' : undefined}
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {CURRENCY_SYMBOL}
            </span>
            <Input
              id="extra-amount"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="5,000.00"
              className="pl-7"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>
        </Field>

        <div className="rounded-[var(--radius)] bg-muted px-3 py-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Saldo actual</span>
            <span className="tabular-nums">{formatCurrency(loan.current_balance)}</span>
          </div>
          <div className="mt-1 flex justify-between font-medium">
            <span>Nuevo saldo</span>
            <span className="tabular-nums text-income">{formatCurrency(newBalance)}</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Se registrará un gasto por {formatCurrency(valid ? value : 0)}
          {loan.category ? ` en «${loan.category.name}»` : ''} y el saldo bajará por el monto
          completo.
        </p>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={loading} disabled={!valid}>
            Registrar abono
          </Button>
        </div>
      </div>
    </Modal>
  );
}
