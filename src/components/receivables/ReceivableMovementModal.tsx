import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { receivableMovementSchema, type ReceivableMovementInput } from '@/lib/validations';
import { todayISO } from '@/utils/date';
import { formatCurrency } from '@/utils/format';
import type { ReceivablePersonWithBalance, SavingsAccountWithBalance } from '@/types/models';

interface ReceivableMovementModalProps {
  open: boolean;
  kind: 'LEND' | 'REPAYMENT';
  person: ReceivablePersonWithBalance | null;
  accounts: SavingsAccountWithBalance[];
  onClose: () => void;
  onSubmit: (input: ReceivableMovementInput) => Promise<void>;
}

export function ReceivableMovementModal({
  open,
  kind,
  person,
  accounts,
  onClose,
  onSubmit,
}: ReceivableMovementModalProps) {
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount('');
    setAccountId(accounts[0]?.id ?? '');
    setDate(todayISO());
    setDescription('');
    setError(null);
  }, [open, accounts]);

  if (!person) return null;

  const submit = async () => {
    const parsed = receivableMovementSchema.safeParse({
      amount,
      account_id: accountId,
      movement_date: date,
      description,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revisa los datos');
      return;
    }
    if (kind === 'REPAYMENT' && parsed.data.amount > person.balance) {
      setError(`El pago máximo es ${formatCurrency(person.balance)}.`);
      return;
    }
    try {
      setLoading(true);
      await onSubmit(parsed.data);
      onClose();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo registrar');
    } finally {
      setLoading(false);
    }
  };

  const selectedAccount = accounts.find((account) => account.id === accountId);
  const isRepayment = kind === 'REPAYMENT';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isRepayment ? 'Registrar pago recibido' : 'Prestar más dinero'}
      description={`${person.name} · deuda actual ${formatCurrency(person.balance)}`}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        noValidate
      >
        <Field label={isRepayment ? 'Monto recibido' : 'Monto prestado'} htmlFor="movement-amount">
          <Input
            id="movement-amount"
            type="number"
            min="0"
            max={isRepayment ? person.balance : undefined}
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            autoFocus
          />
        </Field>

        <Field
          label={isRepayment ? 'Depositar en cuenta' : 'Entregar desde cuenta'}
          htmlFor="movement-account"
          hint={selectedAccount ? `Saldo actual: ${formatCurrency(selectedAccount.balance)}` : ''}
        >
          <Select
            id="movement-account"
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

        <Field label="Fecha" htmlFor="movement-date">
          <Input
            id="movement-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>

        <Field label="Descripción (opcional)" htmlFor="movement-description">
          <Input
            id="movement-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={isRepayment ? 'Ej. Primer abono' : 'Ej. Préstamo adicional'}
          />
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading} disabled={accounts.length === 0}>
            {isRepayment ? 'Registrar pago' : 'Registrar préstamo'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
