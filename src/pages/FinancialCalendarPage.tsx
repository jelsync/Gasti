import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarCheck,
  CalendarDays,
  CircleAlert,
  Clock3,
  Settings2,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { MonthSelector } from '@/components/MonthSelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { HIDDEN_AMOUNT } from '@/components/ui/PrivacyToggle';
import { useRecurringTransactions } from '@/hooks/useRecurringTransactions';
import { useTransactions } from '@/hooks/useTransactions';
import { useBudgets } from '@/hooks/useBudgets';
import { useLoans } from '@/hooks/useLoans';
import { useCreditCards } from '@/hooks/useCreditCards';
import { PRIVACY_KEYS, usePrivacy } from '@/contexts/privacy';
import {
  buildFinancialBudgetAlerts,
  buildFinancialEvents,
  calendarMonthCells,
  type FinancialCalendarEvent,
  type FinancialEventStatus,
} from '@/utils/financialCalendar';
import {
  compareMonthYear,
  formatDate,
  getCurrentMonthYear,
  monthRange,
  todayISO,
  type MonthYear,
} from '@/utils/date';
import { formatMoney, formatPercent } from '@/utils/format';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const STATUS_LABELS: Record<FinancialEventStatus, string> = {
  UPCOMING: 'Próximo',
  DUE: 'Para hoy',
  OVERDUE: 'Vencido',
  COMPLETED: 'Registrado',
  SKIPPED: 'Omitido',
};

export default function FinancialCalendarPage() {
  const navigate = useNavigate();
  const { isHidden } = usePrivacy();
  const [month, setMonth] = useState<MonthYear>(getCurrentMonthYear);
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const range = useMemo(() => monthRange(month.year, month.month), [month]);
  const filters = useMemo(() => ({ dateStart: range.start, dateEnd: range.end }), [range]);
  const { rules, occurrences, loading: recurringLoading } = useRecurringTransactions(month);
  const { transactions, loading: transactionsLoading } = useTransactions(filters);
  const { budgets, loading: budgetsLoading } = useBudgets(month);
  const { loans, loading: loansLoading } = useLoans();
  const { cards, loading: cardsLoading } = useCreditCards();
  const today = todayISO();

  useEffect(() => {
    const current = getCurrentMonthYear();
    setSelectedDate(compareMonthYear(month, current) === 0 ? todayISO() : range.start);
  }, [month, range.start]);

  const events = useMemo(
    () =>
      buildFinancialEvents({
        month,
        today,
        recurringRules: rules,
        occurrences,
        loans,
        cards,
        transactions,
      }),
    [month, today, rules, occurrences, loans, cards, transactions],
  );

  const cells = useMemo(() => calendarMonthCells(month), [month]);
  const eventsByDate = useMemo(() => {
    const map = new Map<string, FinancialCalendarEvent[]>();
    for (const event of events) map.set(event.date, [...(map.get(event.date) ?? []), event]);
    return map;
  }, [events]);
  const selectedEvents = eventsByDate.get(selectedDate) ?? [];

  const budgetAlerts = useMemo(
    () => buildFinancialBudgetAlerts(budgets, transactions),
    [budgets, transactions],
  );

  const statusCounts = useMemo(
    () => ({
      overdue: events.filter((event) => event.status === 'OVERDUE').length,
      today: events.filter((event) => event.status === 'DUE').length,
      upcoming: events.filter((event) => event.status === 'UPCOMING').length,
      completed: events.filter((event) => event.status === 'COMPLETED').length,
    }),
    [events],
  );

  const missingLoanDates = loans.filter((loan) => loan.current_balance > 0 && !loan.payment_day);
  const missingCardDates = cards.filter(
    (card) => (card.balanceHnl > 0 || card.balanceUsd > 0) && !card.payment_due_day,
  );
  const loading =
    recurringLoading || transactionsLoading || budgetsLoading || loansLoading || cardsLoading;

  const goToEvent = (event: FinancialCalendarEvent) => {
    navigate(
      event.target === 'RECURRING'
        ? ROUTES.recurringTransactions
        : event.target === 'LOANS'
          ? ROUTES.loans
          : ROUTES.cards,
    );
  };

  return (
    <>
      <PageHeader
        title="Calendario financiero"
        description="Consulta vencimientos, movimientos recurrentes y avisos importantes"
        actions={<MonthSelector value={month} onChange={setMonth} />}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Summary
              label="Vencidos"
              value={statusCounts.overdue}
              icon={CircleAlert}
              tone="danger"
            />
            <Summary label="Para hoy" value={statusCounts.today} icon={Clock3} tone="warning" />
            <Summary label="Próximos" value={statusCounts.upcoming} icon={CalendarDays} />
            <Summary
              label="Registrados"
              value={statusCounts.completed}
              icon={CalendarCheck}
              tone="success"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.7fr)]">
            <Card>
              <CardContent>
                <div className="grid grid-cols-7 border-b border-border pb-2 text-center text-xs font-medium text-muted-foreground">
                  {WEEKDAYS.map((weekday) => (
                    <span key={weekday}>{weekday}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {cells.map((date, index) => {
                    if (!date) {
                      return (
                        <span
                          key={`empty-${index}`}
                          className="min-h-16 border-b border-border/60 sm:min-h-24"
                        />
                      );
                    }
                    const dayEvents = eventsByDate.get(date) ?? [];
                    const selected = date === selectedDate;
                    const isToday = date === today;
                    return (
                      <button
                        key={date}
                        type="button"
                        onClick={() => setSelectedDate(date)}
                        className={cn(
                          'min-h-16 border-b border-border/60 p-1.5 text-left transition-colors hover:bg-muted sm:min-h-24 sm:p-2',
                          selected && 'bg-accent',
                        )}
                        aria-pressed={selected}
                        aria-label={`${formatDate(date)}, ${dayEvents.length} eventos`}
                      >
                        <span
                          className={cn(
                            'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                            isToday && 'bg-primary text-primary-foreground',
                          )}
                        >
                          {Number(date.slice(-2))}
                        </span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {dayEvents.slice(0, 3).map((event) => (
                            <span
                              key={event.id}
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: event.color }}
                              title={event.title}
                            />
                          ))}
                          {dayEvents.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{dayEvents.length - 3}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{formatDate(selectedDate)}</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedEvents.length === 0 ? (
                    <EmptyState icon={CalendarDays} title="Sin movimientos programados" />
                  ) : (
                    <ul className="divide-y divide-border">
                      {selectedEvents.map((event) => (
                        <EventRow
                          key={event.id}
                          event={event}
                          hideIncome={isHidden(PRIVACY_KEYS.income)}
                          onOpen={() => goToEvent(event)}
                        />
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              {(missingLoanDates.length > 0 || missingCardDates.length > 0) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Completa tus fechas</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {missingLoanDates.length > 0 && (
                      <button
                        type="button"
                        onClick={() => navigate(ROUTES.loans)}
                        className="flex w-full items-center gap-2 rounded-md bg-muted px-3 py-2 text-left hover:bg-muted/70"
                      >
                        <Settings2 className="h-4 w-4" />
                        {missingLoanDates.length} préstamo(s) sin día de pago
                      </button>
                    )}
                    {missingCardDates.length > 0 && (
                      <button
                        type="button"
                        onClick={() => navigate(ROUTES.cards)}
                        className="flex w-full items-center gap-2 rounded-md bg-muted px-3 py-2 text-left hover:bg-muted/70"
                      >
                        <Settings2 className="h-4 w-4" />
                        {missingCardDates.length} tarjeta(s) sin día límite
                      </button>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {budgetAlerts.length > 0 && (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Avisos de presupuesto</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Categorías que alcanzaron al menos el 80 % de su límite.
                  </p>
                </div>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {budgetAlerts.map(({ id, name, used, limit, currency, percentage }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => navigate(ROUTES.budgets)}
                    className="rounded-[var(--radius)] border border-border p-4 text-left transition-colors hover:bg-muted"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="truncate font-medium">{name}</span>
                      <span
                        className={cn(
                          'text-sm font-semibold tabular-nums',
                          percentage >= 100 ? 'text-expense' : 'text-amber-500',
                        )}
                      >
                        {formatPercent(percentage)}
                      </span>
                    </div>
                    <ProgressBar
                      value={percentage}
                      color={percentage >= 100 ? '#ef4444' : '#f59e0b'}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatMoney(used, currency)} de {formatMoney(limit, currency)}
                    </p>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  );
}

function Summary({
  label,
  value,
  icon: Icon,
  tone = 'primary',
}: {
  label: string;
  value: number;
  icon: typeof CalendarDays;
  tone?: 'primary' | 'danger' | 'warning' | 'success';
}) {
  const color =
    tone === 'danger'
      ? 'text-expense'
      : tone === 'warning'
        ? 'text-amber-500'
        : tone === 'success'
          ? 'text-income'
          : 'text-primary';
  return (
    <Card className="flex items-center justify-between p-4">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('mt-1 text-2xl font-bold tabular-nums', color)}>{value}</p>
      </div>
      <Icon className={cn('h-5 w-5', color)} />
    </Card>
  );
}

function EventRow({
  event,
  hideIncome,
  onOpen,
}: {
  event: FinancialCalendarEvent;
  hideIncome: boolean;
  onOpen: () => void;
}) {
  const incomeHidden = event.kind === 'RECURRING_INCOME' && hideIncome;
  const statusColor =
    event.status === 'OVERDUE'
      ? 'bg-expense-soft text-expense'
      : event.status === 'DUE'
        ? 'bg-amber-500/15 text-amber-500'
        : event.status === 'COMPLETED'
          ? 'bg-income-soft text-income'
          : 'bg-muted text-muted-foreground';
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 py-3 text-left hover:opacity-80"
      >
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: event.color }} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{event.title}</p>
          <p className="truncate text-xs text-muted-foreground">{event.subtitle}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="flex flex-wrap justify-end gap-x-2 text-sm font-semibold tabular-nums">
            {incomeHidden
              ? HIDDEN_AMOUNT
              : event.amounts.map((amount) => (
                  <span key={amount.currency}>{formatMoney(amount.amount, amount.currency)}</span>
                ))}
          </div>
          <span
            className={cn('mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px]', statusColor)}
          >
            {STATUS_LABELS[event.status]}
          </span>
        </div>
      </button>
    </li>
  );
}
