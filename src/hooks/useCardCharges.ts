import { useCallback, useEffect, useState } from 'react';
import {
  deleteCardCharge,
  getCardCharges,
  type CardChargeWithCard,
} from '@/services/cards.service';
import { mapDbError } from '@/lib/errors';

export function useCardCharges(range: { start: string; end: string }) {
  const [charges, setCharges] = useState<CardChargeWithCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { start, end } = range;

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setCharges(await getCardCharges(start, end));
    } catch (e) {
      setError(mapDbError(e, 'No se pudieron cargar las compras de tarjeta.'));
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const remove = useCallback(
    async (id: string) => {
      await deleteCardCharge(id);
      await refresh();
    },
    [refresh],
  );

  return { charges, loading, error, refresh, remove };
}
