import { supabase } from '@/lib/supabase';
import type {
  RecurringOccurrence,
  RecurringTransaction,
  RecurringTransactionWithRelations,
} from '@/types/models';
import type { RecurringTransactionInput } from '@/lib/validations';

const SELECT_WITH_RELATIONS =
  '*, category:categories(id, name, icon, color, type), savings_account:savings_accounts(id, name, color), credit_card:credit_cards(id, name, color)';

export async function getRecurringTransactions(): Promise<RecurringTransactionWithRelations[]> {
  const { data, error } = await supabase
    .from('recurring_transactions')
    .select(SELECT_WITH_RELATIONS)
    .order('is_active', { ascending: false })
    .order('day_of_month', { ascending: true })
    .order('name', { ascending: true })
    .returns<RecurringTransactionWithRelations[]>();

  if (error) throw error;
  return data ?? [];
}

export async function getRecurringOccurrences(
  dateStart: string,
  dateEnd: string,
): Promise<RecurringOccurrence[]> {
  const { data, error } = await supabase
    .from('recurring_occurrences')
    .select('*')
    .gte('due_date', dateStart)
    .lte('due_date', dateEnd)
    .returns<RecurringOccurrence[]>();

  if (error) throw error;
  return data ?? [];
}

function toChanges(input: RecurringTransactionInput) {
  return {
    name: input.name,
    type: input.type,
    amount: input.amount,
    currency: input.currency,
    category_id: input.category_id,
    savings_account_id: input.savings_account_id ?? null,
    credit_card_id: input.credit_card_id ?? null,
    description: input.description ?? '',
    day_of_month: input.day_of_month,
    start_date: input.start_date,
    end_date: input.end_date || null,
    is_active: input.is_active,
  };
}

export async function createRecurringTransaction(
  userId: string,
  input: RecurringTransactionInput,
): Promise<RecurringTransaction> {
  const { data, error } = await supabase
    .from('recurring_transactions')
    .insert({ user_id: userId, ...toChanges(input) })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateRecurringTransaction(
  id: string,
  input: RecurringTransactionInput,
): Promise<RecurringTransaction> {
  const { data, error } = await supabase
    .from('recurring_transactions')
    .update(toChanges(input))
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function setRecurringTransactionActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('recurring_transactions')
    .update({ is_active: isActive })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteRecurringTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('recurring_transactions').delete().eq('id', id);
  if (error) throw error;
}

export async function confirmRecurringTransaction(id: string, dueDate: string): Promise<void> {
  const { error } = await supabase.rpc('confirm_recurring_transaction', {
    p_recurring_id: id,
    p_due_date: dueDate,
  });
  if (error) throw error;
}

export async function skipRecurringOccurrence(id: string, dueDate: string): Promise<void> {
  const { error } = await supabase.rpc('skip_recurring_occurrence', {
    p_recurring_id: id,
    p_due_date: dueDate,
  });
  if (error) throw error;
}

export async function restoreSkippedRecurringOccurrence(occurrenceId: string): Promise<void> {
  const { error } = await supabase
    .from('recurring_occurrences')
    .delete()
    .eq('id', occurrenceId)
    .eq('status', 'SKIPPED');
  if (error) throw error;
}
