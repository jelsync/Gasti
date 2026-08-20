import { supabase } from '@/lib/supabase';
import type { Budget, Category } from '@/types/models';
import type { BudgetInput } from '@/lib/validations';

export interface BudgetWithCategory extends Budget {
  category: Pick<Category, 'id' | 'name' | 'icon' | 'color'> | null;
}

const SELECT_WITH_CATEGORY = '*, category:categories(id, name, icon, color)';

/** Presupuestos de un mes/año (con su categoría). */
export async function getBudgets(year: number, month: number): Promise<BudgetWithCategory[]> {
  const { data, error } = await supabase
    .from('budgets')
    .select(SELECT_WITH_CATEGORY)
    .eq('year', year)
    .eq('month', month)
    .returns<BudgetWithCategory[]>();

  if (error) throw error;
  return data ?? [];
}

/** Crea o actualiza un presupuesto (por categoría de gasto o meta de ahorro). */
export async function upsertBudget(userId: string, input: BudgetInput): Promise<Budget> {
  // Meta de ahorro: una por mes (category_id null); busca existente y actualiza.
  if (input.kind === 'SAVINGS') {
    const { data: existing, error: findError } = await supabase
      .from('budgets')
      .select('id')
      .eq('user_id', userId)
      .eq('kind', 'SAVINGS')
      .eq('year', input.year)
      .eq('month', input.month)
      .maybeSingle();
    if (findError) throw findError;

    if (existing) {
      const { data, error } = await supabase
        .from('budgets')
        .update({ amount: input.amount })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase
      .from('budgets')
      .insert({
        user_id: userId,
        category_id: null,
        kind: 'SAVINGS',
        amount: input.amount,
        month: input.month,
        year: input.year,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  // Presupuesto por categoría de gasto.
  const { data, error } = await supabase
    .from('budgets')
    .upsert(
      {
        user_id: userId,
        category_id: input.category_id,
        kind: 'CATEGORY',
        amount: input.amount,
        month: input.month,
        year: input.year,
      },
      { onConflict: 'user_id,category_id,year,month' },
    )
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBudget(id: string): Promise<void> {
  const { error } = await supabase.from('budgets').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Copia los presupuestos de un mes/año origen a un mes/año destino (upsert).
 * Devuelve la cantidad copiada.
 */
export async function copyBudgets(
  userId: string,
  from: { year: number; month: number },
  to: { year: number; month: number },
): Promise<number> {
  const source = await getBudgets(from.year, from.month);
  if (source.length === 0) return 0;

  for (const b of source) {
    await upsertBudget(userId, {
      kind: b.kind,
      category_id: b.category_id,
      amount: b.amount,
      month: to.month,
      year: to.year,
    });
  }
  return source.length;
}
