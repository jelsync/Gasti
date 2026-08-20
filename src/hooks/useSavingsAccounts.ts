import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth';
import {
  createSavingsAccount,
  deleteSavingsAccount,
  getSavingsAccounts,
  updateSavingsAccount,
} from '@/services/savings.service';
import { mapDbError } from '@/lib/errors';
import type { SavingsAccountWithBalance } from '@/types/models';
import type { SavingsAccountInput } from '@/lib/validations';

export function useSavingsAccounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<SavingsAccountWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setAccounts(await getSavingsAccounts());
    } catch (e) {
      setError(mapDbError(e, 'No se pudieron cargar las cuentas de ahorro.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: SavingsAccountInput) => {
      if (!user) throw new Error('Sesión no válida');
      await createSavingsAccount(user.id, input);
      await refresh();
    },
    [user, refresh],
  );

  const update = useCallback(
    async (id: string, input: SavingsAccountInput) => {
      await updateSavingsAccount(id, input);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteSavingsAccount(id);
      await refresh();
    },
    [refresh],
  );

  return { accounts, loading, error, refresh, create, update, remove };
}
