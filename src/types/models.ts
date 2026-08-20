import type { Currency, Database, TransactionType } from '@/types/database.types';

export type { TransactionType, Currency };

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type Budget = Database['public']['Tables']['budgets']['Row'];
export type Loan = Database['public']['Tables']['loans']['Row'];
export type CreditCard = Database['public']['Tables']['credit_cards']['Row'];
export type SavingsAccount = Database['public']['Tables']['savings_accounts']['Row'];

/** Préstamo con su categoría de pago embebida. */
export interface LoanWithCategory extends Loan {
  category: Pick<Category, 'id' | 'name' | 'icon' | 'color'> | null;
}

/** Tarjeta de crédito con sus deudas calculadas (Lempiras y Dólares). */
export interface CreditCardWithBalance extends CreditCard {
  balanceHnl: number;
  balanceUsd: number;
}

/** Cuenta de ahorro con su saldo calculado. */
export interface SavingsAccountWithBalance extends SavingsAccount {
  balance: number;
}

/** Transacción con su categoría (y tarjeta/ahorro) embebidas (resultado de un join). */
export interface TransactionWithCategory extends Transaction {
  category: Pick<Category, 'id' | 'name' | 'icon' | 'color' | 'type'> | null;
  credit_card?: Pick<CreditCard, 'id' | 'name' | 'color'> | null;
  savings_account?: Pick<SavingsAccount, 'id' | 'name' | 'color'> | null;
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

/** Resumen financiero de un mes. Disponible = ingresos − gastos (el ahorro es informativo). */
export interface MonthlySummary {
  income: number;
  expense: number;
  saving: number;
  balance: number;
}
