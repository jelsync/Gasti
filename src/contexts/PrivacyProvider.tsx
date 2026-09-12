import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/auth';
import { PrivacyContext, type PrivacyContextValue } from '@/contexts/privacy';

const STORAGE_PREFIX = 'gasti:privacy:';

function readHiddenKeys(userId: string | undefined): Set<string> {
  if (!userId || typeof window === 'undefined') return new Set();
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}${userId}`) ?? '[]');
    return new Set(
      Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === 'string') : [],
    );
  } catch {
    return new Set();
  }
}

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => readHiddenKeys(user?.id));

  useEffect(() => {
    setHiddenKeys(readHiddenKeys(user?.id));
  }, [user?.id]);

  const isHidden = useCallback((key: string) => hiddenKeys.has(key), [hiddenKeys]);

  const toggle = useCallback(
    (key: string) => {
      setHiddenKeys((current) => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        if (user?.id) {
          try {
            localStorage.setItem(`${STORAGE_PREFIX}${user.id}`, JSON.stringify([...next]));
          } catch {
            // El control sigue funcionando durante la sesión aunque el navegador bloquee el almacenamiento.
          }
        }
        return next;
      });
    },
    [user?.id],
  );

  const value = useMemo<PrivacyContextValue>(() => ({ isHidden, toggle }), [isHidden, toggle]);

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}
