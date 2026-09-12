import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth';
import { mapDbError } from '@/lib/errors';
import type { FinancialGoalInput, FinancialGoalMovementInput } from '@/lib/validations';
import type { FinancialGoalMovement, FinancialGoalWithProgress } from '@/types/models';
import {
  addFinancialGoalMovement,
  createFinancialGoal,
  deleteFinancialGoal,
  getFinancialGoalMovements,
  getFinancialGoals,
  updateFinancialGoal,
} from '@/services/financialGoals.service';

export function useFinancialGoals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<FinancialGoalWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setGoals(await getFinancialGoals());
    } catch (cause) {
      setError(mapDbError(cause, 'No se pudieron cargar las metas.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: FinancialGoalInput) => {
      if (!user) throw new Error('Sesión no válida');
      await createFinancialGoal(user.id, input);
      await refresh();
    },
    [user, refresh],
  );

  const update = useCallback(
    async (id: string, input: FinancialGoalInput) => {
      if (!user) throw new Error('Sesión no válida');
      await updateFinancialGoal(id, user.id, input);
      await refresh();
    },
    [user, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteFinancialGoal(id);
      await refresh();
    },
    [refresh],
  );

  const addMovement = useCallback(
    async (goalId: string, input: FinancialGoalMovementInput) => {
      await addFinancialGoalMovement(goalId, input);
      await refresh();
    },
    [refresh],
  );

  return { goals, loading, error, refresh, create, update, remove, addMovement };
}

export function useFinancialGoalMovements(goalId: string | null, refreshKey = 0) {
  const [movements, setMovements] = useState<FinancialGoalMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!goalId) {
      setMovements([]);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    void getFinancialGoalMovements(goalId)
      .then((next) => {
        if (active) setMovements(next);
      })
      .catch((cause) => {
        if (active) setError(mapDbError(cause, 'No se pudieron cargar los movimientos.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [goalId, refreshKey]);

  return { movements, loading, error };
}
