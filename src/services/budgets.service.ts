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

/** Crea o actualiza el presupuesto de una categoría para un periodo. */
export async function upsertBudget(userId: string, input: BudgetInput): Promise<Budget> {
  const { data, error } = await supabase
    .from('budgets')
    .upsert(
      {
        user_id: userId,
        category_id: input.category_id,
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
