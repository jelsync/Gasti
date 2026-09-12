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
import { HIDDEN_AMOUNT, PrivacyToggle } from '@/components/ui/PrivacyToggle';
import { PRIVACY_KEYS, usePrivacy } from '@/contexts/privacy';
import { MultiCurrencyCategoryBreakdown } from '@/components/dashboard/CategoryBreakdown';
import {
  CategoryMovementDetail,
  type CategoryDetailTarget,
} from '@/components/categories/CategoryMovementDetail';
import { MovementList, type MovementItem } from '@/components/transactions/MovementList';
import { useTransactions } from '@/hooks/useTransactions';
import { useBudgets } from '@/hooks/useBudgets';
import { useCreditCards } from '@/hooks/useCreditCards';
import { useSavingsAccounts } from '@/hooks/useSavingsAccounts';
import { useLoans } from '@/hooks/useLoans';
import { useReceivables } from '@/hooks/useReceivables';
import { useCardCharges } from '@/hooks/useCardCharges';
import {
  budgetOverview,
  groupByCategory,
  monthlySummary,
  savingsGoalMovement,
} from '@/utils/finance';
import { formatCurrency, formatMoney, formatPercent } from '@/utils/format';
import { getCurrentMonthYear, monthRange } from '@/utils/date';
import { ROUTES } from '@/constants/routes';

export default function DashboardPage() {
  const { isHidden } = usePrivacy();
  const [month, setMonth] = useState(getCurrentMonthYear);
  const [detailCategory, setDetailCategory] = useState<CategoryDetailTarget | null>(null);
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

  const summary = useMemo(() => monthlySummary(transactions, 'HNL'), [transactions]);
  const summaryUsd = useMemo(() => monthlySummary(transactions, 'USD'), [transactions]);
  const expenseByCategory = useMemo(
    () => groupByCategory(transactions, 'EXPENSE', 'HNL'),
    [transactions],
  );
  const expenseByCategoryUsd = useMemo(
    () => groupByCategory(transactions, 'EXPENSE', 'USD'),
    [transactions],
  );
  const savedThisMonth = useMemo(
    () =>
      savingsGoalMovement(
        transactions,
        new Set(accounts.filter((account) => account.include_in_savings_goal).map((a) => a.id)),
      ),
    [transactions, accounts],
  );

  const budgetUsage = useMemo(() => {
    const categoryBudgets = budgets.filter((budget) => budget.kind === 'CATEGORY');
    const hnlMap = new Map(expenseByCategory.map((item) => [item.categoryId, item.total]));
    const usdMap = new Map(expenseByCategoryUsd.map((item) => [item.categoryId, item.total]));
    return {
      HNL: budgetOverview(
        budgets.filter((budget) => budget.currency === 'HNL'),
        hnlMap,
        savedThisMonth,
      ),
      USD: budgetOverview(
        categoryBudgets.filter((budget) => budget.currency === 'USD'),
        usdMap,
        0,
      ),
    };
  }, [budgets, expenseByCategory, expenseByCategoryUsd, savedThisMonth]);

  const unbudgetedTotals = useMemo(() => {
    const budgetedKeys = new Set(
      budgets
        .filter((budget) => budget.kind === 'CATEGORY')
        .map((budget) => `${budget.category_id}:${budget.currency}`),
    );
    const outside = (items: typeof expenseByCategory, currency: 'HNL' | 'USD') =>
      items.reduce(
        (total, item) =>
          total + (budgetedKeys.has(`${item.categoryId}:${currency}`) ? 0 : item.total),
        0,
      );
    return { HNL: outside(expenseByCategory, 'HNL'), USD: outside(expenseByCategoryUsd, 'USD') };
  }, [budgets, expenseByCategory, expenseByCategoryUsd]);

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
            <StatCard
              label="Ingresos"
              value={summary.income}
              icon={TrendingUp}
              tone="income"
              privacyKey={PRIVACY_KEYS.income}
            />
            <StatCard
              label="Gastos"
              value={summary.expense}
              secondaryValue={summaryUsd.expense}
              secondaryCurrency="USD"
              icon={TrendingDown}
              tone="expense"
            />
            <StatCard label="Ahorro" value={savedThisMonth} icon={PiggyBank} tone="primary" />
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
                      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-bold tabular-nums text-expense">
                        <span className="text-xl">{formatMoney(cardDebt.HNL, 'HNL')}</span>
                        {cardDebt.USD > 0 && (
                          <span className="text-lg">{formatMoney(cardDebt.USD, 'USD')}</span>
                        )}
                      </div>
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
                        {isHidden(PRIVACY_KEYS.accountsTotal)
                          ? HIDDEN_AMOUNT
                          : formatCurrency(totalSavings)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <PrivacyToggle privacyKey={PRIVACY_KEYS.accountsTotal} />
                      <Wallet className="h-6 w-6 text-muted-foreground" />
                    </div>
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

          {(budgetUsage.HNL.totalBudget > 0 ||
            budgetUsage.USD.totalBudget > 0 ||
            unbudgetedTotals.HNL > 0 ||
            unbudgetedTotals.USD > 0) && (
            <Card>
              <CardContent>
                <div className="mb-3 flex items-center gap-2">
                  <PiggyBank className="h-5 w-5 text-primary" />
                  <span className="font-medium">Presupuesto utilizado</span>
                </div>
                <div className="space-y-4">
                  {(['HNL', 'USD'] as const).map((currency) => {
                    const usage = budgetUsage[currency];
                    const outside = unbudgetedTotals[currency];
                    if (usage.totalBudget === 0 && outside === 0) return null;
                    return (
                      <div key={currency}>
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">{currency}</span>
                          </div>
                          {usage.totalBudget > 0 && (
                            <span className="text-sm font-semibold tabular-nums">
                              {formatPercent(usage.percentage)}
                            </span>
                          )}
                        </div>
                        {usage.totalBudget > 0 && (
                          <>
                            <ProgressBar value={usage.percentage} />
                            <p className="mt-2 text-xs text-muted-foreground">
                              {formatMoney(usage.totalUsed, currency)} de{' '}
                              {formatMoney(usage.totalBudget, currency)}
                            </p>
                          </>
                        )}
                        {outside > 0 && (
                          <p className="mt-2 text-xs font-medium text-expense">
                            {formatMoney(outside, currency)} en gastos sin presupuesto.{' '}
                            <Link to={ROUTES.budgets} className="underline">
                              Revisar
                            </Link>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Distribución de gastos por categoría</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Cada porcentaje representa la proporción del gasto en su moneda. Selecciona una
                  categoría para ver sus movimientos.
                </p>
              </CardHeader>
              <CardContent>
                {expenseByCategory.length === 0 && expenseByCategoryUsd.length === 0 ? (
                  <EmptyState icon={TrendingDown} title="Sin gastos este mes" />
                ) : (
                  <MultiCurrencyCategoryBreakdown
                    hnlItems={expenseByCategory}
                    usdItems={expenseByCategoryUsd}
                    hnlTotal={summary.expense}
                    usdTotal={summaryUsd.expense}
                    limit={8}
                    onSelectCategory={(id, name) =>
                      setDetailCategory({ id, name, type: 'EXPENSE' })
                    }
                  />
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

      <CategoryMovementDetail
        open={!!detailCategory}
        onClose={() => setDetailCategory(null)}
        category={detailCategory}
        month={month}
        transactions={transactions}
      />
    </>
  );
}
