import { supabase } from '@/lib/supabase';
import type { Transaction, TransactionType, TransactionWithCategory } from '@/types/models';
import type { TransactionInput } from '@/lib/validations';
import { monthRange } from '@/utils/date';

const SELECT_WITH_CATEGORY = '*, category:categories(id, name, icon, color, type)';

export interface TransactionFilters {
  dateStart?: string;
  dateEnd?: string;
  type?: TransactionType;
  categoryId?: string;
  search?: string;
  minAmount?: number;
  maxAmount?: number;
}

/** Lista transacciones (con su categoría) aplicando filtros opcionales. */
export async function getTransactions(
  filters: TransactionFilters = {},
): Promise<TransactionWithCategory[]> {
  let query = supabase.from('transactions').select(SELECT_WITH_CATEGORY);

  if (filters.dateStart) query = query.gte('transaction_date', filters.dateStart);
  if (filters.dateEnd) query = query.lte('transaction_date', filters.dateEnd);
  if (filters.type) query = query.eq('type', filters.type);
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
  if (filters.search) query = query.ilike('description', `%${filters.search}%`);
  if (typeof filters.minAmount === 'number') query = query.gte('amount', filters.minAmount);
  if (typeof filters.maxAmount === 'number') query = query.lte('amount', filters.maxAmount);

  const { data, error } = await query
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .returns<TransactionWithCategory[]>();

  if (error) throw error;
  return data ?? [];
}

/** Transacciones de un mes concreto. */
export function getMonthTransactions(
  year: number,
  month: number,
): Promise<TransactionWithCategory[]> {
  const { start, end } = monthRange(year, month);
  return getTransactions({ dateStart: start, dateEnd: end });
}

export async function createTransaction(
  userId: string,
  input: TransactionInput,
): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      type: input.type,
      amount: input.amount,
      category_id: input.category_id,
      description: input.description ?? '',
      transaction_date: input.transaction_date,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateTransaction(
  id: string,
  input: TransactionInput,
): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .update({
      type: input.type,
      amount: input.amount,
      category_id: input.category_id,
      description: input.description ?? '',
      transaction_date: input.transaction_date,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw error;
}
