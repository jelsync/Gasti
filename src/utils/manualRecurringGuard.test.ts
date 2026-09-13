import { describe, expect, it } from 'vitest';
import type { TransactionSubmit } from '@/components/transactions/TransactionForm';
import type { RecurringTransactionWithRelations, Transaction } from '@/types/models';
import {
  findManualRecurringMatches,
  manualRecurringMovement,
  type RecurringOccurrenceWithTransaction,
} from '@/utils/manualRecurringGuard';

const rule = {
  id: 'rule',
  name: 'Spotify',
  type: 'EXPENSE',
  amount: 11.49,
  currency: 'USD',
  category_id: 'category',
  savings_account_id: null,
  credit_card_id: 'card',
  day_of_month: 19,
  start_date: '2026-09-01',
  end_date: null,
  is_active: true,
} as RecurringTransactionWithRelations;
const charge: TransactionSubmit = {
  kind: 'cardCharge',
  cardId: 'card',
  currency: 'USD',
  input: {
    amount: 11.49,
    category_id: 'category',
    charge_date: '2026-09-12',
    description: 'Otro nombre',
  },
};
const transaction = {
  ...rule,
  id: 'transaction',
  transaction_date: '2026-09-10',
} as unknown as Transaction;
const occurrence = {
  recurring_transaction_id: 'rule',
  due_date: '2026-09-19',
  status: 'COMPLETED',
  transaction,
} as RecurringOccurrenceWithTransaction;

describe('protección al crear movimientos manuales', () => {
  it('ofrece la ocurrencia del siguiente mes cuando se paga anticipadamente', () => {
    const earlyCharge = { ...charge, input: { ...charge.input, charge_date: '2026-09-30' } };
    const octoberRule = { ...rule, start_date: '2026-10-01', day_of_month: 5 };
    expect(findManualRecurringMatches(earlyCharge, [octoberRule], [])).toEqual([
      { rule: octoberRule, dueDate: '2026-10-05', transaction: null },
    ]);
  });
  it('ofrece atender una recurrencia pendiente anticipadamente sin depender del nombre', () => {
    expect(findManualRecurringMatches(charge, [rule], [])).toEqual([
      { rule, dueDate: '2026-09-19', transaction: null },
    ]);
  });
  it('identifica COMPLETED por la compra real aunque la regla se modifique y desactive', () => {
    const changedRule = { ...rule, amount: 15, is_active: false, credit_card_id: 'otra' };
    expect(findManualRecurringMatches(charge, [changedRule], [occurrence])).toEqual([
      { rule: changedRule, dueDate: '2026-09-19', transaction },
    ]);
  });
  it.each([
    { currency: 'HNL' },
    { category_id: 'otra' },
    { credit_card_id: 'otra' },
    { amount: 12 },
    { type: 'INCOME' },
    { savings_account_id: 'cuenta' },
  ])('no mezcla tipos, importes, monedas, categorías ni medios: %o', (change) => {
    expect(
      findManualRecurringMatches(
        charge,
        [{ ...rule, ...change } as RecurringTransactionWithRelations],
        [],
      ),
    ).toEqual([]);
  });
  it('excluye pagos a tarjeta y transferencias aunque coincidan importes', () => {
    expect(
      manualRecurringMovement({
        kind: 'cardPayment',
        cardId: 'card',
        cardName: 'BAC',
        args: { amount: 11.49, amountHnl: 310.43, currency: 'USD', accountId: 'account' },
      }),
    ).toBeNull();
    expect(
      manualRecurringMovement({
        kind: 'transaction',
        input: {
          type: 'TRANSFER',
          amount: 11.49,
          currency: 'HNL',
          category_id: null,
          transaction_date: '2026-09-12',
          savings_account_id: 'account',
          destination_savings_account_id: 'other',
        },
      }),
    ).toBeNull();
  });
  it('respeta omisiones y el inicio de vigencia', () => {
    expect(
      findManualRecurringMatches(
        charge,
        [rule],
        [{ ...occurrence, status: 'SKIPPED', transaction: null }],
      ),
    ).toEqual([]);
    expect(findManualRecurringMatches(charge, [{ ...rule, start_date: '2026-10-01' }], [])).toEqual(
      [],
    );
  });
  it('detecta confirmaciones anticipadas del siguiente mes realizadas este mes', () => {
    expect(
      findManualRecurringMatches(charge, [rule], [{ ...occurrence, due_date: '2026-10-19' }])[0]
        .transaction,
    ).toBe(transaction);
  });
  it('no confunde una confirmación del mes anterior con este mes', () => {
    const oldOccurrence = {
      ...occurrence,
      due_date: '2026-08-19',
      transaction: { ...transaction, transaction_date: '2026-08-19' },
    };
    expect(findManualRecurringMatches(charge, [rule], [oldOccurrence])).toEqual([
      { rule, dueDate: '2026-09-19', transaction: null },
    ]);
  });
});
