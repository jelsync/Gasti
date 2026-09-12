import { createContext, useContext } from 'react';

export const PRIVACY_KEYS = {
  income: 'income',
  accountsTotal: 'accounts-total',
  account: (accountId: string) => `account:${accountId}`,
} as const;

export interface PrivacyContextValue {
  isHidden: (key: string) => boolean;
  toggle: (key: string) => void;
}

export const PrivacyContext = createContext<PrivacyContextValue | undefined>(undefined);

export function usePrivacy(): PrivacyContextValue {
  const context = useContext(PrivacyContext);
  if (!context) {
    throw new Error('usePrivacy debe usarse dentro de <PrivacyProvider>');
  }
  return context;
}
