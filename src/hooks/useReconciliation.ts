import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth';
import { mapDbError } from '@/lib/errors';
import type {
  AccountReconciliationWithAccount,
  MonthClosure,
  SavingsAccountWithBalance,
} from '@/types/models';
import type { AccountReconciliationInput } from '@/lib/validations';
import { monthRange, todayISO, type MonthYear } from '@/utils/date';
import {
  createAccountReconciliation,
  deleteAccountReconciliation,
  getAccountBalancesAt,
  getAccountReconciliations,
  getMonthClosure,
  saveMonthClosure,
  type MonthClosureSnapshot,
} from '@/services/reconciliation.service';

export function useReconciliation(month: MonthYear) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<SavingsAccountWithBalance[]>([]);
  const [reconciliations, setReconciliations] = useState<AccountReconciliationWithAccount[]>([]);
  const [closure, setClosure] = useState<MonthClosure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { year, month: monthNumber } = month;

  const refresh = useCallback(async () => {
    const range = monthRange(year, monthNumber);
    const balanceDate = range.end < todayISO() ? range.end : todayISO();
    try {
      setLoading(true);
      setError(null);
      const [nextAccounts, nextReconciliations, nextClosure] = await Promise.all([
        getAccountBalancesAt(balanceDate),
        getAccountReconciliations(range.start, range.end),
        getMonthClosure({ year, month: monthNumber }),
      ]);
      setAccounts(nextAccounts);
      setReconciliations(nextReconciliations);
      setClosure(nextClosure);
    } catch (cause) {
      setError(mapDbError(cause, 'No se pudo cargar la conciliación mensual.'));
    } finally {
      setLoading(false);
    }
  }, [year, monthNumber]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const reconcile = useCallback(
    async (input: AccountReconciliationInput) => {
      if (!user) throw new Error('Sesión no válida');
      await createAccountReconciliation(user.id, input);
      await refresh();
    },
    [user, refresh],
  );

  const removeReconciliation = useCallback(
    async (id: string) => {
      await deleteAccountReconciliation(id);
      await refresh();
    },
    [refresh],
  );

  const closeMonth = useCallback(
    async (snapshot: MonthClosureSnapshot, notes: string) => {
      if (!user) throw new Error('Sesión no válida');
      await saveMonthClosure(user.id, { year, month: monthNumber }, snapshot, notes);
      await refresh();
    },
    [user, year, monthNumber, refresh],
  );

  return {
    accounts,
    reconciliations,
    closure,
    loading,
    error,
    refresh,
    reconcile,
    removeReconciliation,
    closeMonth,
  };
}
