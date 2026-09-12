import { describe, expect, it } from 'vitest';
import { calculateFinancialHealth, requiredMonthlyContribution } from '@/utils/financialHealth';
import type { CreditCardWithBalance, LoanWithCategory, Transaction } from '@/types/models';

function transaction(type: Transaction['type'], amount: number): Transaction {
  return { type, amount, currency: 'HNL' } as Transaction;
}

describe('calculateFinancialHealth', () => {
  it('explica ahorro, gasto, comparación y deuda sin mezclar USD', () => {
    const result = calculateFinancialHealth(
      [transaction('INCOME', 10000), transaction('EXPENSE', 6000)],
      [transaction('INCOME', 9000), transaction('EXPENSE', 5000)],
      [{ current_balance: 20000 } as LoanWithCategory],
      [{ balanceHnl: 5000, balanceUsd: 100 } as CreditCardWithBalance],
    );

    expect(result.savingsRate).toBe(40);
    expect(result.expenseRate).toBe(60);
    expect(result.expenseChange).toBe(20);
    expect(result.cashFlowChange).toBe(0);
    expect(result.debtHnl).toBe(25000);
    expect(result.debtUsd).toBe(100);
    expect(result.debtMonthsOfIncome).toBe(2.5);
  });
});

describe('requiredMonthlyContribution', () => {
  it('reparte el faltante entre los meses disponibles', () => {
    expect(requiredMonthlyContribution(12000, '2027-09-01', '2026-09-12')).toBe(1000);
  });

  it('pide el faltante completo cuando la fecha ya venció', () => {
    expect(requiredMonthlyContribution(3000, '2026-08-01', '2026-09-12')).toBe(3000);
  });
});
