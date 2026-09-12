import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { financialGoalSchema, type FinancialGoalInput } from '@/lib/validations';
import type { FinancialGoalWithProgress, SavingsAccountWithBalance } from '@/types/models';

const GOAL_TYPES = [
  ['EMERGENCY', 'Fondo de emergencia'],
  ['TRAVEL', 'Viaje'],
  ['VEHICLE', 'Vehículo'],
  ['HOME', 'Vivienda'],
  ['EDUCATION', 'Educación'],
  ['OTHER', 'Otra'],
] as const;

export function FinancialGoalForm({
  open,
  initial,
  accounts,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initial?: FinancialGoalWithProgress | null;
  accounts: SavingsAccountWithBalance[];
  onClose: () => void;
  onSubmit: (input: FinancialGoalInput) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [goalType, setGoalType] = useState<FinancialGoalInput['goal_type']>('EMERGENCY');
  const [targetAmount, setTargetAmount] = useState('');
  const [startingAmount, setStartingAmount] = useState('0');
  const [targetDate, setTargetDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [color, setColor] = useState('#0ea5e9');
  const [status, setStatus] = useState<FinancialGoalInput['status']>('ACTIVE');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setGoalType(initial?.goal_type ?? 'EMERGENCY');
    setTargetAmount(initial ? String(initial.target_amount) : '');
    setStartingAmount(initial ? String(initial.starting_amount) : '0');
    setTargetDate(initial?.target_date ?? '');
    setAccountId(initial?.savings_account_id ?? '');
    setColor(initial?.color ?? '#0ea5e9');
    setStatus(initial?.status ?? 'ACTIVE');
    setNotes(initial?.notes ?? '');
    setError(null);
  }, [open, initial]);

  const submit = async () => {
    const parsed = financialGoalSchema.safeParse({
      name,
      goal_type: goalType,
      target_amount: targetAmount,
      starting_amount: startingAmount,
      target_date: targetDate,
      savings_account_id: accountId || null,
      color,
      status,
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
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar la meta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Editar meta' : 'Nueva meta financiera'}
      description="Define un objetivo independiente de tu presupuesto mensual."
      className="sm:max-w-xl"
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" htmlFor="goal-name">
            <Input
              id="goal-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Fondo de emergencia"
              autoFocus
            />
          </Field>
          <Field label="Tipo" htmlFor="goal-type">
            <Select
              id="goal-type"
              value={goalType}
              onChange={(event) =>
                setGoalType(event.target.value as FinancialGoalInput['goal_type'])
              }
            >
              {GOAL_TYPES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Monto objetivo" htmlFor="goal-target">
            <Input
              id="goal-target"
              type="number"
              min="0"
              step="0.01"
              value={targetAmount}
              onChange={(event) => setTargetAmount(event.target.value)}
            />
          </Field>
          <Field
            label="Progreso inicial"
            htmlFor="goal-starting"
            hint={
              initial
                ? 'No cambia al editar; usa aportes o retiros para corregir el progreso.'
                : 'Solo úsalo para dinero que ya tenías reservado.'
            }
          >
            <Input
              id="goal-starting"
              type="number"
              min="0"
              step="0.01"
              disabled={!!initial}
              value={startingAmount}
              onChange={(event) => setStartingAmount(event.target.value)}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fecha objetivo (opcional)" htmlFor="goal-date">
            <Input
              id="goal-date"
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
            />
          </Field>
          <Field
            label="Cuenta vinculada (opcional)"
            htmlFor="goal-account"
            hint="Indica dónde mantienes el dinero reservado."
          >
            <Select
              id="goal-account"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              <option value="">Sin vincular todavía</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Estado" htmlFor="goal-status">
            <Select
              id="goal-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as FinancialGoalInput['status'])}
            >
              <option value="ACTIVE">Activa</option>
              <option value="PAUSED">Pausada</option>
              <option value="COMPLETED">Completada</option>
            </Select>
          </Field>
          <Field label="Color" htmlFor="goal-color">
            <Input
              id="goal-color"
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              className="cursor-pointer p-1"
            />
          </Field>
        </div>
        <Field label="Notas (opcional)" htmlFor="goal-notes">
          <textarea
            id="goal-notes"
            rows={3}
            maxLength={500}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="w-full resize-none rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Guardar meta
          </Button>
        </div>
      </form>
    </Modal>
  );
}
