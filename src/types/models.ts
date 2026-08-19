import type { Database, TransactionType } from '@/types/database.types';

export type { TransactionType };

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type Budget = Database['public']['Tables']['budgets']['Row'];

/** Transacción con su categoría embebida (resultado de un join). */
export interface TransactionWithCategory extends Transaction {
  category: Pick<Category, 'id' | 'name' | 'icon' | 'color' | 'type'> | null;
}

/** Presupuesto enriquecido con lo gastado y el cálculo de avance. */
export interface BudgetWithProgress extends Budget {
  category: Pick<Category, 'id' | 'name' | 'icon' | 'color'> | null;
  spent: number;
  remaining: number;
  percentage: number;
}

/** Agregado de gasto/ingreso por categoría (para gráficos y dashboard). */
export interface CategorySummary {
  categoryId: string | null;
  name: string;
  color: string;
  icon: string;
  total: number;
}

/** Resumen financiero de un mes. */
export interface MonthlySummary {
  income: number;
  expense: number;
  balance: number;
}
