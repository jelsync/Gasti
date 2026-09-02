import { useCallback, useEffect, useState } from 'react';
import { mapDbError } from '@/lib/errors';
import { getLoanMovements, type LoanMovement } from '@/services/loans.service';

export function useLoanMovements(loanId: string | null, refreshKey = 0) {
  const [movements, setMovements] = useState<LoanMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!loanId) {
      setMovements([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setMovements(await getLoanMovements(loanId));
    } catch (cause) {
      setError(mapDbError(cause, 'No se pudieron cargar los movimientos del préstamo.'));
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    void refreshKey;
    void refresh();
  }, [refresh, refreshKey]);

  return { movements, loading, error, refresh };
}
