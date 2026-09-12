import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth';
import { mapDbError } from '@/lib/errors';
import type { RecurringOccurrence, RecurringTransactionWithRelations } from '@/types/models';
import type { RecurringTransactionInput } from '@/lib/validations';
import { getCurrentMonthYear, monthRange } from '@/utils/date';
import {
  confirmRecurringTransaction,
  createRecurringTransaction,
  deleteRecurringTransaction,
  getRecurringOccurrences,
  getRecurringTransactions,
  restoreSkippedRecurringOccurrence,
  setRecurringTransactionActive,
  skipRecurringOccurrence,
  updateRecurringTransaction,
} from '@/services/recurring.service';

export function useRecurringTransactions(month = getCurrentMonthYear()) {
  const { user } = useAuth();
  const { year, month: monthNumber } = month;
  const [rules, setRules] = useState<RecurringTransactionWithRelations[]>([]);
  const [occurrences, setOccurrences] = useState<RecurringOccurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const range = monthRange(year, monthNumber);
    try {
      setLoading(true);
      setError(null);
      const [nextRules, nextOccurrences] = await Promise.all([
        getRecurringTransactions(),
        getRecurringOccurrences(range.start, range.end),
      ]);
      setRules(nextRules);
      setOccurrences(nextOccurrences);
    } catch (cause) {
      setError(mapDbError(cause, 'No se pudieron cargar las transacciones recurrentes.'));
    } finally {
      setLoading(false);
    }
  }, [year, monthNumber]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: RecurringTransactionInput) => {
      if (!user) throw new Error('Sesión no válida');
      await createRecurringTransaction(user.id, input);
      await refresh();
    },
    [user, refresh],
  );

  const update = useCallback(
    async (id: string, input: RecurringTransactionInput) => {
      await updateRecurringTransaction(id, input);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteRecurringTransaction(id);
      await refresh();
    },
    [refresh],
  );

  const setActive = useCallback(
    async (id: string, active: boolean) => {
      await setRecurringTransactionActive(id, active);
      await refresh();
    },
    [refresh],
  );

  const confirm = useCallback(
    async (id: string, dueDate: string) => {
      await confirmRecurringTransaction(id, dueDate);
      await refresh();
    },
    [refresh],
  );

  const skip = useCallback(
    async (id: string, dueDate: string) => {
      await skipRecurringOccurrence(id, dueDate);
      await refresh();
    },
    [refresh],
  );

  const restoreSkipped = useCallback(
    async (occurrenceId: string) => {
      await restoreSkippedRecurringOccurrence(occurrenceId);
      await refresh();
    },
    [refresh],
  );

  return {
    rules,
    occurrences,
    loading,
    error,
    refresh,
    create,
    update,
    remove,
    setActive,
    confirm,
    skip,
    restoreSkipped,
  };
}
