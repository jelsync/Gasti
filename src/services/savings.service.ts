import { supabase } from '@/lib/supabase';
import { accountMovementAmount, round2 } from '@/utils/finance';
import type {
  SavingsAccount,
  SavingsAccountMovement,
  SavingsAccountWithBalance,
  TransactionWithCategory,
} from '@/types/models';
import type { SavingsAccountInput } from '@/lib/validations';

/**
 * Cuentas con saldo calculado: apertura + movimientos + ajustes de conciliación aplicados.
 */
export async function getSavingsAccounts(): Promise<SavingsAccountWithBalance[]> {
  const [accountsRes, contribRes, reconciliationRes] = await Promise.all([
    supabase.from('savings_accounts').select('*').order('created_at', { ascending: true }),
    supabase
      .from('transactions')
      .select('savings_account_id, destination_savings_account_id, amount, type, currency')
      .in('type', ['INCOME', 'SAVING', 'EXPENSE', 'TRANSFER'])
      .eq('currency', 'HNL')
      .or('savings_account_id.not.is.null,destination_savings_account_id.not.is.null'),
    supabase
      .from('account_reconciliations')
      .select('savings_account_id, difference')
      .eq('apply_adjustment', true),
  ]);

  if (accountsRes.error) throw accountsRes.error;
  if (contribRes.error) throw contribRes.error;
  if (reconciliationRes.error) throw reconciliationRes.error;

  const movements = new Map<string, number>();
  for (const row of contribRes.data ?? []) {
    if (row.savings_account_id) {
      movements.set(
        row.savings_account_id,
        round2(
          (movements.get(row.savings_account_id) ?? 0) +
            accountMovementAmount(
              { type: row.type, amount: row.amount, currency: row.currency },
              'SOURCE',
            ),
        ),
      );
    }
    if (row.destination_savings_account_id) {
      movements.set(
        row.destination_savings_account_id,
        round2(
          (movements.get(row.destination_savings_account_id) ?? 0) +
            accountMovementAmount(
              { type: row.type, amount: row.amount, currency: row.currency },
              'DESTINATION',
            ),
        ),
      );
    }
  }
  for (const row of reconciliationRes.data ?? []) {
    movements.set(
      row.savings_account_id,
      round2((movements.get(row.savings_account_id) ?? 0) + row.difference),
    );
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
): Promise<SavingsAccountMovement[]> {
  const [transactionsRes, reconciliationsRes] = await Promise.all([
    supabase
      .from('transactions')
      .select(
        '*, category:categories(id, name, icon, color, type), credit_card:credit_cards(id, name, color), savings_account:savings_accounts!transactions_savings_account_id_fkey(id, name, color), destination_savings_account:savings_accounts!transactions_destination_savings_account_id_fkey(id, name, color), receivable_person:receivable_people(id, name)',
      )
      .or(`savings_account_id.eq.${accountId},destination_savings_account_id.eq.${accountId}`)
      .in('type', ['INCOME', 'SAVING', 'EXPENSE', 'TRANSFER'])
      .eq('currency', 'HNL')
      .returns<TransactionWithCategory[]>(),
    supabase
      .from('account_reconciliations')
      .select('*')
      .eq('savings_account_id', accountId)
      .eq('apply_adjustment', true),
  ]);

  if (transactionsRes.error) throw transactionsRes.error;
  if (reconciliationsRes.error) throw reconciliationsRes.error;
  return [
    ...(transactionsRes.data ?? []).map((transaction) => ({
      kind: 'TRANSACTION' as const,
      id: transaction.id,
      date: transaction.transaction_date,
      createdAt: transaction.created_at,
      transaction,
    })),
    ...(reconciliationsRes.data ?? []).map((reconciliation) => ({
      kind: 'RECONCILIATION' as const,
      id: reconciliation.id,
      date: reconciliation.reconciliation_date,
      createdAt: reconciliation.created_at,
      reconciliation,
    })),
  ].sort(
    (left, right) =>
      right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt),
  );
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
      account_number: input.account_number ?? '',
      opening_balance: input.opening_balance,
      include_in_savings_goal: input.include_in_savings_goal,
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
      account_number: input.account_number ?? '',
      opening_balance: input.opening_balance,
      include_in_savings_goal: input.include_in_savings_goal,
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
