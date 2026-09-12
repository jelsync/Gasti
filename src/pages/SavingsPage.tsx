import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowLeftRight,
  CircleEqual,
  Copy,
  Landmark,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CategoryIcon } from '@/components/CategoryIcon';
import { SavingsAccountForm } from '@/components/savings/SavingsAccountForm';
import { useSavingsAccounts } from '@/hooks/useSavingsAccounts';
import { useSavingsAccountMovements } from '@/hooks/useSavingsAccountMovements';
import { formatCurrency } from '@/utils/format';
import { formatDate } from '@/utils/date';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';
import { HIDDEN_AMOUNT, PrivacyToggle } from '@/components/ui/PrivacyToggle';
import { PRIVACY_KEYS, usePrivacy } from '@/contexts/privacy';
import type { SavingsAccountWithBalance } from '@/types/models';
import type { SavingsAccountInput } from '@/lib/validations';

export default function SavingsPage() {
  const navigate = useNavigate();
  const { isHidden } = usePrivacy();
  const { accounts, loading, create, update, remove } = useSavingsAccounts();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SavingsAccountWithBalance | null>(null);
  const [deleting, setDeleting] = useState<SavingsAccountWithBalance | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const total = useMemo(() => accounts.reduce((acc, a) => acc + a.balance, 0), [accounts]);
  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  );
  const {
    movements,
    loading: movementsLoading,
    error: movementsError,
  } = useSavingsAccountMovements(selectedAccountId);

  useEffect(() => {
    if (accounts.length === 0) {
      setSelectedAccountId(null);
    } else if (!accounts.some((account) => account.id === selectedAccountId)) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

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

  const copyAccountNumber = async (accountNumber: string) => {
    try {
      await navigator.clipboard.writeText(accountNumber);
      toast.success('Número de cuenta copiado');
    } catch {
      toast.error('No se pudo copiar el número de cuenta');
    }
  };

  return (
    <>
      <PageHeader
        title="Cuentas"
        description="Consulta tus saldos y los movimientos depositados en cada cuenta"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`${ROUTES.transactions}?new=transfer`)}
              disabled={accounts.length < 2}
            >
              <ArrowLeftRight className="h-4 w-4" /> Transferir
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Nueva
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Sin cuentas"
          description="Agrega tus cuentas bancarias o de cooperativa para registrar depósitos."
          action={
            <Button variant="outline" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> Agregar cuenta
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Saldo total en cuentas</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-primary">
                  {isHidden(PRIVACY_KEYS.accountsTotal) ? HIDDEN_AMOUNT : formatCurrency(total)}
                </p>
              </div>
              <PrivacyToggle privacyKey={PRIVACY_KEYS.accountsTotal} />
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            {accounts.map((account) => (
              <Card
                key={account.id}
                role="button"
                tabIndex={0}
                aria-pressed={selectedAccountId === account.id}
                onClick={() => setSelectedAccountId(account.id)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedAccountId(account.id);
                  }
                }}
                className={cn(
                  'cursor-pointer transition-colors hover:border-primary/60',
                  selectedAccountId === account.id && 'border-primary ring-1 ring-primary/30',
                )}
              >
                <CardContent className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: account.color }}
                  >
                    <Wallet className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{account.name}</p>
                      {account.include_in_savings_goal && (
                        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-primary">
                          Meta de ahorro
                        </span>
                      )}
                    </div>
                    {account.account_number && (
                      <p className="truncate text-xs text-muted-foreground">
                        Cuenta: {account.account_number}
                      </p>
                    )}
                    <p className="mt-1 text-lg font-bold tabular-nums">
                      {isHidden(PRIVACY_KEYS.account(account.id))
                        ? HIDDEN_AMOUNT
                        : formatCurrency(account.balance)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <PrivacyToggle privacyKey={PRIVACY_KEYS.account(account.id)} />
                    {account.account_number && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void copyAccountNumber(account.account_number);
                        }}
                        aria-label={`Copiar número de ${account.name}`}
                        title="Copiar número de cuenta"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
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
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeleting(account);
                      }}
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

          {selectedAccount && (
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle>Movimientos de {selectedAccount.name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ingresos, gastos y transferencias de esta cuenta
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="font-bold tabular-nums text-primary">
                    {isHidden(PRIVACY_KEYS.account(selectedAccount.id))
                      ? HIDDEN_AMOUNT
                      : formatCurrency(selectedAccount.balance)}
                  </span>
                  <PrivacyToggle privacyKey={PRIVACY_KEYS.account(selectedAccount.id)} />
                </div>
              </CardHeader>
              <CardContent>
                {movementsLoading ? (
                  <div className="flex justify-center py-8">
                    <Spinner />
                  </div>
                ) : movementsError ? (
                  <p className="py-6 text-center text-sm text-danger">{movementsError}</p>
                ) : movements.length === 0 && selectedAccount.opening_balance === 0 ? (
                  <EmptyState
                    icon={ArrowDownToLine}
                    title="Sin movimientos"
                    description="Cuando deposites un ingreso o debites un gasto aparecerá aquí."
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {movements.map((movement) => {
                      if (movement.kind === 'RECONCILIATION') {
                        const adjustment = movement.reconciliation.difference;
                        const outgoing = adjustment < 0;
                        return (
                          <li key={movement.id} className="flex items-center gap-3 py-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-primary">
                              <CircleEqual className="h-5 w-5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium">Ajuste de conciliación</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {movement.reconciliation.notes
                                  ? `${movement.reconciliation.notes} · `
                                  : ''}
                                {formatDate(movement.date)}
                              </p>
                            </div>
                            <span
                              className={cn(
                                'shrink-0 font-semibold tabular-nums',
                                outgoing ? 'text-expense' : 'text-income',
                              )}
                            >
                              {isHidden(PRIVACY_KEYS.account(selectedAccount.id))
                                ? HIDDEN_AMOUNT
                                : `${outgoing ? '−' : '+'} ${formatCurrency(Math.abs(adjustment))}`}
                            </span>
                          </li>
                        );
                      }
                      const transaction = movement.transaction;
                      const isIncome = transaction.type === 'INCOME';
                      const isExpense = transaction.type === 'EXPENSE';
                      const isTransfer = transaction.type === 'TRANSFER';
                      const isIncomingTransfer =
                        isTransfer &&
                        transaction.destination_savings_account_id === selectedAccount.id;
                      const isOutgoing = isExpense || (isTransfer && !isIncomingTransfer);
                      return (
                        <li key={movement.id} className="flex items-center gap-3 py-3">
                          <CategoryIcon
                            icon={
                              isTransfer
                                ? transaction.credit_card
                                  ? 'credit-card'
                                  : 'arrow-left-right'
                                : isIncome || isExpense
                                  ? (transaction.category?.icon ??
                                    (isIncome ? 'circle-plus' : 'circle'))
                                  : 'piggy-bank'
                            }
                            color={
                              isTransfer
                                ? isIncomingTransfer
                                  ? '#10b981'
                                  : '#0ea5e9'
                                : isIncome || isExpense
                                  ? (transaction.category?.color ?? '#10b981')
                                  : selectedAccount.color
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              {isTransfer
                                ? transaction.receivable_person
                                  ? transaction.receivable_movement_kind === 'LEND'
                                    ? `Préstamo a ${transaction.receivable_person.name}`
                                    : `Pago recibido de ${transaction.receivable_person.name}`
                                  : isIncomingTransfer
                                    ? `Transferencia recibida de ${transaction.savings_account?.name ?? 'otra cuenta'}`
                                    : transaction.credit_card
                                      ? `Pago de ${transaction.credit_card.name}`
                                      : `Transferencia enviada a ${transaction.destination_savings_account?.name ?? 'otra cuenta'}`
                                : isIncome
                                  ? (transaction.category?.name ?? 'Ingreso')
                                  : isExpense
                                    ? (transaction.category?.name ?? 'Débito')
                                    : 'Aporte'}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {transaction.description ? `${transaction.description} · ` : ''}
                              {formatDate(transaction.transaction_date)}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'shrink-0 font-semibold tabular-nums',
                              isOutgoing ? 'text-expense' : 'text-income',
                            )}
                          >
                            {isHidden(PRIVACY_KEYS.account(selectedAccount.id))
                              ? HIDDEN_AMOUNT
                              : `${isOutgoing ? '−' : '+'} ${formatCurrency(transaction.amount)}`}
                          </span>
                        </li>
                      );
                    })}
                    {selectedAccount.opening_balance > 0 && (
                      <li className="flex items-center gap-3 py-3">
                        <span
                          className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                          style={{ backgroundColor: selectedAccount.color }}
                        >
                          <Landmark className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">Saldo inicial</p>
                          <p className="text-xs text-muted-foreground">
                            Registrado al crear la cuenta
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold tabular-nums text-income">
                          {isHidden(PRIVACY_KEYS.account(selectedAccount.id))
                            ? HIDDEN_AMOUNT
                            : `+ ${formatCurrency(selectedAccount.opening_balance)}`}
                        </span>
                      </li>
                    )}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          <p className="text-sm text-muted-foreground">
            Al registrar un{' '}
            <Link to={ROUTES.transactions} className="font-medium text-primary hover:underline">
              ingreso
            </Link>{' '}
            puedes elegir una cuenta. El movimiento seguirá contando como ingreso en el dashboard y
            aumentará el saldo de la cuenta seleccionada.
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
        title="Eliminar cuenta"
        description="Se eliminará la cuenta. Sus movimientos quedarán sin cuenta asignada, pero las transacciones no se borrarán. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
