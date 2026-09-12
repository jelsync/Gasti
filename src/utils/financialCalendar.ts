import type {
  Budget,
  Category,
  CreditCardWithBalance,
  Currency,
  LoanWithCategory,
  RecurringOccurrence,
  RecurringTransactionWithRelations,
  TransactionWithCategory,
} from '@/types/models';
import type { MonthYear } from '@/utils/date';
import { monthRange } from '@/utils/date';
import { recurringDueDate, ruleDueDateForMonth } from '@/utils/recurring';

export type FinancialEventStatus = 'UPCOMING' | 'DUE' | 'OVERDUE' | 'COMPLETED' | 'SKIPPED';
export type FinancialEventKind = 'RECURRING_INCOME' | 'RECURRING_EXPENSE' | 'LOAN' | 'CARD';

export interface FinancialCalendarEvent {
  id: string;
  date: string;
  kind: FinancialEventKind;
  title: string;
  subtitle: string;
  status: FinancialEventStatus;
  color: string;
  amounts: Array<{ amount: number; currency: Currency }>;
  target: 'RECURRING' | 'LOANS' | 'CARDS';
}

export interface FinancialBudgetAlert {
  id: string;
  name: string;
  used: number;
  limit: number;
  currency: Currency;
  percentage: number;
}

type BudgetWithCategory = Budget & {
  category: Pick<Category, 'id' | 'name' | 'icon' | 'color'> | null;
};

export function buildFinancialBudgetAlerts(
  budgets: BudgetWithCategory[],
  transactions: TransactionWithCategory[],
): FinancialBudgetAlert[] {
  const spent = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.type !== 'EXPENSE' || !transaction.category_id) continue;
    const key = `${transaction.category_id}:${transaction.currency}`;
    spent.set(key, (spent.get(key) ?? 0) + transaction.amount);
  }

  return budgets
    .filter((budget) => budget.kind === 'CATEGORY' && budget.category_id)
    .map((budget) => {
      const used = spent.get(`${budget.category_id}:${budget.currency}`) ?? 0;
      return {
        id: budget.id,
        name: budget.category?.name ?? 'Sin categoría',
        used,
        limit: budget.amount,
        currency: budget.currency,
        percentage: budget.amount > 0 ? (used / budget.amount) * 100 : 0,
      };
    })
    .filter((alert) => alert.percentage >= 80)
    .sort((left, right) => right.percentage - left.percentage);
}

export function monthlyDueDate(month: MonthYear, dayOfMonth: number): string {
  return recurringDueDate(month, dayOfMonth);
}

export function financialEventStatus(
  dueDate: string,
  today: string,
  handled?: 'COMPLETED' | 'SKIPPED' | null,
): FinancialEventStatus {
  if (handled === 'COMPLETED') return 'COMPLETED';
  if (handled === 'SKIPPED') return 'SKIPPED';
  if (dueDate < today) return 'OVERDUE';
  if (dueDate === today) return 'DUE';
  return 'UPCOMING';
}

/** Celdas de lunes a domingo; null representa espacio fuera del mes. */
export function calendarMonthCells(month: MonthYear): Array<string | null> {
  const range = monthRange(month.year, month.month);
  const firstWeekdaySundayZero = new Date(month.year, month.month - 1, 1).getDay();
  const mondayOffset = (firstWeekdaySundayZero + 6) % 7;
  const lastDay = Number(range.end.slice(-2));
  const cells: Array<string | null> = Array.from({ length: mondayOffset }, () => null);

  for (let day = 1; day <= lastDay; day += 1) {
    cells.push(
      `${month.year}-${String(month.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    );
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function buildFinancialEvents({
  month,
  today,
  recurringRules,
  occurrences,
  loans,
  cards,
  transactions,
}: {
  month: MonthYear;
  today: string;
  recurringRules: RecurringTransactionWithRelations[];
  occurrences: RecurringOccurrence[];
  loans: LoanWithCategory[];
  cards: CreditCardWithBalance[];
  transactions: TransactionWithCategory[];
}): FinancialCalendarEvent[] {
  const events: FinancialCalendarEvent[] = [];
  const occurrenceByRule = new Map(
    occurrences.map((occurrence) => [occurrence.recurring_transaction_id, occurrence]),
  );

  for (const rule of recurringRules) {
    const occurrence = occurrenceByRule.get(rule.id);
    if (!rule.is_active && !occurrence) continue;
    const date = occurrence?.due_date ?? ruleDueDateForMonth(rule, month);
    if (!date) continue;
    events.push({
      id: `recurring:${rule.id}`,
      date,
      kind: rule.type === 'INCOME' ? 'RECURRING_INCOME' : 'RECURRING_EXPENSE',
      title: rule.name,
      subtitle:
        rule.category?.name ?? (rule.type === 'INCOME' ? 'Ingreso recurrente' : 'Gasto recurrente'),
      status: financialEventStatus(date, today, occurrence?.status),
      color: rule.category?.color ?? (rule.type === 'INCOME' ? '#10b981' : '#ef4444'),
      amounts: [{ amount: rule.amount, currency: rule.currency }],
      target: 'RECURRING',
    });
  }

  for (const loan of loans) {
    if (!loan.payment_day) continue;
    const date = monthlyDueDate(month, loan.payment_day);
    if (date < loan.start_date || (loan.end_date && date > loan.end_date)) continue;
    const completed = transactions.some(
      (transaction) =>
        transaction.loan_id === loan.id && transaction.loan_payment_kind === 'INSTALLMENT',
    );
    if (loan.current_balance <= 0 && !completed) continue;
    events.push({
      id: `loan:${loan.id}`,
      date,
      kind: 'LOAN',
      title: `Cuota de ${loan.name}`,
      subtitle: loan.category?.name ?? 'Préstamo',
      status: financialEventStatus(date, today, completed ? 'COMPLETED' : null),
      color: loan.category?.color ?? '#8b5cf6',
      amounts: [{ amount: loan.installment, currency: 'HNL' }],
      target: 'LOANS',
    });
  }

  for (const card of cards) {
    if (!card.payment_due_day) continue;
    const completed = transactions.some(
      (transaction) => transaction.type === 'TRANSFER' && transaction.credit_card_id === card.id,
    );
    if (card.balanceHnl <= 0 && card.balanceUsd <= 0 && !completed) continue;
    const date = monthlyDueDate(month, card.payment_due_day);
    const amounts: FinancialCalendarEvent['amounts'] = [];
    if (card.balanceHnl > 0) amounts.push({ amount: card.balanceHnl, currency: 'HNL' });
    if (card.balanceUsd > 0) amounts.push({ amount: card.balanceUsd, currency: 'USD' });
    events.push({
      id: `card:${card.id}`,
      date,
      kind: 'CARD',
      title: `Pago de ${card.name}`,
      subtitle: card.bank || 'Tarjeta de crédito',
      status: financialEventStatus(date, today, completed ? 'COMPLETED' : null),
      color: card.color,
      amounts,
      target: 'CARDS',
    });
  }

  return events.sort(
    (left, right) => left.date.localeCompare(right.date) || left.title.localeCompare(right.title),
  );
}
