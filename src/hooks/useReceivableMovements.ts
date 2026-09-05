import { useCallback, useEffect, useState } from 'react';
import { mapDbError } from '@/lib/errors';
import { getReceivableMovements } from '@/services/receivables.service';
import type { TransactionWithCategory } from '@/types/models';

export function useReceivableMovements(personId: string | null, refreshKey = 0) {
  const [movements, setMovements] = useState<TransactionWithCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!personId) {
      setMovements([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setMovements(await getReceivableMovements(personId));
    } catch (cause) {
      setError(mapDbError(cause, 'No se pudieron cargar los movimientos de esta persona.'));
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    void refreshKey;
    void refresh();
  }, [refresh, refreshKey]);

  return { movements, loading, error, refresh };
}
