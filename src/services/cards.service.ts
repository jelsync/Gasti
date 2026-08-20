import { supabase } from '@/lib/supabase';
import { round2 } from '@/utils/finance';
import { todayISO } from '@/utils/date';
import type { CreditCard, CreditCardWithBalance } from '@/types/models';
import type { CreditCardInput } from '@/lib/validations';

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
  const [cardsRes, purchasesRes, paymentsRes] = await Promise.all([
    supabase.from('credit_cards').select('*').order('created_at', { ascending: true }),
    supabase
      .from('transactions')
      .select('credit_card_id, amount')
      .eq('type', 'EXPENSE')
      .not('credit_card_id', 'is', null),
    supabase.from('card_payments').select('card_id, amount'),
  ]);

  if (cardsRes.error) throw cardsRes.error;
  if (purchasesRes.error) throw purchasesRes.error;
  if (paymentsRes.error) throw paymentsRes.error;

  const purchases = sumByKey(purchasesRes.data ?? [], 'credit_card_id');
  const payments = sumByKey(paymentsRes.data ?? [], 'card_id');

  return (cardsRes.data ?? []).map((card) => ({
    ...card,
    balance: round2(
      card.opening_balance + (purchases.get(card.id) ?? 0) - (payments.get(card.id) ?? 0),
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

/** Registra un pago a la tarjeta (reduce la deuda; NO es un gasto). */
export async function registerCardPayment(
  userId: string,
  cardId: string,
  amount: number,
  dateISO: string = todayISO(),
): Promise<void> {
  const { error } = await supabase.from('card_payments').insert({
    user_id: userId,
    card_id: cardId,
    amount,
    payment_date: dateISO,
  });
  if (error) throw error;
}
