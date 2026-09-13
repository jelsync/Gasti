import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { HIDDEN_AMOUNT, PrivacyToggle } from '@/components/ui/PrivacyToggle';
import { PRIVACY_KEYS, usePrivacy } from '@/contexts/privacy';
import { mapDbError } from '@/lib/errors';
import {
  getRecurringCandidates,
  type RecurringConfirmationInput,
} from '@/services/recurring.service';
import type { RecurringTransactionWithRelations, Transaction } from '@/types/models';
import { formatDate, todayISO } from '@/utils/date';
import { formatMoney } from '@/utils/format';

interface Props {
  rule: RecurringTransactionWithRelations;
  dueDate: string;
  onClose: () => void;
  onConfirm: (input: RecurringConfirmationInput) => Promise<void>;
}

export function RecurringConfirmationModal({ rule, dueDate, onClose, onConfirm }: Props) {
  const today = todayISO();
  const [transactionDate, setTransactionDate] = useState(dueDate < today ? dueDate : today);
  const [amount, setAmount] = useState(String(rule.amount));
  const [candidates, setCandidates] = useState<Transaction[]>([]);
  const [choice, setChoice] = useState('');
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const { isHidden } = usePrivacy();
  const hidden = rule.type === 'INCOME' && isHidden(PRIVACY_KEYS.income);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setChoice('');
    setAllowDuplicate(false);
    void getRecurringCandidates(rule.id, dueDate)
      .then((rows) => {
        if (!cancelled) {
          setCandidates(rows);
          if (!rows.length) setChoice('new');
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(mapDbError(error, 'No se pudieron revisar los movimientos.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rule.id, dueDate, reload]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!choice || saving || loading || loadError) return;
    try {
      setSaving(true);
      setSubmitError(null);
      await onConfirm({
        transactionDate,
        amount: Number(amount),
        existingTransactionId: choice === 'new' ? undefined : choice,
        allowDuplicate: choice === 'new' && allowDuplicate,
      });
      onClose();
    } catch (error) {
      setSubmitError(mapDbError(error, 'No se pudo confirmar el movimiento.'));
      setReload((value) => value + 1);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => {
        if (!saving) onClose();
      }}
      title={`Confirmar ${rule.name}`}
      description={`Programado para ${formatDate(dueDate)} · ${rule.category?.name ?? 'Sin categoría'} · ${rule.credit_card?.name ?? rule.savings_account?.name ?? 'Sin cuenta'}`}
    >
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Si ya lo registraste, vincula ese movimiento para atender el recordatorio sin volver a
          cobrarlo.
        </p>
        {rule.type === 'INCOME' && <PrivacyToggle privacyKey={PRIVACY_KEYS.income} />}
        {loading ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : loadError ? (
          <div role="alert" className="space-y-2 text-sm text-danger">
            <p>{loadError}</p>
            <Button type="button" variant="outline" onClick={() => setReload((value) => value + 1)}>
              Reintentar revisión
            </Button>
          </div>
        ) : (
          <>
            {candidates.length > 0 && (
              <fieldset disabled={saving} className="space-y-2">
                <legend className="mb-2 text-sm font-medium">
                  Movimientos que podrían corresponder
                </legend>
                <p className="text-xs text-muted-foreground">
                  Misma categoría, moneda y cuenta o tarjeta, hasta 31 días antes o después. Revisa
                  fecha e importe.
                </p>
                {candidates.map((movement) => (
                  <label
                    key={movement.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm"
                  >
                    <input
                      type="radio"
                      name="confirmation-choice"
                      value={movement.id}
                      checked={choice === movement.id}
                      onChange={() => {
                        setChoice(movement.id);
                        setAllowDuplicate(false);
                      }}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-medium">
                        {formatDate(movement.transaction_date)} ·{' '}
                        {hidden ? HIDDEN_AMOUNT : formatMoney(movement.amount, movement.currency)}
                      </span>
                      <span className="text-muted-foreground">
                        {movement.description || 'Sin descripción'}
                      </span>
                    </span>
                  </label>
                ))}
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm">
                  <input
                    type="radio"
                    name="confirmation-choice"
                    checked={choice === 'new'}
                    onChange={() => setChoice('new')}
                    className="mt-1"
                  />
                  <span>Registrar un movimiento distinto</span>
                </label>
              </fieldset>
            )}
            {choice === 'new' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 text-sm">
                    Fecha real
                    <Input
                      aria-label="Fecha real"
                      type="date"
                      value={transactionDate}
                      max={today}
                      required
                      disabled={saving}
                      onChange={(event) => setTransactionDate(event.target.value)}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    Monto ({rule.currency})
                    <Input
                      aria-label="Monto"
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      required
                      value={amount}
                      disabled={saving}
                      onChange={(event) => setAmount(event.target.value)}
                    />
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  El presupuesto usará la fecha real. La fecha del recordatorio y los siguientes
                  meses se conservan. Puedes registrar hasta 31 días antes o después de la fecha
                  programada, sin usar fechas futuras.
                </p>
                {candidates.length > 0 && (
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={allowDuplicate}
                      disabled={saving}
                      onChange={(event) => setAllowDuplicate(event.target.checked)}
                      className="mt-1"
                    />
                    Confirmo que revisé los movimientos y este es otro ingreso o gasto.
                  </label>
                )}
              </>
            )}
            {choice && choice !== 'new' && (
              <p className="text-sm text-muted-foreground">
                Se conservarán el importe y la fecha del movimiento seleccionado. No se creará otra
                transacción ni compra con tarjeta.
              </p>
            )}
          </>
        )}
        {submitError && (
          <p role="alert" className="text-sm text-danger">
            {submitError}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={saving}
            disabled={
              loading ||
              !!loadError ||
              !choice ||
              (choice === 'new' && candidates.length > 0 && !allowDuplicate)
            }
          >
            {choice && choice !== 'new' ? 'Vincular y confirmar' : 'Registrar y confirmar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
