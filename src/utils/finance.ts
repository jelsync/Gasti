import type {
  CategorySummary,
  MonthlySummary,
  TransactionType,
  TransactionWithCategory,
} from '@/types/models';

/** Redondea a 2 decimales evitando ruido de punto flotante. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

interface AmountTyped {
  type: TransactionType;
  amount: number;
}

/** Suma los montos de las transacciones de un tipo dado. */
export function sumByType(transactions: readonly AmountTyped[], type: TransactionType): number {
  const total = transactions.reduce((acc, t) => (t.type === type ? acc + t.amount : acc), 0);
  return round2(total);
}

/** Resumen del mes: ingresos, gastos, ahorro y disponible (ingresos − gastos − ahorro). */
export function monthlySummary(transactions: readonly AmountTyped[]): MonthlySummary {
  const income = sumByType(transactions, 'INCOME');
  const expense = sumByType(transactions, 'EXPENSE');
  const saving = sumByType(transactions, 'SAVING');
  return { income, expense, saving, balance: round2(income - expense - saving) };
}

/**
 * Agrupa las transacciones de un tipo por categoría, sumando montos.
 * Ordena de mayor a menor total. Las transacciones sin categoría se agrupan
 * bajo "Sin categoría".
 */
export function groupByCategory(
  transactions: readonly TransactionWithCategory[],
  type: TransactionType,
): CategorySummary[] {
  const map = new Map<string, CategorySummary>();

  for (const t of transactions) {
    if (t.type !== type) continue;
    const key = t.category?.id ?? '__none__';
    const existing = map.get(key);
    if (existing) {
      existing.total = round2(existing.total + t.amount);
    } else {
      map.set(key, {
        categoryId: t.category?.id ?? null,
        name: t.category?.name ?? 'Sin categoría',
        color: t.category?.color ?? '#94a3b8',
        icon: t.category?.icon ?? 'circle',
        total: round2(t.amount),
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export interface BudgetProgress {
  spent: number;
  remaining: number;
  percentage: number;
}

/**
 * Calcula el avance de un presupuesto.
 * - remaining puede ser negativo (sobregiro).
 * - percentage no se recorta a 100 (permite mostrar sobregiro).
 */
export function budgetProgress(budgetAmount: number, spent: number): BudgetProgress {
  const safeSpent = round2(spent);
  const percentage = budgetAmount > 0 ? round2((safeSpent / budgetAmount) * 100) : 0;
  return {
    spent: safeSpent,
    remaining: round2(budgetAmount - safeSpent),
    percentage,
  };
}

/** Porcentaje total de presupuesto utilizado (gastado / presupuestado). */
export function totalBudgetUsage(budgetTotal: number, spentTotal: number): number {
  if (budgetTotal <= 0) return 0;
  return round2((spentTotal / budgetTotal) * 100);
}
