import type { TransactionSubmit } from '@/components/transactions/TransactionForm';
import type {
  RecurringOccurrence,
  RecurringTransactionWithRelations,
  Transaction,
} from '@/types/models';
import { ruleDueDateForMonth } from '@/utils/recurring';
import { nextMonth, previousMonth } from '@/utils/date';

export type RecurringOccurrenceWithTransaction = RecurringOccurrence & {
  transaction: Transaction | null;
};
export interface ManualRecurringMatch {
  rule: RecurringTransactionWithRelations;
  dueDate: string;
  transaction: Transaction | null;
}

export function manualRecurringMovement(payload: TransactionSubmit) {
  if (payload.kind === 'cardPayment') return null;
  if (payload.kind === 'cardCharge') {
    return {
      type: 'EXPENSE' as const,
      amount: payload.input.amount,
      currency: payload.currency,
      category_id: payload.input.category_id,
      savings_account_id: null,
      credit_card_id: payload.cardId,
      transaction_date: payload.input.charge_date,
      description: payload.input.description,
    };
  }
  if (payload.input.type !== 'INCOME' && payload.input.type !== 'EXPENSE') return null;
  return {
    ...payload.input,
    currency: payload.input.currency ?? 'HNL',
    savings_account_id: payload.input.savings_account_id ?? null,
    credit_card_id: payload.input.credit_card_id ?? null,
  };
}

/** Coincidencias por datos contables; el nombre nunca decide si es el mismo movimiento. */
export function findManualRecurringMatches(
  payload: TransactionSubmit,
  rules: RecurringTransactionWithRelations[],
  occurrences: RecurringOccurrenceWithTransaction[],
): ManualRecurringMatch[] {
  const movement = manualRecurringMovement(payload);
  if (!movement) return [];
  const period = movement.transaction_date.slice(0, 7);
  const [year, month] = period.split('-').map(Number);
  const periods = [previousMonth({ year, month }), { year, month }, nextMonth({ year, month })];
  const transactionTime = Date.parse(`${movement.transaction_date}T00:00:00Z`);
  const matches = (
    other: Pick<
      Transaction,
      'type' | 'amount' | 'currency' | 'category_id' | 'savings_account_id' | 'credit_card_id'
    >,
  ) =>
    movement.type === other.type &&
    Math.round(movement.amount * 100) === Math.round(other.amount * 100) &&
    movement.currency === other.currency &&
    movement.category_id === other.category_id &&
    movement.savings_account_id === other.savings_account_id &&
    movement.credit_card_id === other.credit_card_id;

  const result: ManualRecurringMatch[] = [];
  for (const rule of rules) {
    // La transacción real sigue siendo válida aunque después cambie o se pause la regla.
    for (const occurrence of occurrences) {
      if (occurrence.recurring_transaction_id !== rule.id || !occurrence.transaction) continue;
      if (
        occurrence.status === 'COMPLETED' &&
        (occurrence.due_date.startsWith(period) ||
          occurrence.transaction.transaction_date.startsWith(period)) &&
        matches(occurrence.transaction)
      ) {
        result.push({ rule, dueDate: occurrence.due_date, transaction: occurrence.transaction });
      }
    }
    if (!rule.is_active || !matches(rule)) continue;
    for (const candidatePeriod of periods) {
      const dueDate = ruleDueDateForMonth(rule, candidatePeriod);
      if (
        !dueDate ||
        Math.abs(Date.parse(`${dueDate}T00:00:00Z`) - transactionTime) > 31 * 86400000
      )
        continue;
      if (
        occurrences.some(
          (item) => item.recurring_transaction_id === rule.id && item.due_date === dueDate,
        )
      )
        continue;
      result.push({ rule, dueDate, transaction: null });
    }
  }
  return result.sort((a, b) => Number(!!b.transaction) - Number(!!a.transaction));
}
