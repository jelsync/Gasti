import { useCallback, useEffect, useState } from 'react';
import { mapDbError } from '@/lib/errors';
import { getSavingsAccountMovements } from '@/services/savings.service';
import type { TransactionWithCategory } from '@/types/models';

export function useSavingsAccountMovements(accountId: string | null) {
  const [movements, setMovements] = useState<TransactionWithCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accountId) {
      setMovements([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setMovements(await getSavingsAccountMovements(accountId));
    } catch (cause) {
      setError(mapDbError(cause, 'No se pudieron cargar los movimientos de la cuenta.'));
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { movements, loading, error, refresh };
}
