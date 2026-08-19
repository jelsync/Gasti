import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth';
import {
  createTransaction,
  deleteTransaction,
  getTransactions,
  updateTransaction,
  type TransactionFilters,
} from '@/services/transactions.service';
import { mapDbError } from '@/lib/errors';
import type { TransactionWithCategory } from '@/types/models';
import type { TransactionInput } from '@/lib/validations';

export function useTransactions(filters: TransactionFilters = {}) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Serializa los filtros para una dependencia estable.
  const filtersKey = JSON.stringify(filters);
  const stableFilters = useMemo<TransactionFilters>(() => JSON.parse(filtersKey), [filtersKey]);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setTransactions(await getTransactions(stableFilters));
    } catch (e) {
      setError(mapDbError(e, 'No se pudieron cargar las transacciones.'));
    } finally {
      setLoading(false);
    }
  }, [stableFilters]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: TransactionInput) => {
      if (!user) throw new Error('Sesión no válida');
      await createTransaction(user.id, input);
      await refresh();
    },
    [user, refresh],
  );

  const update = useCallback(
    async (id: string, input: TransactionInput) => {
      await updateTransaction(id, input);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteTransaction(id);
      await refresh();
    },
    [refresh],
  );

  return { transactions, loading, error, refresh, create, update, remove };
}
