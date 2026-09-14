import { round2 } from '@/utils/finance';
import type { CardMovement } from '@/services/cards.service';
import type { CardStatement, CreditCardWithBalance, Currency } from '@/types/models';

export interface StatementCurrencyProgress {
  cutoffBalance: number;
  paidTowardCutoff: number;
  cutoffRemaining: number;
  newCycleCharges: number;
  paymentsTowardNewCycle: number;
  newCycleBalance: number;
}

export interface StatementProgress {
  statement: CardStatement;
  HNL: StatementCurrencyProgress;
  USD: StatementCurrencyProgress;
}

function statementBalance(statement: CardStatement, currency: Currency) {
  return currency === 'USD' ? statement.balance_usd : statement.balance_hnl;
}

function cardBalance(card: CreditCardWithBalance, currency: Currency) {
  return currency === 'USD' ? card.balanceUsd : card.balanceHnl;
}

function progressForCurrency(
  statement: CardStatement,
  card: CreditCardWithBalance,
  movements: CardMovement[],
  currency: Currency,
): StatementCurrencyProgress {
  const afterCutoff = movements.filter(
    (movement) => movement.currency === currency && movement.date > statement.statement_date,
  );
  const newCycleCharges = afterCutoff
    .filter((movement) => movement.kind === 'CHARGE')
    .reduce((sum, movement) => sum + movement.amount, 0);
  const paymentsAfterCutoff = afterCutoff
    .filter((movement) => movement.kind === 'PAYMENT')
    .reduce((sum, movement) => sum + movement.amount, 0);
  const cutoffBalance = Math.max(0, statementBalance(statement, currency));
  const paidTowardCutoff = Math.min(cutoffBalance, paymentsAfterCutoff);
  const cutoffRemaining = round2(cutoffBalance - paidTowardCutoff);

  return {
    cutoffBalance: round2(cutoffBalance),
    paidTowardCutoff: round2(paidTowardCutoff),
    cutoffRemaining,
    newCycleCharges: round2(newCycleCharges),
    paymentsTowardNewCycle: round2(Math.max(0, paymentsAfterCutoff - cutoffBalance)),
    newCycleBalance: round2(cardBalance(card, currency) - cutoffRemaining),
  };
}

/** Separa el último saldo cortado de las compras y pagos registrados después de ese corte. */
export function cardStatementProgress(
  statement: CardStatement,
  card: CreditCardWithBalance,
  movements: CardMovement[],
): StatementProgress {
  return {
    statement,
    HNL: progressForCurrency(statement, card, movements, 'HNL'),
    USD: progressForCurrency(statement, card, movements, 'USD'),
  };
}
