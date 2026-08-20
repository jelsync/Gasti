import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth';
import {
  copyBudgets,
  deleteBudget,
  getBudgets,
  upsertBudget,
  type BudgetWithCategory,
} from '@/services/budgets.service';
import { mapDbError } from '@/lib/errors';
import { previousMonth, type MonthYear } from '@/utils/date';
import type { BudgetInput } from '@/lib/validations';

export function useBudgets(month: MonthYear) {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<BudgetWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { year, month: m } = month;

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setBudgets(await getBudgets(year, m));
    } catch (e) {
      setError(mapDbError(e, 'No se pudieron cargar los presupuestos.'));
    } finally {
      setLoading(false);
    }
  }, [year, m]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (input: BudgetInput) => {
      if (!user) throw new Error('Sesión no válida');
      await upsertBudget(user.id, input);
      await refresh();
    },
    [user, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteBudget(id);
      await refresh();
    },
    [refresh],
  );

  const copyFromPrevious = useCallback(async (): Promise<number> => {
    if (!user) throw new Error('Sesión no válida');
    const count = await copyBudgets(user.id, previousMonth(month), month);
    await refresh();
    return count;
  }, [user, month, refresh]);

  return { budgets, loading, error, refresh, save, remove, copyFromPrevious };
}
