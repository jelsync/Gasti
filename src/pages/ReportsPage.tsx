import { useMemo, useState } from 'react';
import { BarChart3, PieChart as PieIcon } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { MonthSelector } from '@/components/MonthSelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  BalanceLineChart,
  CategoryPieChart,
  IncomeExpenseBarChart,
  type MonthDatum,
  type PieDatum,
} from '@/components/reports/Charts';
import { useTransactions } from '@/hooks/useTransactions';
import { groupByCategory, monthlySummary } from '@/utils/finance';
import {
  getCurrentMonthYear,
  getMonthName,
  getRecentMonths,
  monthRange,
  type MonthYear,
} from '@/utils/date';
import type { TransactionWithCategory } from '@/types/models';

const MONTHS_WINDOW = 12;
const CHART_MONTHS = 6;

export default function ReportsPage() {
  const [pieMonth, setPieMonth] = useState<MonthYear>(getCurrentMonthYear);

  const windowMonths = useMemo(() => getRecentMonths(MONTHS_WINDOW), []);
  const range = useMemo(() => {
    const oldest = windowMonths[windowMonths.length - 1];
    const newest = windowMonths[0];
    return {
      start: monthRange(oldest.year, oldest.month).start,
      end: monthRange(newest.year, newest.month).end,
    };
  }, [windowMonths]);

  const filters = useMemo(() => ({ dateStart: range.start, dateEnd: range.end }), [range]);
  const { transactions, loading } = useTransactions(filters);

  const byMonth = useMemo(() => {
    const map = new Map<string, TransactionWithCategory[]>();
    for (const t of transactions) {
      const key = t.transaction_date.slice(0, 7);
      (map.get(key) ?? map.set(key, []).get(key)!).push(t);
    }
    return map;
  }, [transactions]);

  const keyOf = (my: MonthYear) => `${my.year}-${String(my.month).padStart(2, '0')}`;

  const monthData: MonthDatum[] = useMemo(() => {
    const chronological = getRecentMonths(CHART_MONTHS).reverse();
    return chronological.map((my) => {
      const summary = monthlySummary(byMonth.get(keyOf(my)) ?? []);
      return {
        label: getMonthName(my.month).slice(0, 3),
        income: summary.income,
        expense: summary.expense,
        balance: summary.balance,
      };
    });
  }, [byMonth]);

  const pieData: PieDatum[] = useMemo(() => {
    const groups = groupByCategory(byMonth.get(keyOf(pieMonth)) ?? [], 'EXPENSE');
    return groups.map((g) => ({ name: g.name, value: g.total, color: g.color }));
  }, [byMonth, pieMonth]);

  const hasAnyData = transactions.length > 0;

  return (
    <>
      <PageHeader title="Reportes" description="Analiza tus finanzas con gráficos" />

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : !hasAnyData ? (
        <EmptyState
          icon={BarChart3}
          title="Aún no hay datos"
          description="Registra transacciones para ver tus reportes."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Ingresos vs Gastos</CardTitle>
              </CardHeader>
              <CardContent>
                <IncomeExpenseBarChart data={monthData} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Evolución del balance</CardTitle>
              </CardHeader>
              <CardContent>
                <BalanceLineChart data={monthData} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Gastos por categoría</CardTitle>
              <MonthSelector value={pieMonth} onChange={setPieMonth} />
            </CardHeader>
            <CardContent>
              {pieData.length === 0 ? (
                <EmptyState icon={PieIcon} title="Sin gastos este mes" />
              ) : (
                <CategoryPieChart data={pieData} />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
