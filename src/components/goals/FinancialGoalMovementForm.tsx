import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { financialGoalMovementSchema, type FinancialGoalMovementInput } from '@/lib/validations';
import { todayISO } from '@/utils/date';
import { formatCurrency } from '@/utils/format';
import type { FinancialGoalWithProgress } from '@/types/models';

export function FinancialGoalMovementForm({
  goal,
  defaultKind,
  onClose,
  onSubmit,
}: {
  goal: FinancialGoalWithProgress | null;
  defaultKind: FinancialGoalMovementInput['movement_kind'];
  onClose: () => void;
  onSubmit: (input: FinancialGoalMovementInput) => Promise<void>;
}) {
  const [kind, setKind] = useState(defaultKind);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!goal) return;
    setKind(defaultKind);
    setAmount('');
    setDate(todayISO());
    setNotes('');
    setError(null);
  }, [goal, defaultKind]);

  const submit = async () => {
    const parsed = financialGoalMovementSchema.safeParse({
      movement_kind: kind,
      amount,
      movement_date: date,
      notes,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revisa los datos');
      return;
    }
    if (
      parsed.data.movement_kind === 'WITHDRAWAL' &&
      parsed.data.amount > (goal?.saved_amount ?? 0)
    ) {
      setError('El retiro supera el progreso disponible');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await onSubmit(parsed.data);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el movimiento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={!!goal}
      onClose={onClose}
      title={`${kind === 'CONTRIBUTION' ? 'Aportar a' : 'Retirar de'} ${goal?.name ?? 'meta'}`}
      description={`Progreso disponible: ${formatCurrency(goal?.saved_amount ?? 0)}. Este registro no cambia el saldo bancario.`}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field label="Movimiento" htmlFor="goal-movement-kind">
          <Select
            id="goal-movement-kind"
            value={kind}
            onChange={(event) =>
              setKind(event.target.value as FinancialGoalMovementInput['movement_kind'])
            }
          >
            <option value="CONTRIBUTION">Aporte</option>
            <option value="WITHDRAWAL">Retiro</option>
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Monto" htmlFor="goal-movement-amount">
            <Input
              id="goal-movement-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Fecha" htmlFor="goal-movement-date">
            <Input
              id="goal-movement-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
        </div>
        <Field label="Nota (opcional)" htmlFor="goal-movement-notes">
          <Input
            id="goal-movement-notes"
            value={notes}
            maxLength={300}
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Guardar movimiento
          </Button>
        </div>
      </form>
    </Modal>
  );
}
