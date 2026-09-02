import { supabase } from '@/lib/supabase';
import { createTransaction } from '@/services/transactions.service';
import { round2 } from '@/utils/finance';
import { todayISO } from '@/utils/date';
import type { CreditCard, CreditCardWithBalance, Currency } from '@/types/models';
import type { CardChargeInput, CreditCardInput } from '@/lib/validations';

function accumulate(map: Map<string, number>, key: string | null, amount: number) {
  if (!key) return;
  map.set(key, round2((map.get(key) ?? 0) + amount));
}

/**
 * Tarjetas con sus deudas (Lempiras y Dólares):
 *   Deuda = apertura + compras (card_charges) − pagos (card_payments), por moneda.
 * Las compras suben la deuda; el gasto (en L) se reconoce al pagar.
 */
export async function getCreditCards(): Promise<CreditCardWithBalance[]> {
  const [cardsRes, chargesRes, paymentsRes] = await Promise.all([
    supabase.from('credit_cards').select('*').order('created_at', { ascending: true }),
    supabase.from('card_charges').select('card_id, amount, currency'),
    supabase.from('card_payments').select('card_id, amount, currency'),
  ]);

  if (cardsRes.error) throw cardsRes.error;
  if (chargesRes.error) throw chargesRes.error;
  if (paymentsRes.error) throw paymentsRes.error;

  const chargesHnl = new Map<string, number>();
  const chargesUsd = new Map<string, number>();
  for (const r of chargesRes.data ?? []) {
    accumulate(r.currency === 'USD' ? chargesUsd : chargesHnl, r.card_id, r.amount);
  }
  const paymentsHnl = new Map<string, number>();
  const paymentsUsd = new Map<string, number>();
  for (const r of paymentsRes.data ?? []) {
    accumulate(r.currency === 'USD' ? paymentsUsd : paymentsHnl, r.card_id, r.amount);
  }

  return (cardsRes.data ?? []).map((card) => ({
    ...card,
    balanceHnl: round2(
      card.opening_balance + (chargesHnl.get(card.id) ?? 0) - (paymentsHnl.get(card.id) ?? 0),
    ),
    balanceUsd: round2(
      card.opening_balance_usd + (chargesUsd.get(card.id) ?? 0) - (paymentsUsd.get(card.id) ?? 0),
    ),
  }));
}

export async function createCreditCard(
  userId: string,
  input: CreditCardInput,
): Promise<CreditCard> {
  const { data, error } = await supabase
    .from('credit_cards')
    .insert({
      user_id: userId,
      name: input.name,
      bank: input.bank ?? '',
      opening_balance: input.opening_balance,
      opening_balance_usd: input.opening_balance_usd,
      credit_limit: input.credit_limit ?? null,
      credit_limit_usd: input.credit_limit_usd ?? null,
      color: input.color,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateCreditCard(id: string, input: CreditCardInput): Promise<CreditCard> {
  const { data, error } = await supabase
    .from('credit_cards')
    .update({
      name: input.name,
      bank: input.bank ?? '',
      opening_balance: input.opening_balance,
      opening_balance_usd: input.opening_balance_usd,
      credit_limit: input.credit_limit ?? null,
      credit_limit_usd: input.credit_limit_usd ?? null,
      color: input.color,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCreditCard(id: string): Promise<void> {
  const { error } = await supabase.from('credit_cards').delete().eq('id', id);
  if (error) throw error;
}

export interface CardPaymentArgs {
  currency: Currency;
  /** Monto que reduce la deuda, en la moneda indicada. */
  amount: number;
  /** Monto pagado en lempiras (para pagos en dólares). */
  amountHnl?: number | null;
  categoryId?: string | null;
}

/**
 * Registra un pago a la tarjeta.
 * - Reduce la deuda por `amount` en la moneda indicada.
 * - Crea un gasto en lempiras (afecta el disponible): en pagos en L es `amount`;
 *   en pagos en $ es `amountHnl` (lo que pagaste realmente en lempiras).
 */
export async function registerCardPayment(
  userId: string,
  cardId: string,
  cardName: string,
  { currency, amount, amountHnl = null, categoryId = null }: CardPaymentArgs,
  dateISO: string = todayISO(),
): Promise<void> {
  const { error } = await supabase.from('card_payments').insert({
    user_id: userId,
    card_id: cardId,
    amount,
    currency,
    amount_hnl: currency === 'USD' ? amountHnl : null,
    payment_date: dateISO,
  });
  if (error) throw error;

  const gastoHnl = currency === 'USD' ? (amountHnl ?? 0) : amount;
  if (gastoHnl > 0) {
    const label = currency === 'USD' ? `$${amount.toFixed(2)}` : `L ${amount.toFixed(2)}`;
    await createTransaction(userId, {
      type: 'EXPENSE',
      amount: gastoHnl,
      category_id: categoryId,
      description: `Pago tarjeta ${cardName} (${label})`,
      transaction_date: dateISO,
    });
  }
}

/**
 * Registra una compra/cargo en la tarjeta (aumenta la deuda en la moneda dada).
 * No genera gasto en lempiras (el gasto se reconoce al pagar).
 */
export async function registerCardCharge(
  userId: string,
  cardId: string,
  currency: Currency,
  input: CardChargeInput,
): Promise<void> {
  const { error } = await supabase.from('card_charges').insert({
    user_id: userId,
    card_id: cardId,
    amount: input.amount,
    currency,
    description: input.description ?? '',
    charge_date: input.charge_date,
  });
  if (error) throw error;
}

export interface CardChargeWithCard {
  id: string;
  card_id: string;
  amount: number;
  currency: Currency;
  description: string;
  charge_date: string;
  card: Pick<CreditCard, 'id' | 'name' | 'color'> | null;
}

export type CardMovement =
  | {
      kind: 'CHARGE';
      id: string;
      amount: number;
      currency: Currency;
      description: string;
      date: string;
      createdAt: string;
    }
  | {
      kind: 'PAYMENT';
      id: string;
      amount: number;
      amountHnl: number | null;
      currency: Currency;
      date: string;
      createdAt: string;
    };

/** Compras y pagos de una tarjeta, del más reciente al más antiguo. */
export async function getCreditCardMovements(cardId: string): Promise<CardMovement[]> {
  const [chargesRes, paymentsRes] = await Promise.all([
    supabase
      .from('card_charges')
      .select('id, amount, currency, description, charge_date, created_at')
      .eq('card_id', cardId),
    supabase
      .from('card_payments')
      .select('id, amount, amount_hnl, currency, payment_date, created_at')
      .eq('card_id', cardId),
  ]);

  if (chargesRes.error) throw chargesRes.error;
  if (paymentsRes.error) throw paymentsRes.error;

  const movements: CardMovement[] = [
    ...(chargesRes.data ?? []).map((charge) => ({
      kind: 'CHARGE' as const,
      id: charge.id,
      amount: charge.amount,
      currency: charge.currency,
      description: charge.description,
      date: charge.charge_date,
      createdAt: charge.created_at,
    })),
    ...(paymentsRes.data ?? []).map((payment) => ({
      kind: 'PAYMENT' as const,
      id: payment.id,
      amount: payment.amount,
      amountHnl: payment.amount_hnl,
      currency: payment.currency,
      date: payment.payment_date,
      createdAt: payment.created_at,
    })),
  ];

  return movements.sort(
    (left, right) =>
      right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt),
  );
}

/** Compras/cargos de tarjeta en un rango de fechas (para mostrarlos en la lista). */
export async function getCardCharges(
  dateStart: string,
  dateEnd: string,
): Promise<CardChargeWithCard[]> {
  const { data, error } = await supabase
    .from('card_charges')
    .select(
      'id, card_id, amount, currency, description, charge_date, card:credit_cards(id, name, color)',
    )
    .gte('charge_date', dateStart)
    .lte('charge_date', dateEnd)
    .order('charge_date', { ascending: false })
    .returns<CardChargeWithCard[]>();

  if (error) throw error;
  return data ?? [];
}

export async function deleteCardCharge(id: string): Promise<void> {
  const { error } = await supabase.from('card_charges').delete().eq('id', id);
  if (error) throw error;
}
