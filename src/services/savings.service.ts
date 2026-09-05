import { supabase } from '@/lib/supabase';
import { accountMovementAmount, round2 } from '@/utils/finance';
import type {
  SavingsAccount,
  SavingsAccountWithBalance,
  TransactionWithCategory,
} from '@/types/models';
import type { SavingsAccountInput } from '@/lib/validations';

/**
 * Cuentas con saldo calculado: apertura + ingresos/aportes − gastos debitados.
 */
export async function getSavingsAccounts(): Promise<SavingsAccountWithBalance[]> {
  const [accountsRes, contribRes] = await Promise.all([
    supabase.from('savings_accounts').select('*').order('created_at', { ascending: true }),
    supabase
      .from('transactions')
      .select('savings_account_id, destination_savings_account_id, amount, type')
      .in('type', ['INCOME', 'SAVING', 'EXPENSE', 'TRANSFER'])
      .or('savings_account_id.not.is.null,destination_savings_account_id.not.is.null'),
  ]);

  if (accountsRes.error) throw accountsRes.error;
  if (contribRes.error) throw contribRes.error;

  const movements = new Map<string, number>();
  for (const row of contribRes.data ?? []) {
    if (row.savings_account_id) {
      movements.set(
        row.savings_account_id,
        round2(
          (movements.get(row.savings_account_id) ?? 0) +
            accountMovementAmount({ type: row.type, amount: row.amount }, 'SOURCE'),
        ),
      );
    }
    if (row.destination_savings_account_id) {
      movements.set(
        row.destination_savings_account_id,
        round2(
          (movements.get(row.destination_savings_account_id) ?? 0) +
            accountMovementAmount({ type: row.type, amount: row.amount }, 'DESTINATION'),
        ),
      );
    }
  }

  return (accountsRes.data ?? []).map((account) => {
    const movementBalance = movements.get(account.id) ?? 0;
    return {
      ...account,
      movementBalance,
      balance: round2(account.opening_balance + movementBalance),
    };
  });
}

/** Ingresos, aportes y débitos de una cuenta, del más reciente al más antiguo. */
export async function getSavingsAccountMovements(
  accountId: string,
): Promise<TransactionWithCategory[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select(
      '*, category:categories(id, name, icon, color, type), credit_card:credit_cards(id, name, color), savings_account:savings_accounts!transactions_savings_account_id_fkey(id, name, color), destination_savings_account:savings_accounts!transactions_destination_savings_account_id_fkey(id, name, color)',
    )
    .or(`savings_account_id.eq.${accountId},destination_savings_account_id.eq.${accountId}`)
    .in('type', ['INCOME', 'SAVING', 'EXPENSE', 'TRANSFER'])
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .returns<TransactionWithCategory[]>();

  if (error) throw error;
  return data ?? [];
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
