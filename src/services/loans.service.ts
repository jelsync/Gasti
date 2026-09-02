import { supabase } from '@/lib/supabase';
import { createTransaction } from '@/services/transactions.service';
import { applyExtraPrincipal, nextPaymentBreakdown } from '@/utils/loan';
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
    extra_payment: input.extra_payment ?? null,
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

export interface LoanMovement {
  id: string;
  amount: number;
  kind: 'INSTALLMENT' | 'EXTRA';
  principal: number;
  interest: number;
  balanceAfter: number;
  description: string;
  date: string;
}

/** Cuotas y abonos vinculados a un préstamo, del más reciente al más antiguo. */
export async function getLoanMovements(loanId: string): Promise<LoanMovement[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select(
      'id, amount, loan_payment_kind, loan_principal_amount, loan_interest_amount, loan_balance_after, description, transaction_date, created_at',
    )
    .eq('loan_id', loanId)
    .not('loan_payment_kind', 'is', null)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((movement) => ({
    id: movement.id,
    amount: movement.amount,
    kind: movement.loan_payment_kind as 'INSTALLMENT' | 'EXTRA',
    principal: movement.loan_principal_amount ?? 0,
    interest: movement.loan_interest_amount ?? 0,
    balanceAfter: movement.loan_balance_after ?? 0,
    description: movement.description,
    date: movement.transaction_date,
  }));
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
    loan_id: loan.id,
    loan_payment_kind: 'INSTALLMENT',
    loan_principal_amount: principal,
    loan_interest_amount: interest,
    loan_balance_after: newBalance,
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

export interface ExtraPaymentResult {
  amount: number;
  newBalance: number;
}

/**
 * Registra un abono a capital (pago extra / "cuota bomba"):
 * 1) crea una transacción de gasto por el monto,
 * 2) reduce el saldo del préstamo por el monto completo (100% a capital).
 */
export async function registerExtraPrincipal(
  userId: string,
  loan: Loan,
  amount: number,
  dateISO: string = todayISO(),
): Promise<ExtraPaymentResult> {
  const newBalance = applyExtraPrincipal(loan.current_balance, amount);

  await createTransaction(userId, {
    type: 'EXPENSE',
    amount,
    category_id: loan.category_id,
    loan_id: loan.id,
    loan_payment_kind: 'EXTRA',
    loan_principal_amount: amount,
    loan_interest_amount: 0,
    loan_balance_after: newBalance,
    description: `Abono a capital: ${loan.name}`,
    transaction_date: dateISO,
  });

  const { error } = await supabase
    .from('loans')
    .update({ current_balance: newBalance })
    .eq('id', loan.id);

  if (error) throw error;

  return { amount, newBalance };
}
