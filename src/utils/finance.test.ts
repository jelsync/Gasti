import { describe, expect, it } from 'vitest';
import {
  budgetProgress,
  groupByCategory,
  monthlySummary,
  round2,
  sumByType,
  totalBudgetUsage,
} from '@/utils/finance';
import type { TransactionWithCategory } from '@/types/models';

function tx(
  overrides: Partial<TransactionWithCategory> & Pick<TransactionWithCategory, 'type' | 'amount'>,
): TransactionWithCategory {
  return {
    id: crypto.randomUUID(),
    user_id: 'u1',
    category_id: overrides.category?.id ?? null,
    description: '',
    transaction_date: '2026-08-10',
    created_at: '',
    updated_at: '',
    category: null,
    ...overrides,
  };
}

describe('round2', () => {
  it('redondea a dos decimales', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(2.675)).toBe(2.68);
  });
});

describe('sumByType', () => {
  it('suma solo el tipo indicado', () => {
    const list = [
      tx({ type: 'INCOME', amount: 100 }),
      tx({ type: 'EXPENSE', amount: 30 }),
      tx({ type: 'INCOME', amount: 50.5 }),
    ];
    expect(sumByType(list, 'INCOME')).toBe(150.5);
    expect(sumByType(list, 'EXPENSE')).toBe(30);
  });

  it('devuelve 0 sin coincidencias', () => {
    expect(sumByType([], 'INCOME')).toBe(0);
  });
});

describe('monthlySummary', () => {
  it('calcula ingresos, gastos y balance', () => {
    const list = [tx({ type: 'INCOME', amount: 25000 }), tx({ type: 'EXPENSE', amount: 14850 })];
    expect(monthlySummary(list)).toEqual({ income: 25000, expense: 14850, balance: 10150 });
  });

  it('balance puede ser negativo', () => {
    const list = [tx({ type: 'INCOME', amount: 100 }), tx({ type: 'EXPENSE', amount: 250 })];
    expect(monthlySummary(list).balance).toBe(-150);
  });
});

describe('groupByCategory', () => {
  const cat = (id: string, name: string) => ({
    id,
    name,
    icon: 'circle',
    color: '#000000',
    type: 'EXPENSE' as const,
  });

  it('agrupa y suma por categoría, ordenado desc', () => {
    const list = [
      tx({ type: 'EXPENSE', amount: 100, category: cat('a', 'Alimentación') }),
      tx({ type: 'EXPENSE', amount: 50, category: cat('a', 'Alimentación') }),
      tx({ type: 'EXPENSE', amount: 200, category: cat('b', 'Transporte') }),
      tx({ type: 'INCOME', amount: 999, category: cat('c', 'Salario') }),
    ];
    const result = groupByCategory(list, 'EXPENSE');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ name: 'Transporte', total: 200 });
    expect(result[1]).toMatchObject({ name: 'Alimentación', total: 150 });
  });

  it('agrupa transacciones sin categoría como "Sin categoría"', () => {
    const list = [tx({ type: 'EXPENSE', amount: 40, category: null })];
    const result = groupByCategory(list, 'EXPENSE');
    expect(result[0]).toMatchObject({ name: 'Sin categoría', categoryId: null, total: 40 });
  });
});

describe('budgetProgress', () => {
  it('calcula gastado, disponible y porcentaje', () => {
    expect(budgetProgress(5000, 3750)).toEqual({ spent: 3750, remaining: 1250, percentage: 75 });
  });

  it('permite sobregiro (remaining negativo, % > 100)', () => {
    const result = budgetProgress(1000, 1500);
    expect(result.remaining).toBe(-500);
    expect(result.percentage).toBe(150);
  });

  it('evita división por cero', () => {
    expect(budgetProgress(0, 100).percentage).toBe(0);
  });
});

describe('totalBudgetUsage', () => {
  it('calcula el porcentaje total', () => {
    expect(totalBudgetUsage(10000, 2500)).toBe(25);
  });
  it('devuelve 0 si no hay presupuesto', () => {
    expect(totalBudgetUsage(0, 500)).toBe(0);
  });
});
