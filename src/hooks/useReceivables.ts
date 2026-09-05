import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth';
import { mapDbError } from '@/lib/errors';
import {
  createReceivablePerson,
  deleteReceivableMovement,
  getReceivablePeople,
  registerReceivableLend,
  registerReceivableRepayment,
  updateReceivablePerson,
} from '@/services/receivables.service';
import type { ReceivablePersonWithBalance } from '@/types/models';
import type {
  ReceivableCreateInput,
  ReceivableMovementInput,
  ReceivablePersonInput,
} from '@/lib/validations';

export function useReceivables() {
  const { user } = useAuth();
  const [people, setPeople] = useState<ReceivablePersonWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setPeople(await getReceivablePeople());
    } catch (cause) {
      setError(mapDbError(cause, 'No se pudieron cargar las personas que te deben.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: ReceivableCreateInput) => {
      if (!user) throw new Error('Sesión no válida');
      const person = await createReceivablePerson(user.id, input);
      await refresh();
      return person;
    },
    [user, refresh],
  );

  const update = useCallback(
    async (id: string, input: ReceivablePersonInput) => {
      await updateReceivablePerson(id, input);
      await refresh();
    },
    [refresh],
  );

  const lend = useCallback(
    async (person: ReceivablePersonWithBalance, input: ReceivableMovementInput) => {
      if (!user) throw new Error('Sesión no válida');
      await registerReceivableLend(user.id, person, input);
      await refresh();
    },
    [user, refresh],
  );

  const repay = useCallback(
    async (person: ReceivablePersonWithBalance, input: ReceivableMovementInput) => {
      if (!user) throw new Error('Sesión no válida');
      await registerReceivableRepayment(user.id, person, input);
      await refresh();
    },
    [user, refresh],
  );

  const removeMovement = useCallback(
    async (id: string) => {
      await deleteReceivableMovement(id);
      await refresh();
    },
    [refresh],
  );

  return { people, loading, error, refresh, create, update, lend, repay, removeMovement };
}
