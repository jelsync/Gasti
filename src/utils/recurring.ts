import type { RecurringTransaction } from '@/types/models';
import type { MonthYear } from '@/utils/date';

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Fecha mensual, ajustando 29–31 al último día disponible del mes. */
export function recurringDueDate(month: MonthYear, dayOfMonth: number): string {
  const lastDay = new Date(month.year, month.month, 0).getDate();
  const day = Math.min(Math.max(Math.trunc(dayOfMonth), 1), lastDay);
  return `${month.year}-${pad2(month.month)}-${pad2(day)}`;
}

export function ruleDueDateForMonth(
  rule: Pick<RecurringTransaction, 'day_of_month' | 'start_date' | 'end_date'>,
  month: MonthYear,
): string | null {
  const dueDate = recurringDueDate(month, rule.day_of_month);
  if (dueDate < rule.start_date) return null;
  if (rule.end_date && dueDate > rule.end_date) return null;
  return dueDate;
}
