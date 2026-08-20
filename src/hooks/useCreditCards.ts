import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth';
import {
  createCreditCard,
  deleteCreditCard,
  getCreditCards,
  registerCardPayment,
  updateCreditCard,
} from '@/services/cards.service';
import { mapDbError } from '@/lib/errors';
import type { CreditCardWithBalance } from '@/types/models';
import type { CreditCardInput } from '@/lib/validations';

export function useCreditCards() {
  const { user } = useAuth();
  const [cards, setCards] = useState<CreditCardWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setCards(await getCreditCards());
    } catch (e) {
      setError(mapDbError(e, 'No se pudieron cargar las tarjetas.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: CreditCardInput) => {
      if (!user) throw new Error('Sesión no válida');
      await createCreditCard(user.id, input);
      await refresh();
    },
    [user, refresh],
  );

  const update = useCallback(
    async (id: string, input: CreditCardInput) => {
      await updateCreditCard(id, input);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteCreditCard(id);
      await refresh();
    },
    [refresh],
  );

  const payCard = useCallback(
    async (cardId: string, amount: number) => {
      if (!user) throw new Error('Sesión no válida');
      await registerCardPayment(user.id, cardId, amount);
      await refresh();
    },
    [user, refresh],
  );

  return { cards, loading, error, refresh, create, update, remove, payCard };
}
