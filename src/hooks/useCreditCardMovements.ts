import { useCallback, useEffect, useState } from 'react';
import { mapDbError } from '@/lib/errors';
import {
  deleteCardCharge,
  deleteCardPayment,
  getCreditCardMovements,
  type CardMovement,
} from '@/services/cards.service';

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

  const remove = useCallback(
    async (movement: CardMovement) => {
      if (movement.kind === 'CHARGE') await deleteCardCharge(movement.id);
      else await deleteCardPayment(movement.id);
      await refresh();
    },
    [refresh],
  );

  return { movements, loading, error, refresh, remove };
}
