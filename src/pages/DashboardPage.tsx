import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, PiggyBank, Receipt, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { MonthSelector } from '@/components/MonthSelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatCard } from '@/components/dashboard/StatCard';
import { CategoryBreakdown } from '@/components/dashboard/CategoryBreakdown';
import { TransactionList } from '@/components/transactions/TransactionList';
import { useTransactions } from '@/hooks/useTransactions';
import { useBudgets } from '@/hooks/useBudgets';
import { useCreditCards } from '@/hooks/useCreditCards';
import { useSavingsAccounts } from '@/hooks/useSavingsAccounts';
import { groupByCategory, monthlySummary, totalBudgetUsage } from '@/utils/finance';
import { formatCurrency, formatPercent } from '@/utils/format';
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

  const totalCardDebt = useMemo(() => cards.reduce((acc, c) => acc + c.balance, 0), [cards]);
  const totalSavings = useMemo(() => accounts.reduce((acc, a) => acc + a.balance, 0), [accounts]);

  const summary = useMemo(() => monthlySummary(transactions), [transactions]);
  const expenseByCategory = useMemo(() => groupByCategory(transactions, 'EXPENSE'), [transactions]);

  const budgetUsage = useMemo(() => {
    if (budgets.length === 0) return null;
    const spentByCategory = new Map(expenseByCategory.map((s) => [s.categoryId, s.total]));
    const totalBudget = budgets.reduce((acc, b) => acc + b.amount, 0);
    const spent = budgets.reduce((acc, b) => acc + (spentByCategory.get(b.category_id) ?? 0), 0);
    return { totalBudget, spent, percentage: totalBudgetUsage(totalBudget, spent) };
  }, [budgets, expenseByCategory]);

  const recent = transactions.slice(0, 5);

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

          {(cards.length > 0 || accounts.length > 0) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {cards.length > 0 && (
                <Link to={ROUTES.cards}>
                  <Card className="flex items-center justify-between p-5 transition-colors hover:bg-muted">
                    <div>
                      <p className="text-sm text-muted-foreground">Deuda en tarjetas</p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-expense">
                        {formatCurrency(totalCardDebt)}
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
                      <p className="text-sm text-muted-foreground">Total ahorrado</p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-primary">
                        {formatCurrency(totalSavings)}
                      </p>
                    </div>
                    <Wallet className="h-6 w-6 text-muted-foreground" />
                  </Card>
                </Link>
              )}
            </div>
          )}

          {budgetUsage && (
            <Card>
              <CardContent>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PiggyBank className="h-5 w-5 text-primary" />
                    <span className="font-medium">Presupuesto utilizado</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatPercent(budgetUsage.percentage)}
                  </span>
                </div>
                <ProgressBar value={budgetUsage.percentage} />
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatCurrency(budgetUsage.spent)} de {formatCurrency(budgetUsage.totalBudget)}
                </p>
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
                  <TransactionList transactions={recent} />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
