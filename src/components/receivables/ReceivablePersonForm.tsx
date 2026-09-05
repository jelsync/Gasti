import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import {
  receivableCreateSchema,
  receivablePersonSchema,
  type ReceivableCreateInput,
  type ReceivablePersonInput,
} from '@/lib/validations';
import { todayISO } from '@/utils/date';
import { formatCurrency } from '@/utils/format';
import type { ReceivablePersonWithBalance, SavingsAccountWithBalance } from '@/types/models';

interface ReceivablePersonFormProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: ReceivableCreateInput) => Promise<void>;
  onUpdate: (id: string, input: ReceivablePersonInput) => Promise<void>;
  accounts: SavingsAccountWithBalance[];
  initial?: ReceivablePersonWithBalance | null;
}

export function ReceivablePersonForm({
  open,
  onClose,
  onCreate,
  onUpdate,
  accounts,
  initial,
}: ReceivablePersonFormProps) {
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState<'FAMILY' | 'FRIEND' | 'OTHER'>('FRIEND');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setRelationship(initial?.relationship ?? 'FRIEND');
    setPhone(initial?.phone ?? '');
    setNotes(initial?.notes ?? '');
    setAmount('');
    setAccountId(accounts[0]?.id ?? '');
    setDate(todayISO());
    setDescription('');
    setError(null);
  }, [open, initial, accounts]);

  const submit = async () => {
    const personValues = { name, relationship, phone, notes };
    const parsed = initial
      ? receivablePersonSchema.safeParse(personValues)
      : receivableCreateSchema.safeParse({
          ...personValues,
          initial_amount: amount,
          account_id: accountId,
          movement_date: date,
          description,
        });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revisa los datos');
      return;
    }

    try {
      setLoading(true);
      if (initial) await onUpdate(initial.id, parsed.data as ReceivablePersonInput);
      else await onCreate(parsed.data as ReceivableCreateInput);
      onClose();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo guardar');
    } finally {
      setLoading(false);
    }
  };

  const selectedAccount = accounts.find((account) => account.id === accountId);

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar persona' : 'Nueva deuda'}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        noValidate
      >
        <Field label="Nombre" htmlFor="receivable-name">
          <Input
            id="receivable-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej. Carlos"
            autoFocus
          />
        </Field>

        <Field label="Relación" htmlFor="receivable-relationship">
          <Select
            id="receivable-relationship"
            value={relationship}
            onChange={(event) =>
              setRelationship(event.target.value as 'FAMILY' | 'FRIEND' | 'OTHER')
            }
          >
            <option value="FAMILY">Familiar</option>
            <option value="FRIEND">Amigo/a</option>
            <option value="OTHER">Otra persona</option>
          </Select>
        </Field>

        <Field label="Teléfono (opcional)" htmlFor="receivable-phone">
          <Input
            id="receivable-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Ej. 9999-9999"
          />
        </Field>

        <Field label="Notas (opcional)" htmlFor="receivable-notes">
          <Input
            id="receivable-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Acuerdo o recordatorio"
          />
        </Field>

        {!initial && (
          <>
            <Field label="Monto prestado" htmlFor="receivable-amount">
              <Input
                id="receivable-amount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
              />
            </Field>

            <Field
              label="Entregar desde cuenta"
              htmlFor="receivable-account"
              hint={
                selectedAccount
                  ? `Saldo disponible: ${formatCurrency(selectedAccount.balance)}`
                  : 'Primero debes crear una cuenta.'
              }
            >
              <Select
                id="receivable-account"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
              >
                <option value="">Selecciona una cuenta…</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Fecha" htmlFor="receivable-date">
              <Input
                id="receivable-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>

            <Field label="Descripción (opcional)" htmlFor="receivable-description">
              <Input
                id="receivable-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Ej. Emergencia médica"
              />
            </Field>
          </>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading} disabled={!initial && accounts.length === 0}>
            {initial ? 'Guardar cambios' : 'Registrar préstamo'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
