import type { CreditCardWithBalance, LoanWithCategory, Transaction } from '@/types/models';
import { monthlySummary, round2 } from '@/utils/finance';

export interface FinancialHealth {
  income: number;
  expense: number;
  cashFlow: number;
  savingsRate: number | null;
  expenseRate: number | null;
  expenseChange: number | null;
  cashFlowChange: number;
  debtHnl: number;
  debtUsd: number;
  debtMonthsOfIncome: number | null;
}

function percentageChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return round2(((current - previous) / previous) * 100);
}

/** Indicadores HNL explicables; la deuda USD se conserva separada y nunca se convierte. */
export function calculateFinancialHealth(
  currentTransactions: readonly Transaction[],
  previousTransactions: readonly Transaction[],
  loans: readonly LoanWithCategory[],
  cards: readonly CreditCardWithBalance[],
): FinancialHealth {
  const current = monthlySummary(currentTransactions, 'HNL');
  const previous = monthlySummary(previousTransactions, 'HNL');
  const debtHnl = round2(
    loans.reduce((total, loan) => total + loan.current_balance, 0) +
      cards.reduce((total, card) => total + card.balanceHnl, 0),
  );
  const debtUsd = round2(cards.reduce((total, card) => total + card.balanceUsd, 0));

  return {
    income: current.income,
    expense: current.expense,
    cashFlow: current.balance,
    savingsRate:
      current.income > 0 ? round2((Math.max(0, current.balance) / current.income) * 100) : null,
    expenseRate: current.income > 0 ? round2((current.expense / current.income) * 100) : null,
    expenseChange: percentageChange(current.expense, previous.expense),
    cashFlowChange: round2(current.balance - previous.balance),
    debtHnl,
    debtUsd,
    debtMonthsOfIncome: current.income > 0 ? round2(debtHnl / current.income) : null,
  };
}

export function requiredMonthlyContribution(
  remainingAmount: number,
  targetDate: string | null,
  today: string,
): number | null {
  if (!targetDate || remainingAmount <= 0) return null;
  const [targetYear, targetMonth] = targetDate.split('-').map(Number);
  const [todayYear, todayMonth] = today.split('-').map(Number);
  const months = (targetYear - todayYear) * 12 + targetMonth - todayMonth;
  return months <= 0 ? round2(remainingAmount) : round2(remainingAmount / months);
}
