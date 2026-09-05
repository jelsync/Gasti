import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  HandCoins,
  Landmark,
  PiggyBank,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { MonthSelector } from '@/components/MonthSelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatCard } from '@/components/dashboard/StatCard';
import { CategoryBreakdown } from '@/components/dashboard/CategoryBreakdown';
import { MovementList, type MovementItem } from '@/components/transactions/MovementList';
import { useTransactions } from '@/hooks/useTransactions';
import { useBudgets } from '@/hooks/useBudgets';
import { useCreditCards } from '@/hooks/useCreditCards';
import { useSavingsAccounts } from '@/hooks/useSavingsAccounts';
import { useLoans } from '@/hooks/useLoans';
import { useReceivables } from '@/hooks/useReceivables';
import { useCardCharges } from '@/hooks/useCardCharges';
import { budgetOverview, groupByCategory, monthlySummary } from '@/utils/finance';
import { formatCurrency, formatMoney, formatPercent } from '@/utils/format';
import { getCurrentMonthYear, monthRange } from '@/utils/date';
import { ROUTES } from '@/constants/routes';

export default function DashboardPage() {
  const [month, setMonth] = useState(getCurrentMonthYear);
  const range = useMemo(() => monthRange(month.year, month.month), [month]);
  const filters = useMemo(() => ({ dateStart: range.start, dateEnd: range.end }), [range]);

  const { transactions, loading } = useTransactions(filters);
  const { budgets } = useBudgets(month);
  const { cards } = useCreditCards();
  const { accounts } = useSavingsAccounts();
  const { loans } = useLoans();
  const { people: receivablePeople } = useReceivables();
  const { charges } = useCardCharges(range);

  const cardDebt = useMemo(() => {
    const acc = { HNL: 0, USD: 0 };
    for (const c of cards) {
      acc.HNL += c.balanceHnl;
      acc.USD += c.balanceUsd;
    }
    return acc;
  }, [cards]);
  const totalSavings = useMemo(() => accounts.reduce((acc, a) => acc + a.balance, 0), [accounts]);
  const totalLoans = useMemo(() => loans.reduce((acc, l) => acc + l.current_balance, 0), [loans]);
  const totalReceivable = useMemo(
    () => receivablePeople.reduce((total, person) => total + person.balance, 0),
    [receivablePeople],
  );

  const summary = useMemo(() => monthlySummary(transactions), [transactions]);
  const expenseByCategory = useMemo(() => groupByCategory(transactions, 'EXPENSE'), [transactions]);

  const budgetUsage = useMemo(() => {
    if (budgets.length === 0) return null;
    const spentByCategory = new Map(expenseByCategory.map((s) => [s.categoryId, s.total]));
    return budgetOverview(budgets, spentByCategory, summary.saving);
  }, [budgets, expenseByCategory, summary.saving]);

  const unbudgetedTotal = useMemo(() => {
    const budgetedIds = new Set(
      budgets.filter((budget) => budget.kind === 'CATEGORY').map((budget) => budget.category_id),
    );
    return expenseByCategory.reduce(
      (total, item) => total + (budgetedIds.has(item.categoryId) ? 0 : item.total),
      0,
    );
  }, [budgets, expenseByCategory]);

  const recent = useMemo<MovementItem[]>(() => {
    const items: MovementItem[] = [
      ...transactions.map((t) => ({ type: 'tx' as const, date: t.transaction_date, tx: t })),
      ...charges.map((c) => ({ type: 'charge' as const, date: c.charge_date, charge: c })),
    ];
    return items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 5);
  }, [transactions, charges]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Resumen de tus finanzas del mes"
        actions={<MonthSelector value={month} onChange={setMonth} />}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Ingresos" value={summary.income} icon={TrendingUp} tone="income" />
            <StatCard label="Gastos" value={summary.expense} icon={TrendingDown} tone="expense" />
            <StatCard label="Ahorro" value={summary.saving} icon={PiggyBank} tone="primary" />
            <StatCard label="Disponible" value={summary.balance} icon={Wallet} tone="neutral" />
          </div>

          {(cards.length > 0 || accounts.length > 0 || loans.length > 0 || totalReceivable > 0) && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {loans.length > 0 && (
                <Link to={ROUTES.loans}>
                  <Card className="flex items-center justify-between p-5 transition-colors hover:bg-muted">
                    <div>
                      <p className="text-sm text-muted-foreground">Deuda en préstamos</p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-expense">
                        {formatMoney(totalLoans, 'HNL')}
                      </p>
                    </div>
                    <Landmark className="h-6 w-6 text-muted-foreground" />
                  </Card>
                </Link>
              )}
              {cards.length > 0 && (
                <Link to={ROUTES.cards}>
                  <Card className="flex items-center justify-between p-5 transition-colors hover:bg-muted">
                    <div>
                      <p className="text-sm text-muted-foreground">Deuda en tarjetas</p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-expense">
                        {formatMoney(cardDebt.HNL, 'HNL')}
                        {cardDebt.USD > 0 && (
                          <span className="ml-3">{formatMoney(cardDebt.USD, 'USD')}</span>
                        )}
                      </p>
                    </div>
                    <CreditCard className="h-6 w-6 text-muted-foreground" />
                  </Card>
                </Link>
              )}
              {accounts.length > 0 && (
                <Link to={ROUTES.savings}>
                  <Card className="flex items-center justify-between p-5 transition-colors hover:bg-muted">
                    <div>
                      <p className="text-sm text-muted-foreground">Saldo en cuentas</p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-primary">
                        {formatCurrency(totalSavings)}
                      </p>
                    </div>
                    <Wallet className="h-6 w-6 text-muted-foreground" />
                  </Card>
                </Link>
              )}
              {totalReceivable > 0 && (
                <Link to={ROUTES.receivables}>
                  <Card className="flex items-center justify-between p-5 transition-colors hover:bg-muted">
                    <div>
                      <p className="text-sm text-muted-foreground">Pendiente por cobrar</p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-income">
                        {formatCurrency(totalReceivable)}
                      </p>
                    </div>
                    <HandCoins className="h-6 w-6 text-muted-foreground" />
                  </Card>
                </Link>
              )}
            </div>
          )}

          {(budgetUsage || unbudgetedTotal > 0) && (
            <Card>
              <CardContent>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PiggyBank className="h-5 w-5 text-primary" />
                    <span className="font-medium">Presupuesto utilizado</span>
                  </div>
                  {budgetUsage && (
                    <span className="text-sm font-semibold tabular-nums">
                      {formatPercent(budgetUsage.percentage)}
                    </span>
                  )}
                </div>
                {budgetUsage && (
                  <>
                    <ProgressBar value={budgetUsage.percentage} />
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatCurrency(budgetUsage.totalUsed)} de{' '}
                      {formatCurrency(budgetUsage.totalBudget)}
                    </p>
                  </>
                )}
                {unbudgetedTotal > 0 && (
                  <p className="mt-2 text-xs font-medium text-expense">
                    {formatCurrency(unbudgetedTotal)} en gastos sin presupuesto.{' '}
                    <Link to={ROUTES.budgets} className="underline">
                      Revisar
                    </Link>
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Gastos por categoría</CardTitle>
              </CardHeader>
              <CardContent>
                {expenseByCategory.length === 0 ? (
                  <EmptyState icon={TrendingDown} title="Sin gastos este mes" />
                ) : (
                  <CategoryBreakdown items={expenseByCategory} total={summary.expense} limit={6} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Últimas transacciones</CardTitle>
                <Link
                  to={ROUTES.transactions}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Ver todas
                </Link>
              </CardHeader>
              <CardContent>
                {recent.length === 0 ? (
                  <EmptyState icon={Receipt} title="Sin movimientos" />
                ) : (
                  <MovementList items={recent} />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
