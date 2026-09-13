import { supabase } from '@/lib/supabase';
import type { TransactionSubmit } from '@/components/transactions/TransactionForm';
import { getRecurringTransactions } from '@/services/recurring.service';
import { monthRange, nextMonth, previousMonth } from '@/utils/date';
import {
  findManualRecurringMatches,
  manualRecurringMovement,
  type RecurringOccurrenceWithTransaction,
} from '@/utils/manualRecurringGuard';

export async function getManualRecurringMatches(payload: TransactionSubmit) {
  const movement = manualRecurringMovement(payload);
  if (!movement) return [];
  const [year, month] = movement.transaction_date.split('-').map(Number);
  const before = previousMonth({ year, month });
  const after = nextMonth({ year, month });
  const [rules, response] = await Promise.all([
    getRecurringTransactions(),
    supabase
      .from('recurring_occurrences')
      .select('*, transaction:transactions(*)')
      .gte('due_date', monthRange(before.year, before.month).start)
      .lte('due_date', monthRange(after.year, after.month).end)
      .returns<RecurringOccurrenceWithTransaction[]>(),
  ]);
  if (response.error) throw response.error;
  return findManualRecurringMatches(payload, rules, response.data ?? []);
}
