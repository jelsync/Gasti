import { useCallback, useEffect, useState } from 'react';
import { mapDbError } from '@/lib/errors';
import { getCreditCardMovements, type CardMovement } from '@/services/cards.service';

export function useCreditCardMovements(cardId: string | null) {
  const [movements, setMovements] = useState<CardMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!cardId) {
      setMovements([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setMovements(await getCreditCardMovements(cardId));
    } catch (cause) {
      setError(mapDbError(cause, 'No se pudieron cargar los movimientos de la tarjeta.'));
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { movements, loading, error, refresh };
}
