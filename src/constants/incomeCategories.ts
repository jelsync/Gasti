import type { Category } from '@/types/models';

export const INCOME_CATEGORY_NAMES = [
  'Salario',
  'Transferencias recibidas',
  'Bonos',
  'Otros ingresos',
] as const;

const incomeCategoryOrder = new Map<string, number>(
  INCOME_CATEGORY_NAMES.map((name, index) => [name, index]),
);

/** Las categorías de ingreso son fijas para mantener reportes consistentes. */
export function getIncomeCategories(categories: Category[]): Category[] {
  return categories
    .filter((category) => category.type === 'INCOME' && incomeCategoryOrder.has(category.name))
    .sort(
      (left, right) =>
        (incomeCategoryOrder.get(left.name) ?? 0) - (incomeCategoryOrder.get(right.name) ?? 0),
    );
}
