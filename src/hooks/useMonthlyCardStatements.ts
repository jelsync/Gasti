import { useCallback, useEffect, useRef, useState } from 'react';
import { getCardStatements } from '@/services/cardStatements.service';
import { mapDbError } from '@/lib/errors';
import type { CardStatement } from '@/types/models';
import type { MonthYear } from '@/utils/date';

/** Cortes confirmados del mes para completar los recordatorios del calendario. */
export function useMonthlyCardStatements(month: MonthYear) {
  const [statements, setStatements] = useState<CardStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const { year, month: monthNumber } = month;

  const refresh = useCallback(async () => {
    const request = ++requestRef.current;
    try {
      setLoading(true);
      setError(null);
      const nextStatements = await getCardStatements(undefined, { year, month: monthNumber });
      if (request === requestRef.current) setStatements(nextStatements);
    } catch (cause) {
      if (request === requestRef.current) {
        setStatements([]);
        setError(mapDbError(cause, 'No se pudieron cargar los cortes de tarjeta.'));
      }
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [year, monthNumber]);

  useEffect(() => {
    void refresh();
    return () => {
      requestRef.current += 1;
    };
  }, [refresh]);

  return { statements, loading, error, refresh };
}
