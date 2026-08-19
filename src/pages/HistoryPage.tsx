import { useMemo, useState } from 'react';
import { CalendarClock, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { CategoryBreakdown } from '@/components/dashboard/CategoryBreakdown';
import { TransactionList } from '@/components/transactions/TransactionList';
import { useTransactions } from '@/hooks/useTransactions';
import { groupByCategory, monthlySummary } from '@/utils/finance';
import { formatCurrency } from '@/utils/format';
import {
  compareMonthYear,
  formatMonthYear,
  getCurrentMonthYear,
  getRecentMonths,
  monthRange,
  type MonthYear,
} from '@/utils/date';
import { cn } from '@/lib/utils';
import type { TransactionWithCategory } from '@/types/models';

const MONTHS_TO_SHOW = 12;

export default function HistoryPage() {
  const months = useMemo(() => getRecentMonths(MONTHS_TO_SHOW), []);
  const [selected, setSelected] = useState<MonthYear>(getCurrentMonthYear);

  const range = useMemo(() => {
    const oldest = months[months.length - 1];
    const newest = months[0];
    return { start: monthRange(oldest.year, oldest.month).start, end: monthRange(newest.year, newest.month).end };
  }, [months]);

  const filters = useMemo(() => ({ dateStart: range.start, dateEnd: range.end }), [range]);
  const { transactions, loading } = useTransactions(filters);

  // Agrupa transacciones por clave 'YYYY-MM'.
  const byMonth = useMemo(() => {
    const map = new Map<string, TransactionWithCategory[]>();
    for (const t of transactions) {
      const key = t.transaction_date.slice(0, 7);
      const list = map.get(key);
      if (list) list.push(t);
      else map.set(key, [t]);
    }
    return map;
  }, [transactions]);

  const monthKey = (my: MonthYear) => `${my.year}-${String(my.month).padStart(2, '0')}`;

  const selectedTransactions = byMonth.get(monthKey(selected)) ?? [];
  const selectedSummary = monthlySummary(selectedTransactions);
  const selectedExpenses = groupByCategory(selectedTransactions, 'EXPENSE');

  // Agrupa la lista de meses por año para los encabezados.
  const monthsByYear = useMemo(() => {
    const groups: { year: number; items: MonthYear[] }[] = [];
    for (const my of months) {
      const last = groups[groups.length - 1];
      if (last && last.year === my.year) last.items.push(my);
      else groups.push({ year: my.year, items: [my] });
    }
    return groups;
  }, [months]);

  return (
    <>
      <PageHeader title="Historial" description="Consulta tus finanzas de meses anteriores" />

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
          {/* Lista de meses */}
          <Card className="h-fit">
            <CardContent className="space-y-4">
              {monthsByYear.map((group) => (
                <div key={group.year}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.year}
                  </p>
                  <div className="space-y-1">
                    {group.items.map((my) => {
                      const summary = monthlySummary(byMonth.get(monthKey(my)) ?? []);
                      const isSelected = compareMonthYear(my, selected) === 0;
                      return (
                        <button
                          key={monthKey(my)}
                          type="button"
                          onClick={() => setSelected(my)}
                          className={cn(
                            'flex w-full items-center justify-between rounded-[var(--radius)] px-3 py-2 text-left text-sm transition-colors',
                            isSelected
                              ? 'bg-accent text-accent-foreground'
                              : 'hover:bg-muted',
                          )}
                        >
                          <span className="font-medium capitalize">
                            {formatMonthYear(my.month, my.year).split(' ')[0]}
                          </span>
                          <span
                            className={cn(
                              'text-xs tabular-nums',
                              summary.balance >= 0 ? 'text-income' : 'text-expense',
                            )}
                          >
                            {formatCurrency(summary.balance)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Detalle del mes seleccionado */}
          <div className="space-y-6">
            <h2 className="text-lg font-semibold capitalize">
              {formatMonthYear(selected.month, selected.year)}
            </h2>

            <div className="grid gap-4 sm:grid-cols-3">
              <MiniStat label="Ingresos" value={selectedSummary.income} icon={TrendingUp} tone="income" />
              <MiniStat label="Gastos" value={selectedSummary.expense} icon={TrendingDown} tone="expense" />
              <MiniStat label="Balance" value={selectedSummary.balance} icon={Wallet} tone="primary" />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Gastos por categoría</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedExpenses.length === 0 ? (
                    <EmptyState icon={CalendarClock} title="Sin gastos" />
                  ) : (
                    <CategoryBreakdown items={selectedExpenses} total={selectedSummary.expense} />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Transacciones</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedTransactions.length === 0 ? (
                    <EmptyState icon={CalendarClock} title="Sin movimientos" />
                  ) : (
                    <TransactionList transactions={selectedTransactions} />
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Wallet;
  tone: 'income' | 'expense' | 'primary';
}) {
  const text =
    tone === 'income' ? 'text-income' : tone === 'expense' ? 'text-expense' : 'text-primary';
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className={cn('mt-1 text-xl font-bold tabular-nums', text)}>{formatCurrency(value)}</p>
    </Card>
  );
}
