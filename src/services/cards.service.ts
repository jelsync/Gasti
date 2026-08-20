import { supabase } from '@/lib/supabase';
import { createTransaction } from '@/services/transactions.service';
import { round2 } from '@/utils/finance';
import { todayISO } from '@/utils/date';
import type { CreditCard, CreditCardWithBalance } from '@/types/models';
import type { CardChargeInput, CreditCardInput } from '@/lib/validations';

function sumByKey<T extends { amount: number }>(rows: T[], key: keyof T): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const k = row[key] as unknown as string | null;
    if (!k) continue;
    map.set(k, round2((map.get(k) ?? 0) + row.amount));
  }
  return map;
}

/**
 * Tarjetas con su deuda calculada: apertura + compras (gastos con tarjeta) − pagos.
 */
export async function getCreditCards(): Promise<CreditCardWithBalance[]> {
  const [cardsRes, purchasesRes, chargesRes, paymentsRes] = await Promise.all([
    supabase.from('credit_cards').select('*').order('created_at', { ascending: true }),
    supabase
      .from('transactions')
      .select('credit_card_id, amount')
      .eq('type', 'EXPENSE')
      .not('credit_card_id', 'is', null),
    supabase.from('card_charges').select('card_id, amount'),
    supabase.from('card_payments').select('card_id, amount'),
  ]);

  if (cardsRes.error) throw cardsRes.error;
  if (purchasesRes.error) throw purchasesRes.error;
  if (chargesRes.error) throw chargesRes.error;
  if (paymentsRes.error) throw paymentsRes.error;

  const purchases = sumByKey(purchasesRes.data ?? [], 'credit_card_id');
  const charges = sumByKey(chargesRes.data ?? [], 'card_id');
  const payments = sumByKey(paymentsRes.data ?? [], 'card_id');

  return (cardsRes.data ?? []).map((card) => ({
    ...card,
    balance: round2(
      card.opening_balance +
        (purchases.get(card.id) ?? 0) +
        (charges.get(card.id) ?? 0) -
        (payments.get(card.id) ?? 0),
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
      currency: input.currency,
      opening_balance: input.opening_balance,
      credit_limit: input.credit_limit ?? null,
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
      currency: input.currency,
      opening_balance: input.opening_balance,
      credit_limit: input.credit_limit ?? null,
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

interface PaymentArgs {
  /** Monto que reduce la deuda, en la moneda de la tarjeta. */
  amount: number;
  /** Monto pagado en lempiras (solo tarjetas USD). Se registra como gasto. */
  amountHnl?: number | null;
  /** Categoría opcional para el gasto en lempiras. */
  categoryId?: string | null;
}

/**
 * Registra un pago a la tarjeta.
 * - Reduce la deuda por `amount` (moneda de la tarjeta).
 * - Para tarjetas en dólares: si se indica `amountHnl`, se crea un gasto en
 *   lempiras por ese monto (afecta el disponible), pues es dinero real que sale.
 * - Para tarjetas en lempiras: solo reduce la deuda (las compras ya son los gastos).
 */
export async function registerCardPayment(
  userId: string,
  card: CreditCard,
  { amount, amountHnl = null, categoryId = null }: PaymentArgs,
  dateISO: string = todayISO(),
): Promise<void> {
  const { error } = await supabase.from('card_payments').insert({
    user_id: userId,
    card_id: card.id,
    amount,
    amount_hnl: card.currency === 'USD' ? amountHnl : null,
    payment_date: dateISO,
  });
  if (error) throw error;

  // Tarjeta en dólares: el pago en lempiras es el gasto real (débito a ingresos).
  if (card.currency === 'USD' && amountHnl && amountHnl > 0) {
    await createTransaction(userId, {
      type: 'EXPENSE',
      amount: amountHnl,
      category_id: categoryId,
      description: `Pago tarjeta ${card.name} ($${amount.toFixed(2)})`,
      transaction_date: dateISO,
    });
  }
}

/**
 * Registra una compra/cargo en la tarjeta (aumenta la deuda en su moneda).
 * No genera gasto en lempiras (en tarjetas USD el gasto se reconoce al pagar).
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
    description: input.description ?? '',
    charge_date: input.charge_date,
  });
  if (error) throw error;
}
