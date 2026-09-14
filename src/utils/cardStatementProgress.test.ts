import { describe, expect, it } from 'vitest';
import { cardStatementProgress } from '@/utils/cardStatementProgress';
import type { CardMovement } from '@/services/cards.service';
import type { CardStatement, CreditCardWithBalance } from '@/types/models';

const card: CreditCardWithBalance = {
  id: 'card',
  user_id: 'user',
  name: 'BAC',
  bank: 'BAC',
  currency: 'HNL',
  opening_balance: 0,
  opening_balance_usd: 0,
  credit_limit: null,
  credit_limit_usd: null,
  payment_due_day: 20,
  statement_day: 9,
  color: '#000',
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  balanceHnl: 600,
  balanceUsd: 9,
};
const statement: CardStatement = {
  id: 'statement',
  user_id: 'user',
  card_id: card.id,
  statement_date: '2026-09-09',
  period_start: '2026-08-10',
  statement_day: 9,
  opening_hnl: 0,
  opening_usd: 0,
  charges_hnl: 1_000,
  charges_usd: 20,
  payments_hnl: 0,
  payments_usd: 0,
  balance_hnl: 1_000,
  balance_usd: 20,
  confirmed_at: '2026-09-09T12:00:00Z',
};
const movements: CardMovement[] = [
  {
    kind: 'PAYMENT',
    id: 'pay-hnl',
    amount: 700,
    amountHnl: null,
    currency: 'HNL',
    date: '2026-09-12',
    createdAt: '',
  },
  {
    kind: 'CHARGE',
    id: 'charge-hnl',
    amount: 300,
    currency: 'HNL',
    description: '',
    date: '2026-09-13',
    createdAt: '',
  },
  {
    kind: 'PAYMENT',
    id: 'pay-usd',
    amount: 25,
    amountHnl: 650,
    currency: 'USD',
    date: '2026-09-12',
    createdAt: '',
  },
  {
    kind: 'CHARGE',
    id: 'charge-usd',
    amount: 14,
    currency: 'USD',
    description: '',
    date: '2026-09-13',
    createdAt: '',
  },
];

describe('avance del último corte de tarjeta', () => {
  it('asigna los pagos primero al corte y separa el nuevo ciclo por moneda', () => {
    const progress = cardStatementProgress(statement, card, movements);

    expect(progress.HNL).toEqual({
      cutoffBalance: 1_000,
      paidTowardCutoff: 700,
      cutoffRemaining: 300,
      newCycleCharges: 300,
      paymentsTowardNewCycle: 0,
      newCycleBalance: 300,
    });
    expect(progress.USD).toEqual({
      cutoffBalance: 20,
      paidTowardCutoff: 20,
      cutoffRemaining: 0,
      newCycleCharges: 14,
      paymentsTowardNewCycle: 5,
      newCycleBalance: 9,
    });
  });
});
