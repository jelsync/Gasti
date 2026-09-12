import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { accountReconciliationSchema, type AccountReconciliationInput } from '@/lib/validations';
import { formatCurrency } from '@/utils/format';
import { round2 } from '@/utils/finance';
import type { SavingsAccountWithBalance } from '@/types/models';

export function ReconciliationForm({
  account,
  date,
  minDate,
  maxDate,
  onClose,
  onSubmit,
}: {
  account: SavingsAccountWithBalance | null;
  date: string;
  minDate: string;
  maxDate: string;
  onClose: () => void;
  onSubmit: (input: AccountReconciliationInput) => Promise<void>;
}) {
  const [actualBalance, setActualBalance] = useState('');
  const [reconciliationDate, setReconciliationDate] = useState(date);
  const [applyAdjustment, setApplyAdjustment] = useState(true);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!account) return;
    setActualBalance(String(account.balance));
    setReconciliationDate(date);
    setApplyAdjustment(true);
    setNotes('');
    setError(null);
  }, [account, date]);

  const difference = useMemo(() => {
    if (!account || actualBalance.trim() === '') return null;
    const actual = Number(actualBalance);
    return Number.isFinite(actual) ? round2(actual - account.balance) : null;
  }, [account, actualBalance]);

  const submit = async () => {
    if (!account) return;
    const parsed = accountReconciliationSchema.safeParse({
      savings_account_id: account.id,
      reconciliation_date: reconciliationDate,
      calculated_balance: account.balance,
      actual_balance: actualBalance,
      apply_adjustment: applyAdjustment,
      notes,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revisa los datos');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await onSubmit(parsed.data);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar la conciliación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={!!account}
      onClose={onClose}
      title={`Conciliar ${account?.name ?? 'cuenta'}`}
      description="Compara el saldo que calcula Gasti con el saldo mostrado por tu banco."
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="rounded-[var(--radius)] bg-muted p-3">
          <p className="text-xs text-muted-foreground">Saldo calculado</p>
          <p className="text-xl font-bold tabular-nums">{formatCurrency(account?.balance ?? 0)}</p>
        </div>
        <Field label="Saldo real" htmlFor="actual-balance">
          <Input
            id="actual-balance"
            type="number"
            step="0.01"
            inputMode="decimal"
            value={actualBalance}
            onChange={(event) => setActualBalance(event.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Fecha de conciliación" htmlFor="reconciliation-date">
          <Input
            id="reconciliation-date"
            type="date"
            min={minDate}
            max={maxDate}
            value={reconciliationDate}
            onChange={(event) => setReconciliationDate(event.target.value)}
          />
        </Field>
        <div className="rounded-[var(--radius)] border border-border p-3 text-sm">
          Diferencia:{' '}
          <span
            className={
              (difference ?? 0) > 0
                ? 'font-semibold text-income'
                : (difference ?? 0) < 0
                  ? 'font-semibold text-expense'
                  : 'font-semibold'
            }
          >
            {difference === null ? '—' : formatCurrency(difference)}
          </span>
        </div>
        <label className="flex items-start gap-3 rounded-[var(--radius)] border border-border p-3 text-sm">
          <input
            type="checkbox"
            checked={applyAdjustment}
            onChange={(event) => setApplyAdjustment(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span>
            <span className="block font-medium">Aplicar diferencia al saldo</span>
            <span className="text-xs text-muted-foreground">
              El ajuste quedará identificado y no contará como ingreso ni gasto.
            </span>
          </span>
        </label>
        <Field label="Nota (opcional)" htmlFor="reconciliation-notes">
          <textarea
            id="reconciliation-notes"
            rows={3}
            maxLength={500}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Ej. Comisión bancaria no registrada"
            className="w-full resize-none rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Guardar conciliación
          </Button>
        </div>
      </form>
    </Modal>
  );
}
