import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarDays,
  Car,
  CircleDollarSign,
  GraduationCap,
  HeartPulse,
  Home,
  Pencil,
  Plane,
  Plus,
  ShieldCheck,
  Target,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { MonthSelector } from '@/components/MonthSelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FinancialGoalForm } from '@/components/goals/FinancialGoalForm';
import { FinancialGoalMovementForm } from '@/components/goals/FinancialGoalMovementForm';
import { useFinancialGoalMovements, useFinancialGoals } from '@/hooks/useFinancialGoals';
import { useSavingsAccounts } from '@/hooks/useSavingsAccounts';
import { useTransactions } from '@/hooks/useTransactions';
import { useLoans } from '@/hooks/useLoans';
import { useCreditCards } from '@/hooks/useCreditCards';
import { calculateFinancialHealth, requiredMonthlyContribution } from '@/utils/financialHealth';
import { formatDate, getCurrentMonthYear, monthRange, previousMonth, todayISO } from '@/utils/date';
import { formatMoney, formatPercent } from '@/utils/format';
import { cn } from '@/lib/utils';
import type { FinancialGoalMovementKind, FinancialGoalType } from '@/types/models';
import type { FinancialGoalInput, FinancialGoalMovementInput } from '@/lib/validations';

const GOAL_LABELS: Record<FinancialGoalType, string> = {
  EMERGENCY: 'Emergencia',
  TRAVEL: 'Viaje',
  VEHICLE: 'Vehículo',
  HOME: 'Vivienda',
  EDUCATION: 'Educación',
  OTHER: 'Otra meta',
};

const GOAL_ICONS = {
  EMERGENCY: ShieldCheck,
  TRAVEL: Plane,
  VEHICLE: Car,
  HOME: Home,
  EDUCATION: GraduationCap,
  OTHER: Target,
} satisfies Record<FinancialGoalType, typeof Target>;

export default function FinancialGoalsPage() {
  const [month, setMonth] = useState(getCurrentMonthYear);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [movementKind, setMovementKind] = useState<FinancialGoalMovementKind | null>(null);
  const [movementRefreshKey, setMovementRefreshKey] = useState(0);

  const { goals, loading, error, create, update, remove, addMovement } = useFinancialGoals();
  const { accounts, loading: accountsLoading } = useSavingsAccounts();
  const { loans, loading: loansLoading } = useLoans();
  const { cards, loading: cardsLoading } = useCreditCards();
  const currentRange = useMemo(() => monthRange(month.year, month.month), [month]);
  const priorMonth = useMemo(() => previousMonth(month), [month]);
  const priorRange = useMemo(() => monthRange(priorMonth.year, priorMonth.month), [priorMonth]);
  const transactionFilters = useMemo(
    () => ({ dateStart: priorRange.start, dateEnd: currentRange.end }),
    [priorRange.start, currentRange.end],
  );
  const { transactions, loading: transactionsLoading } = useTransactions(transactionFilters);
  const selectedGoal = goals.find((goal) => goal.id === selectedGoalId) ?? null;
  const editingGoal = goals.find((goal) => goal.id === editingId) ?? null;
  const deletingGoal = goals.find((goal) => goal.id === deletingId) ?? null;
  const movementGoal = movementKind ? selectedGoal : null;
  const {
    movements,
    loading: movementsLoading,
    error: movementsError,
  } = useFinancialGoalMovements(selectedGoalId, movementRefreshKey);

  useEffect(() => {
    if (goals.length === 0) setSelectedGoalId(null);
    else if (!goals.some((goal) => goal.id === selectedGoalId)) setSelectedGoalId(goals[0].id);
  }, [goals, selectedGoalId]);

  const currentTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.transaction_date >= currentRange.start &&
          transaction.transaction_date <= currentRange.end,
      ),
    [transactions, currentRange],
  );
  const previousTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.transaction_date >= priorRange.start &&
          transaction.transaction_date <= priorRange.end,
      ),
    [transactions, priorRange],
  );
  const health = useMemo(
    () => calculateFinancialHealth(currentTransactions, previousTransactions, loans, cards),
    [currentTransactions, previousTransactions, loans, cards],
  );
  const totalGoalProgress = goals.reduce((total, goal) => total + goal.saved_amount, 0);
  const activeGoals = goals.filter((goal) => goal.status === 'ACTIVE').length;
  const completedGoals = goals.filter((goal) => goal.status === 'COMPLETED').length;
  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );
  const reservedByAccount = useMemo(() => {
    const totals = new Map<string, number>();
    for (const goal of goals) {
      if (!goal.savings_account_id) continue;
      totals.set(
        goal.savings_account_id,
        (totals.get(goal.savings_account_id) ?? 0) + goal.saved_amount,
      );
    }
    return totals;
  }, [goals]);
  const isLoading =
    loading || accountsLoading || loansLoading || cardsLoading || transactionsLoading;

  const saveGoal = async (input: FinancialGoalInput) => {
    if (editingGoal) {
      await update(editingGoal.id, input);
      toast.success('Meta actualizada');
    } else {
      await create(input);
      toast.success('Meta creada');
    }
  };

  const saveMovement = async (input: FinancialGoalMovementInput) => {
    if (!selectedGoal) return;
    await addMovement(selectedGoal.id, input);
    setMovementRefreshKey((value) => value + 1);
    toast.success(
      input.movement_kind === 'CONTRIBUTION' ? 'Aporte registrado' : 'Retiro registrado',
    );
  };

  return (
    <>
      <PageHeader
        title="Metas y salud financiera"
        description="Reserva dinero para objetivos y entiende tus indicadores mensuales"
        actions={
          <div className="flex flex-wrap gap-2">
            <MonthSelector value={month} onChange={setMonth} />
            <Button
              onClick={() => {
                setEditingId(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Nueva meta
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : error ? (
        <p className="py-10 text-center text-sm text-danger">{error}</p>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HeartPulse className="h-5 w-5 text-primary" /> Salud financiera del mes
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Los porcentajes usan ingresos y gastos HNL. Las deudas USD se muestran aparte.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <HealthMetric
                label="Tasa de ahorro"
                value={
                  health.savingsRate === null ? 'Sin ingresos' : formatPercent(health.savingsRate)
                }
                detail="(Ingresos − gastos) ÷ ingresos"
                tone={(health.savingsRate ?? 0) >= 20 ? 'positive' : 'neutral'}
              />
              <HealthMetric
                label="Gastos sobre ingresos"
                value={
                  health.expenseRate === null ? 'Sin ingresos' : formatPercent(health.expenseRate)
                }
                detail={
                  health.expenseChange === null
                    ? 'Sin base para comparar'
                    : `${health.expenseChange > 0 ? '+' : ''}${formatPercent(health.expenseChange)} vs. mes anterior`
                }
                tone={(health.expenseRate ?? 0) > 100 ? 'negative' : 'neutral'}
              />
              <HealthMetric
                label="Flujo disponible"
                value={formatMoney(health.cashFlow, 'HNL')}
                detail={`${health.cashFlowChange >= 0 ? '+' : ''}${formatMoney(health.cashFlowChange, 'HNL')} vs. mes anterior`}
                tone={health.cashFlow >= 0 ? 'positive' : 'negative'}
              />
              <HealthMetric
                label="Deuda actual"
                value={formatMoney(health.debtHnl, 'HNL')}
                detail={
                  health.debtMonthsOfIncome === null
                    ? `${formatMoney(health.debtUsd, 'USD')} aparte`
                    : `${health.debtMonthsOfIncome} meses de ingreso · ${formatMoney(health.debtUsd, 'USD')} aparte`
                }
                tone={health.debtHnl > 0 ? 'negative' : 'positive'}
              />
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-3">
            <MiniSummary label="Metas activas" value={String(activeGoals)} />
            <MiniSummary label="Completadas" value={String(completedGoals)} />
            <MiniSummary label="Total reservado" value={formatMoney(totalGoalProgress, 'HNL')} />
          </div>

          <div className="rounded-[var(--radius)] border border-primary/20 bg-accent p-4 text-sm">
            <strong>Cómo funcionan los aportes:</strong> indican cuánto dinero de tu cuenta has
            reservado para una meta. No crean depósitos ni transferencias automáticamente, por lo
            que el saldo bancario no se duplica.
          </div>

          {goals.length === 0 ? (
            <EmptyState
              icon={Target}
              title="Aún no tienes metas"
              description="Crea un fondo de emergencia, viaje, vehículo u otro objetivo."
              action={
                <Button variant="outline" onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4" /> Crear primera meta
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {goals.map((goal) => {
                const GoalIcon = GOAL_ICONS[goal.goal_type];
                const account = goal.savings_account_id
                  ? accountById.get(goal.savings_account_id)
                  : undefined;
                const uncovered =
                  !!account && (reservedByAccount.get(account.id) ?? 0) > account.balance;
                const monthlyRequired = requiredMonthlyContribution(
                  goal.remaining_amount,
                  goal.target_date,
                  todayISO(),
                );
                return (
                  <Card
                    key={goal.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedGoalId(goal.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedGoalId(goal.id);
                      }
                    }}
                    className={cn(
                      'cursor-pointer transition-colors hover:border-primary/60',
                      selectedGoalId === goal.id && 'border-primary ring-1 ring-primary/30',
                    )}
                  >
                    <CardContent className="space-y-4">
                      <div className="flex items-start gap-3">
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                          style={{ backgroundColor: goal.color }}
                        >
                          <GoalIcon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold">{goal.name}</p>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                              {goal.status === 'COMPLETED'
                                ? 'Completada'
                                : goal.status === 'PAUSED'
                                  ? 'Pausada'
                                  : 'Activa'}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {GOAL_LABELS[goal.goal_type]}
                            {goal.savings_account
                              ? ` · ${goal.savings_account.name}`
                              : ' · Sin cuenta'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditingId(goal.id);
                            setFormOpen(true);
                          }}
                          aria-label="Editar meta"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeletingId(goal.id);
                          }}
                          aria-label="Eliminar meta"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-expense-soft hover:text-expense"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Progreso</p>
                          <p className="text-xl font-bold tabular-nums">
                            {formatMoney(goal.saved_amount, 'HNL')}
                          </p>
                        </div>
                        <p className="text-sm font-semibold tabular-nums">
                          {formatPercent(goal.percentage)}
                        </p>
                      </div>
                      <ProgressBar value={goal.percentage} color={goal.color} />
                      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                        <span>Objetivo: {formatMoney(goal.target_amount, 'HNL')}</span>
                        {goal.target_date && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" /> {formatDate(goal.target_date)}
                          </span>
                        )}
                      </div>
                      {monthlyRequired !== null && goal.status !== 'COMPLETED' && (
                        <p className="text-xs text-muted-foreground">
                          Ritmo sugerido: {formatMoney(monthlyRequired, 'HNL')} al mes.
                        </p>
                      )}
                      {uncovered && (
                        <p className="text-xs font-medium text-expense">
                          La suma reservada en metas supera el saldo actual de la cuenta vinculada.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {selectedGoal && (
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle>Movimientos de {selectedGoal.name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Aportes y retiros del dinero reservado
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={selectedGoal.status === 'PAUSED'}
                    onClick={() => setMovementKind('CONTRIBUTION')}
                  >
                    <ArrowUpCircle className="h-4 w-4" /> Aportar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={selectedGoal.status === 'PAUSED' || selectedGoal.saved_amount <= 0}
                    onClick={() => setMovementKind('WITHDRAWAL')}
                  >
                    <ArrowDownCircle className="h-4 w-4" /> Retirar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {movementsLoading ? (
                  <div className="flex justify-center py-8">
                    <Spinner />
                  </div>
                ) : movementsError ? (
                  <p className="py-6 text-center text-sm text-danger">{movementsError}</p>
                ) : movements.length === 0 ? (
                  <EmptyState icon={CircleDollarSign} title="Sin aportes o retiros" />
                ) : (
                  <ul className="divide-y divide-border">
                    {movements.map((movement) => {
                      const contribution = movement.movement_kind === 'CONTRIBUTION';
                      return (
                        <li key={movement.id} className="flex items-center gap-3 py-3">
                          {contribution ? (
                            <ArrowUpCircle className="h-5 w-5 text-income" />
                          ) : (
                            <ArrowDownCircle className="h-5 w-5 text-expense" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{contribution ? 'Aporte' : 'Retiro'}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {formatDate(movement.movement_date)}
                              {movement.notes ? ` · ${movement.notes}` : ''}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'font-semibold tabular-nums',
                              contribution ? 'text-income' : 'text-expense',
                            )}
                          >
                            {contribution ? '+' : '−'} {formatMoney(movement.amount, 'HNL')}
                          </span>
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

      <FinancialGoalForm
        open={formOpen}
        initial={editingGoal}
        accounts={accounts}
        onClose={() => {
          setFormOpen(false);
          setEditingId(null);
        }}
        onSubmit={saveGoal}
      />
      <FinancialGoalMovementForm
        goal={movementGoal}
        defaultKind={movementKind ?? 'CONTRIBUTION'}
        onClose={() => setMovementKind(null)}
        onSubmit={saveMovement}
      />
      <ConfirmDialog
        open={!!deletingGoal}
        title="Eliminar meta"
        description="Se eliminarán también sus aportes y retiros. Los saldos de tus cuentas no cambiarán."
        confirmLabel="Eliminar"
        onClose={() => setDeletingId(null)}
        onConfirm={async () => {
          if (!deletingGoal) return;
          try {
            await remove(deletingGoal.id);
            toast.success('Meta eliminada');
          } catch (cause) {
            toast.error(cause instanceof Error ? cause.message : 'No se pudo eliminar la meta');
          }
        }}
      />
    </>
  );
}

function HealthMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: 'positive' | 'negative' | 'neutral';
}) {
  return (
    <div className="rounded-[var(--radius)] border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 text-xl font-bold tabular-nums',
          tone === 'positive' && 'text-income',
          tone === 'negative' && 'text-expense',
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function MiniSummary({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-bold tabular-nums">{value}</p>
    </Card>
  );
}
