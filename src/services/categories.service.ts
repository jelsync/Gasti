import { supabase } from '@/lib/supabase';
import type { Category, TransactionType } from '@/types/models';
import type { CategoryInput } from '@/lib/validations';

/** Lista las categorías del usuario (RLS restringe a las propias). */
export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('type', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createCategory(userId: string, input: CategoryInput): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ user_id: userId, ...input })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateCategory(id: string, input: CategoryInput): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .update(input)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

/** Agrupa categorías por tipo, útil para selects. */
export function splitCategoriesByType(categories: Category[]): Record<TransactionType, Category[]> {
  return {
    INCOME: categories.filter((c) => c.type === 'INCOME'),
    EXPENSE: categories.filter((c) => c.type === 'EXPENSE'),
  };
}
