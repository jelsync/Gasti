import { supabase } from '@/lib/supabase';
import type { CardStatement } from '@/types/models';
import type { Json } from '@/types/database.types';
import { monthRange, type MonthYear } from '@/utils/date';

export type CardStatementPreview = Omit<CardStatement, 'id' | 'user_id' | 'confirmed_at'>;

export async function getCardStatements(
  cardId?: string,
  month?: MonthYear,
): Promise<CardStatement[]> {
  const result: CardStatement[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    let query = supabase
      .from('card_statements')
      .select('*')
      .order('statement_date', { ascending: false })
      .order('id')
      .range(offset, offset + pageSize - 1);
    if (cardId) query = query.eq('card_id', cardId);
    if (month) {
      const range = monthRange(month.year, month.month);
      query = query.gte('statement_date', range.start).lte('statement_date', range.end);
    }
    const { data, error } = await query;
    if (error) throw error;
    result.push(...(data ?? []));
    if (!data || data.length < pageSize) return result;
  }
}

export async function previewCardStatement(
  cardId: string,
  statementDate: string,
): Promise<CardStatementPreview> {
  const { data, error } = await supabase.rpc('preview_card_statement', {
    p_card_id: cardId,
    p_statement_date: statementDate,
  });
  if (error) throw error;
  return data as unknown as CardStatementPreview;
}

export async function confirmCardStatement(snapshot: CardStatementPreview): Promise<CardStatement> {
  const { data, error } = await supabase.rpc('confirm_card_statement', {
    p_card_id: snapshot.card_id,
    p_statement_date: snapshot.statement_date,
    p_expected_snapshot: snapshot as unknown as Json,
  });
  if (error) throw error;
  return data;
}
