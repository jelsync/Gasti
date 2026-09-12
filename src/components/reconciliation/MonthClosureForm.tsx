import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';

export function MonthClosureForm({
  open,
  existingNotes,
  updating,
  onClose,
  onSubmit,
}: {
  open: boolean;
  existingNotes: string;
  updating: boolean;
  onClose: () => void;
  onSubmit: (notes: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNotes(existingNotes);
    setError(null);
  }, [open, existingNotes]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={updating ? 'Actualizar cierre mensual' : 'Cerrar mes'}
      description="Se guardará una fotografía de saldos, ingresos, gastos y deudas. Podrás seguir corrigiendo información y actualizarla después."
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setLoading(true);
          setError(null);
          void onSubmit(notes)
            .then(onClose)
            .catch((cause) =>
              setError(cause instanceof Error ? cause.message : 'No se pudo cerrar el mes'),
            )
            .finally(() => setLoading(false));
        }}
      >
        <Field label="Notas del cierre (opcional)" htmlFor="closure-notes">
          <textarea
            id="closure-notes"
            rows={4}
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
            {updating ? 'Actualizar fotografía' : 'Guardar cierre'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
