import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PiggyBank, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SavingsAccountForm } from '@/components/savings/SavingsAccountForm';
import { useSavingsAccounts } from '@/hooks/useSavingsAccounts';
import { formatCurrency } from '@/utils/format';
import { ROUTES } from '@/constants/routes';
import type { SavingsAccountWithBalance } from '@/types/models';
import type { SavingsAccountInput } from '@/lib/validations';

export default function SavingsPage() {
  const { accounts, loading, create, update, remove } = useSavingsAccounts();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SavingsAccountWithBalance | null>(null);
  const [deleting, setDeleting] = useState<SavingsAccountWithBalance | null>(null);

  const total = useMemo(() => accounts.reduce((acc, a) => acc + a.balance, 0), [accounts]);

  const handleSubmit = async (input: SavingsAccountInput) => {
    if (editing) {
      await update(editing.id, input);
      toast.success('Cuenta actualizada');
    } else {
      await create(input);
      toast.success('Cuenta agregada');
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await remove(deleting.id);
      toast.success('Cuenta eliminada');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar');
    }
  };

  return (
    <>
      <PageHeader
        title="Ahorro"
        description="Tus cuentas y cuánto has ahorrado"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Nueva
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="Sin cuentas de ahorro"
          description="Agrega tus cuentas (bancos, cooperativa) para visualizar tu ahorro."
          action={
            <Button variant="outline" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> Agregar cuenta
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Total ahorrado</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-primary">
              {formatCurrency(total)}
            </p>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            {accounts.map((account) => (
              <Card key={account.id}>
                <CardContent className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: account.color }}
                  >
                    <Wallet className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{account.name}</p>
                    {account.institution && (
                      <p className="truncate text-xs text-muted-foreground">
                        {account.institution}
                      </p>
                    )}
                    <p className="mt-1 text-lg font-bold tabular-nums">
                      {formatCurrency(account.balance)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(account);
                        setFormOpen(true);
                      }}
                      aria-label="Editar"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(account)}
                      aria-label="Eliminar"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-expense-soft hover:text-expense"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">
            Para aportar, crea una transacción de tipo{' '}
            <Link to={ROUTES.transactions} className="font-medium text-primary hover:underline">
              Ahorro
            </Link>{' '}
            y elige la cuenta. El aporte reduce tu disponible pero no cuenta como gasto.
          </p>
        </div>
      )}

      <SavingsAccountForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        initial={editing}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar cuenta de ahorro"
        description="Se eliminará la cuenta. Los aportes quedarán sin cuenta asignada. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
