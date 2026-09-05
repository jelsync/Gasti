import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  HandCoins,
  Pencil,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { ReceivablePersonForm } from '@/components/receivables/ReceivablePersonForm';
import { ReceivableMovementModal } from '@/components/receivables/ReceivableMovementModal';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Spinner } from '@/components/ui/Spinner';
import { useReceivableMovements } from '@/hooks/useReceivableMovements';
import { useReceivables } from '@/hooks/useReceivables';
import { useSavingsAccounts } from '@/hooks/useSavingsAccounts';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/date';
import { formatCurrency, formatPercent } from '@/utils/format';
import type { ReceivablePersonWithBalance, TransactionWithCategory } from '@/types/models';
import type {
  ReceivableCreateInput,
  ReceivableMovementInput,
  ReceivablePersonInput,
} from '@/lib/validations';

const RELATIONSHIP_LABELS = {
  FAMILY: 'Familiar',
  FRIEND: 'Amigo/a',
  OTHER: 'Otra persona',
} as const;

export default function ReceivablesPage() {
  const { people, loading, error, create, update, lend, repay, removeMovement } = useReceivables();
  const { accounts, loading: accountsLoading, refresh: refreshAccounts } = useSavingsAccounts();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [personFormOpen, setPersonFormOpen] = useState(false);
  const [editing, setEditing] = useState<ReceivablePersonWithBalance | null>(null);
  const [movementFor, setMovementFor] = useState<ReceivablePersonWithBalance | null>(null);
  const [movementKind, setMovementKind] = useState<'LEND' | 'REPAYMENT'>('LEND');
  const [deletingMovement, setDeletingMovement] = useState<TransactionWithCategory | null>(null);
  const [movementRefreshKey, setMovementRefreshKey] = useState(0);

  const selected = useMemo(
    () => people.find((person) => person.id === selectedId) ?? null,
    [people, selectedId],
  );
  const totalReceivable = useMemo(
    () => people.reduce((total, person) => total + person.balance, 0),
    [people],
  );
  const {
    movements,
    loading: movementsLoading,
    error: movementsError,
  } = useReceivableMovements(selectedId, movementRefreshKey);

  useEffect(() => {
    if (people.length === 0) setSelectedId(null);
    else if (!people.some((person) => person.id === selectedId)) setSelectedId(people[0].id);
  }, [people, selectedId]);

  const handleCreate = async (input: ReceivableCreateInput) => {
    const person = await create(input);
    setSelectedId(person.id);
    await refreshAccounts();
    toast.success('Persona y préstamo registrados');
  };

  const handleUpdate = async (id: string, input: ReceivablePersonInput) => {
    await update(id, input);
    toast.success('Persona actualizada');
  };

  const openMovement = (person: ReceivablePersonWithBalance, kind: 'LEND' | 'REPAYMENT') => {
    setSelectedId(person.id);
    setMovementFor(person);
    setMovementKind(kind);
  };

  const handleMovement = async (input: ReceivableMovementInput) => {
    if (!movementFor) return;
    if (movementKind === 'LEND') await lend(movementFor, input);
    else await repay(movementFor, input);
    await refreshAccounts();
    setMovementRefreshKey((current) => current + 1);
    toast.success(movementKind === 'LEND' ? 'Préstamo adicional registrado' : 'Pago recibido');
  };

  const handleDeleteMovement = async () => {
    if (!deletingMovement) return;
    try {
      await removeMovement(deletingMovement.id);
      await refreshAccounts();
      setMovementRefreshKey((current) => current + 1);
      toast.success('Movimiento eliminado y saldo revertido');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo eliminar');
    }
  };

  return (
    <>
      <PageHeader
        title="Personas que me deben"
        description="Controla el dinero prestado y los pagos que recibes"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setPersonFormOpen(true);
            }}
            disabled={accounts.length === 0}
          >
            <Plus className="h-4 w-4" /> Nueva deuda
          </Button>
        }
      />

      {accounts.length === 0 && !loading && !accountsLoading && (
        <Card className="mb-5 border-expense/40">
          <CardContent className="text-sm text-muted-foreground">
            Primero crea una cuenta. Todo préstamo debe salir de una cuenta real y cada pago debe
            depositarse en una cuenta.
          </CardContent>
        </Card>
      )}

      {loading || accountsLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : error ? (
        <Card className="border-expense/40">
          <CardContent className="text-sm text-danger">{error}</CardContent>
        </Card>
      ) : people.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nadie te debe dinero"
          description="Registra a una persona y el monto que le prestaste para comenzar el historial."
          action={
            <Button
              variant="outline"
              onClick={() => setPersonFormOpen(true)}
              disabled={accounts.length === 0}
            >
              <Plus className="h-4 w-4" /> Registrar primera deuda
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Total pendiente por cobrar</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-income">
              {formatCurrency(totalReceivable)}
            </p>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {people.map((person) => {
              const paidPercent =
                person.totalLent > 0 ? (person.totalPaid / person.totalLent) * 100 : 0;
              const settled = person.balance <= 0;
              return (
                <Card
                  key={person.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedId === person.id}
                  onClick={() => setSelectedId(person.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedId(person.id);
                    }
                  }}
                  className={cn(
                    'cursor-pointer transition-colors hover:border-primary/60',
                    selectedId === person.id && 'border-primary ring-1 ring-primary/30',
                  )}
                >
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-income-soft text-income">
                        <Users className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{person.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {RELATIONSHIP_LABELS[person.relationship]}
                          {person.phone ? ` · ${person.phone}` : ''}
                        </p>
                        {person.notes && (
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {person.notes}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-label="Editar persona"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditing(person);
                          setPersonFormOpen(true);
                        }}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Deuda actual</p>
                      <p className="text-xl font-bold tabular-nums">
                        {formatCurrency(person.balance)}
                      </p>
                    </div>

                    <div>
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                        <span>Pagado {formatPercent(paidPercent)}</span>
                        <span>Prestado {formatCurrency(person.totalLent)}</span>
                      </div>
                      <ProgressBar value={paidPercent} color="#10b981" />
                    </div>

                    {settled ? (
                      <p className="flex items-center gap-2 text-sm font-medium text-income">
                        <CheckCircle2 className="h-4 w-4" /> Deuda pagada
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            openMovement(person, 'LEND');
                          }}
                        >
                          <ArrowUpFromLine className="h-4 w-4" /> Prestar más
                        </Button>
                        <Button
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            openMovement(person, 'REPAYMENT');
                          }}
                        >
                          <ArrowDownToLine className="h-4 w-4" /> Recibir pago
                        </Button>
                      </div>
                    )}
                    {settled && (
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          openMovement(person, 'LEND');
                        }}
                      >
                        <HandCoins className="h-4 w-4" /> Prestar nuevamente
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {selected && (
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle>Movimientos de {selected.name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Dinero entregado y pagos recibidos
                  </p>
                </div>
                <p className="font-bold tabular-nums text-income">
                  {formatCurrency(selected.balance)}
                </p>
              </CardHeader>
              <CardContent>
                {movementsLoading ? (
                  <div className="flex justify-center py-8">
                    <Spinner />
                  </div>
                ) : movementsError ? (
                  <p className="py-6 text-center text-sm text-danger">{movementsError}</p>
                ) : movements.length === 0 ? (
                  <EmptyState icon={HandCoins} title="Sin movimientos" />
                ) : (
                  <ul className="divide-y divide-border">
                    {movements.map((movement) => {
                      const isLend = movement.receivable_movement_kind === 'LEND';
                      return (
                        <li key={movement.id} className="flex items-center gap-3 py-3">
                          <span
                            className={cn(
                              'flex h-10 w-10 items-center justify-center rounded-full',
                              isLend
                                ? 'bg-expense-soft text-expense'
                                : 'bg-income-soft text-income',
                            )}
                          >
                            {isLend ? (
                              <ArrowUpFromLine className="h-5 w-5" />
                            ) : (
                              <ArrowDownToLine className="h-5 w-5" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              {isLend ? 'Dinero prestado' : 'Pago recibido'}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {movement.description ? `${movement.description} · ` : ''}
                              {formatDate(movement.transaction_date)} ·{' '}
                              {isLend
                                ? `Desde ${movement.savings_account?.name ?? 'cuenta'}`
                                : `En ${movement.destination_savings_account?.name ?? 'cuenta'}`}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'shrink-0 font-semibold tabular-nums',
                              isLend ? 'text-expense' : 'text-income',
                            )}
                          >
                            {isLend ? '+' : '−'} {formatCurrency(movement.amount)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setDeletingMovement(movement)}
                            aria-label="Eliminar movimiento"
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-expense-soft hover:text-expense"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <ReceivablePersonForm
        open={personFormOpen}
        onClose={() => setPersonFormOpen(false)}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        accounts={accounts}
        initial={editing}
      />

      <ReceivableMovementModal
        open={!!movementFor}
        kind={movementKind}
        person={movementFor}
        accounts={accounts}
        onClose={() => setMovementFor(null)}
        onSubmit={handleMovement}
      />

      <ConfirmDialog
        open={!!deletingMovement}
        title="Eliminar movimiento"
        description="Se revertirá la deuda de la persona y el saldo de la cuenta afectada."
        confirmLabel="Eliminar"
        onConfirm={handleDeleteMovement}
        onClose={() => setDeletingMovement(null)}
      />
    </>
  );
}
