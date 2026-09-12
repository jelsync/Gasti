import { supabase } from '@/lib/supabase';
import { accountMovementAmount, round2 } from '@/utils/finance';
import type { Json } from '@/types/database.types';
import type {
  AccountReconciliation,
  AccountReconciliationWithAccount,
  MonthClosure,
  SavingsAccountWithBalance,
} from '@/types/models';
import type { AccountReconciliationInput } from '@/lib/validations';
import type { MonthYear } from '@/utils/date';

export interface MonthClosureSnapshot {
  generatedAt: string;
  accounts: Array<{ id: string; name: string; balance: number }>;
  summary: { incomeHnl: number; expenseHnl: number; incomeUsd: number; expenseUsd: number };
  debts: { loansHnl: number; cardsHnl: number; cardsUsd: number };
}

/** Saldo de cada cuenta al final de una fecha, incluyendo ajustes ya aplicados. */
export async function getAccountBalancesAt(endDate: string): Promise<SavingsAccountWithBalance[]> {
  const [accountsRes, transactionsRes, reconciliationsRes] = await Promise.all([
    supabase.from('savings_accounts').select('*').order('created_at', { ascending: true }),
    supabase
      .from('transactions')
      .select('savings_account_id, destination_savings_account_id, amount, type, currency')
      .lte('transaction_date', endDate)
      .in('type', ['INCOME', 'SAVING', 'EXPENSE', 'TRANSFER'])
      .eq('currency', 'HNL')
      .or('savings_account_id.not.is.null,destination_savings_account_id.not.is.null'),
    supabase
      .from('account_reconciliations')
      .select('savings_account_id, difference')
      .eq('apply_adjustment', true)
      .lte('reconciliation_date', endDate),
  ]);

  if (accountsRes.error) throw accountsRes.error;
  if (transactionsRes.error) throw transactionsRes.error;
  if (reconciliationsRes.error) throw reconciliationsRes.error;

  const movements = new Map<string, number>();
  for (const row of transactionsRes.data ?? []) {
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
  for (const row of reconciliationsRes.data ?? []) {
    movements.set(
      row.savings_account_id,
      round2((movements.get(row.savings_account_id) ?? 0) + row.difference),
    );
  }

  return (accountsRes.data ?? [])
    .filter((account) => account.created_at.slice(0, 10) <= endDate)
    .map((account) => {
      const movementBalance = movements.get(account.id) ?? 0;
      return {
        ...account,
        movementBalance,
        balance: round2(account.opening_balance + movementBalance),
      };
    });
}

export async function getAccountReconciliations(
  startDate: string,
  endDate: string,
): Promise<AccountReconciliationWithAccount[]> {
  const { data, error } = await supabase
    .from('account_reconciliations')
    .select('*, savings_account:savings_accounts(id, name, color)')
    .gte('reconciliation_date', startDate)
    .lte('reconciliation_date', endDate)
    .order('reconciliation_date', { ascending: false })
    .order('created_at', { ascending: false })
    .returns<AccountReconciliationWithAccount[]>();
  if (error) throw error;
  return data ?? [];
}

export async function createAccountReconciliation(
  userId: string,
  input: AccountReconciliationInput,
): Promise<AccountReconciliation> {
  const { data, error } = await supabase
    .from('account_reconciliations')
    .insert({
      user_id: userId,
      savings_account_id: input.savings_account_id,
      reconciliation_date: input.reconciliation_date,
      calculated_balance: round2(input.calculated_balance),
      actual_balance: round2(input.actual_balance),
      apply_adjustment: input.apply_adjustment,
      notes: input.notes ?? '',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAccountReconciliation(id: string): Promise<void> {
  const { error } = await supabase.from('account_reconciliations').delete().eq('id', id);
  if (error) throw error;
}

export async function getMonthClosure(month: MonthYear): Promise<MonthClosure | null> {
  const { data, error } = await supabase
    .from('month_closures')
    .select('*')
    .eq('year', month.year)
    .eq('month', month.month)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveMonthClosure(
  userId: string,
  month: MonthYear,
  snapshot: MonthClosureSnapshot,
  notes: string,
): Promise<MonthClosure> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('month_closures')
    .upsert(
      {
        user_id: userId,
        year: month.year,
        month: month.month,
        snapshot: snapshot as unknown as Json,
        notes,
        closed_at: now,
        updated_at: now,
      },
      { onConflict: 'user_id,year,month' },
    )
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
