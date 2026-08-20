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
 * Tarjetas con sus deudas calculadas (Lempiras y Dólares):
 * - Deuda L = apertura_L + compras con tarjeta en L (gastos) − pagos en L
 * - Deuda $ = apertura_$ + compras en $ (cargos) − pagos en $
 */
export async function getCreditCards(): Promise<CreditCardWithBalance[]> {
  const [cardsRes, purchasesRes, chargesRes, paymentsRes] = await Promise.all([
    supabase.from('credit_cards').select('*').order('created_at', { ascending: true }),
    supabase
      .from('transactions')
      .select('credit_card_id, amount')
      .eq('type', 'EXPENSE')
      .not('credit_card_id', 'is', null),
    supabase.from('card_charges').select('card_id, amount, currency'),
    supabase.from('card_payments').select('card_id, amount, currency'),
  ]);

  if (cardsRes.error) throw cardsRes.error;
  if (purchasesRes.error) throw purchasesRes.error;
  if (chargesRes.error) throw chargesRes.error;
  if (paymentsRes.error) throw paymentsRes.error;

  // Compras con tarjeta en L (son gastos → viven en transactions).
  const purchasesHnl = new Map<string, number>();
  for (const r of purchasesRes.data ?? []) accumulate(purchasesHnl, r.credit_card_id, r.amount);

  // Cargos (por moneda).
  const chargesHnl = new Map<string, number>();
  const chargesUsd = new Map<string, number>();
  for (const r of chargesRes.data ?? []) {
    accumulate(r.currency === 'USD' ? chargesUsd : chargesHnl, r.card_id, r.amount);
  }

  // Pagos (por moneda).
  const paymentsHnl = new Map<string, number>();
  const paymentsUsd = new Map<string, number>();
  for (const r of paymentsRes.data ?? []) {
    accumulate(r.currency === 'USD' ? paymentsUsd : paymentsHnl, r.card_id, r.amount);
  }

  return (cardsRes.data ?? []).map((card) => ({
    ...card,
    balanceHnl: round2(
      card.opening_balance +
        (purchasesHnl.get(card.id) ?? 0) +
        (chargesHnl.get(card.id) ?? 0) -
        (paymentsHnl.get(card.id) ?? 0),
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
  /** Moneda del pago (qué deuda reduce). */
  currency: Currency;
  /** Monto que reduce la deuda, en la moneda indicada. */
  amount: number;
  /** Monto pagado en lempiras (para pagos en dólares). Se registra como gasto. */
  amountHnl?: number | null;
  /** Categoría opcional para el gasto en lempiras. */
  categoryId?: string | null;
}

/**
 * Registra un pago a la tarjeta.
 * - Reduce la deuda por `amount` en la moneda indicada.
 * - Pago en dólares: si se indica `amountHnl`, se crea un gasto en lempiras por ese
 *   monto (afecta el disponible), pues es el dinero real que sale.
 * - Pago en lempiras: solo reduce la deuda (las compras en L ya fueron los gastos).
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

  if (currency === 'USD' && amountHnl && amountHnl > 0) {
    await createTransaction(userId, {
      type: 'EXPENSE',
      amount: amountHnl,
      category_id: categoryId,
      description: `Pago tarjeta ${cardName} ($${amount.toFixed(2)})`,
      transaction_date: dateISO,
    });
  }
}

/**
 * Registra una compra/cargo en dólares en la tarjeta (aumenta la deuda en $).
 * No genera gasto en lempiras (el gasto en L se reconoce al pagar).
 */
export async function registerCardCharge(
  userId: string,
  cardId: string,
  input: CardChargeInput,
): Promise<void> {
  const { error } = await supabase.from('card_charges').insert({
    user_id: userId,
    card_id: cardId,
    amount: input.amount,
    currency: 'USD',
    description: input.description ?? '',
    charge_date: input.charge_date,
  });
  if (error) throw error;
}
