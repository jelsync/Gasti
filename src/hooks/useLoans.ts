import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth';
import {
  createLoan,
  deleteLoan,
  getLoans,
  registerExtraPrincipal,
  registerPayment,
  updateLoan,
  type ExtraPaymentResult,
  type PaymentResult,
} from '@/services/loans.service';
import { mapDbError } from '@/lib/errors';
import type { Loan, LoanWithCategory } from '@/types/models';
import type { LoanInput } from '@/lib/validations';

export function useLoans() {
  const { user } = useAuth();
  const [loans, setLoans] = useState<LoanWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setLoans(await getLoans());
    } catch (e) {
      setError(mapDbError(e, 'No se pudieron cargar los préstamos.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: LoanInput) => {
      if (!user) throw new Error('Sesión no válida');
      await createLoan(user.id, input);
      await refresh();
    },
    [user, refresh],
  );

  const update = useCallback(
    async (id: string, input: LoanInput) => {
      await updateLoan(id, input);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteLoan(id);
      await refresh();
    },
    [refresh],
  );

  const pay = useCallback(
    async (loan: Loan): Promise<PaymentResult> => {
      if (!user) throw new Error('Sesión no válida');
      const result = await registerPayment(user.id, loan);
      await refresh();
      return result;
    },
    [user, refresh],
  );

  const payExtra = useCallback(
    async (loan: Loan, amount: number): Promise<ExtraPaymentResult> => {
      if (!user) throw new Error('Sesión no válida');
      const result = await registerExtraPrincipal(user.id, loan, amount);
      await refresh();
      return result;
    },
    [user, refresh],
  );

  return { loans, loading, error, refresh, create, update, remove, pay, payExtra };
}
