import { supabase } from '@/lib/supabase';
import { createTransaction } from '@/services/transactions.service';
import { nextPaymentBreakdown } from '@/utils/loan';
import { todayISO } from '@/utils/date';
import type { Loan, LoanWithCategory } from '@/types/models';
import type { LoanInput } from '@/lib/validations';

const SELECT_WITH_CATEGORY = '*, category:categories(id, name, icon, color)';

function normalize(input: LoanInput) {
  return {
    name: input.name,
    loan_number: input.loan_number ?? '',
    original_amount: input.original_amount,
    interest_rate: input.interest_rate,
    term_months: input.term_months,
    installment: input.installment,
    current_balance: input.current_balance,
    start_date: input.start_date,
    end_date: input.end_date ? input.end_date : null,
    category_id: input.category_id,
  };
}

export async function getLoans(): Promise<LoanWithCategory[]> {
  const { data, error } = await supabase
    .from('loans')
    .select(SELECT_WITH_CATEGORY)
    .order('created_at', { ascending: true })
    .returns<LoanWithCategory[]>();

  if (error) throw error;
  return data ?? [];
}

export async function createLoan(userId: string, input: LoanInput): Promise<Loan> {
  const { data, error } = await supabase
    .from('loans')
    .insert({ user_id: userId, ...normalize(input) })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateLoan(id: string, input: LoanInput): Promise<Loan> {
  const { data, error } = await supabase
    .from('loans')
    .update(normalize(input))
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteLoan(id: string): Promise<void> {
  const { error } = await supabase.from('loans').delete().eq('id', id);
  if (error) throw error;
}

export interface PaymentResult {
  interest: number;
  principal: number;
  newBalance: number;
}

/**
 * Registra el pago de una cuota:
 * 1) crea una transacción de gasto (cuota completa) en la categoría del préstamo,
 * 2) reduce el saldo del préstamo por la parte de capital (amortización real).
 */
export async function registerPayment(
  userId: string,
  loan: Loan,
  dateISO: string = todayISO(),
): Promise<PaymentResult> {
  const { interest, principal, newBalance } = nextPaymentBreakdown(
    loan.current_balance,
    loan.interest_rate,
    loan.installment,
  );

  await createTransaction(userId, {
    type: 'EXPENSE',
    amount: loan.installment,
    category_id: loan.category_id,
    description: `Pago préstamo: ${loan.name}`,
    transaction_date: dateISO,
  });

  const { error } = await supabase
    .from('loans')
    .update({ current_balance: newBalance })
    .eq('id', loan.id);

  if (error) throw error;

  return { interest, principal, newBalance };
}
