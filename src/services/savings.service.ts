import { supabase } from '@/lib/supabase';
import { round2 } from '@/utils/finance';
import type { SavingsAccount, SavingsAccountWithBalance } from '@/types/models';
import type { SavingsAccountInput } from '@/lib/validations';

/**
 * Cuentas de ahorro con su saldo calculado: apertura + aportes (movimientos SAVING).
 */
export async function getSavingsAccounts(): Promise<SavingsAccountWithBalance[]> {
  const [accountsRes, contribRes] = await Promise.all([
    supabase.from('savings_accounts').select('*').order('created_at', { ascending: true }),
    supabase
      .from('transactions')
      .select('savings_account_id, amount')
      .eq('type', 'SAVING')
      .not('savings_account_id', 'is', null),
  ]);

  if (accountsRes.error) throw accountsRes.error;
  if (contribRes.error) throw contribRes.error;

  const contributions = new Map<string, number>();
  for (const row of contribRes.data ?? []) {
    if (!row.savings_account_id) continue;
    contributions.set(
      row.savings_account_id,
      round2((contributions.get(row.savings_account_id) ?? 0) + row.amount),
    );
  }

  return (accountsRes.data ?? []).map((account) => ({
    ...account,
    balance: round2(account.opening_balance + (contributions.get(account.id) ?? 0)),
  }));
}

export async function createSavingsAccount(
  userId: string,
  input: SavingsAccountInput,
): Promise<SavingsAccount> {
  const { data, error } = await supabase
    .from('savings_accounts')
    .insert({
      user_id: userId,
      name: input.name,
      institution: input.institution ?? '',
      opening_balance: input.opening_balance,
      color: input.color,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateSavingsAccount(
  id: string,
  input: SavingsAccountInput,
): Promise<SavingsAccount> {
  const { data, error } = await supabase
    .from('savings_accounts')
    .update({
      name: input.name,
      institution: input.institution ?? '',
      opening_balance: input.opening_balance,
      color: input.color,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSavingsAccount(id: string): Promise<void> {
  const { error } = await supabase.from('savings_accounts').delete().eq('id', id);
  if (error) throw error;
}
