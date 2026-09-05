import { supabase } from '@/lib/supabase';
import { createTransaction } from '@/services/transactions.service';
import { round2 } from '@/utils/finance';
import type {
  ReceivablePerson,
  ReceivablePersonWithBalance,
  TransactionWithCategory,
} from '@/types/models';
import type {
  ReceivableCreateInput,
  ReceivableMovementInput,
  ReceivablePersonInput,
} from '@/lib/validations';

const MOVEMENT_SELECT =
  '*, category:categories(id, name, icon, color, type), savings_account:savings_accounts!transactions_savings_account_id_fkey(id, name, color), destination_savings_account:savings_accounts!transactions_destination_savings_account_id_fkey(id, name, color), receivable_person:receivable_people(id, name)';

export async function getReceivablePeople(): Promise<ReceivablePersonWithBalance[]> {
  const [peopleResult, movementsResult] = await Promise.all([
    supabase.from('receivable_people').select('*').order('created_at', { ascending: true }),
    supabase
      .from('transactions')
      .select('receivable_person_id, receivable_movement_kind, amount')
      .not('receivable_person_id', 'is', null)
      .not('receivable_movement_kind', 'is', null),
  ]);

  if (peopleResult.error) throw peopleResult.error;
  if (movementsResult.error) throw movementsResult.error;

  const totals = new Map<string, { lent: number; paid: number }>();
  for (const movement of movementsResult.data ?? []) {
    if (!movement.receivable_person_id) continue;
    const current = totals.get(movement.receivable_person_id) ?? { lent: 0, paid: 0 };
    if (movement.receivable_movement_kind === 'LEND') current.lent += movement.amount;
    if (movement.receivable_movement_kind === 'REPAYMENT') current.paid += movement.amount;
    totals.set(movement.receivable_person_id, current);
  }

  return (peopleResult.data ?? []).map((person) => {
    const total = totals.get(person.id) ?? { lent: 0, paid: 0 };
    const totalLent = round2(total.lent);
    const totalPaid = round2(total.paid);
    return { ...person, totalLent, totalPaid, balance: round2(totalLent - totalPaid) };
  });
}

export async function getReceivableMovements(personId: string): Promise<TransactionWithCategory[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select(MOVEMENT_SELECT)
    .eq('receivable_person_id', personId)
    .not('receivable_movement_kind', 'is', null)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .returns<TransactionWithCategory[]>();

  if (error) throw error;
  return data ?? [];
}

export async function createReceivablePerson(
  userId: string,
  input: ReceivableCreateInput,
): Promise<ReceivablePerson> {
  const { data: person, error } = await supabase
    .from('receivable_people')
    .insert({
      user_id: userId,
      name: input.name,
      relationship: input.relationship,
      phone: input.phone ?? '',
      notes: input.notes ?? '',
    })
    .select('*')
    .single();
  if (error) throw error;

  try {
    await registerReceivableLend(userId, person, {
      amount: input.initial_amount,
      account_id: input.account_id,
      movement_date: input.movement_date,
      description: input.description,
    });
  } catch (cause) {
    await supabase.from('receivable_people').delete().eq('id', person.id);
    throw cause;
  }
  return person;
}

export async function updateReceivablePerson(
  id: string,
  input: ReceivablePersonInput,
): Promise<ReceivablePerson> {
  const { data, error } = await supabase
    .from('receivable_people')
    .update({
      name: input.name,
      relationship: input.relationship,
      phone: input.phone ?? '',
      notes: input.notes ?? '',
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function registerReceivableLend(
  userId: string,
  person: Pick<ReceivablePerson, 'id' | 'name'>,
  input: ReceivableMovementInput,
): Promise<void> {
  await createTransaction(userId, {
    type: 'TRANSFER',
    amount: input.amount,
    category_id: null,
    savings_account_id: input.account_id,
    destination_savings_account_id: null,
    receivable_person_id: person.id,
    receivable_movement_kind: 'LEND',
    description: input.description || `Préstamo a ${person.name}`,
    transaction_date: input.movement_date,
  });
}

export async function registerReceivableRepayment(
  userId: string,
  person: Pick<ReceivablePersonWithBalance, 'id' | 'name' | 'balance'>,
  input: ReceivableMovementInput,
): Promise<void> {
  if (input.amount > person.balance) {
    throw new Error(`El pago no puede superar la deuda actual de ${person.name}.`);
  }
  await createTransaction(userId, {
    type: 'TRANSFER',
    amount: input.amount,
    category_id: null,
    savings_account_id: null,
    destination_savings_account_id: input.account_id,
    receivable_person_id: person.id,
    receivable_movement_kind: 'REPAYMENT',
    description: input.description || `Pago recibido de ${person.name}`,
    transaction_date: input.movement_date,
  });
}

export async function deleteReceivableMovement(id: string): Promise<void> {
  const { data: movement, error: findError } = await supabase
    .from('transactions')
    .select('receivable_person_id, receivable_movement_kind, amount')
    .eq('id', id)
    .single();
  if (findError) throw findError;

  if (movement.receivable_person_id && movement.receivable_movement_kind === 'LEND') {
    const people = await getReceivablePeople();
    const person = people.find((item) => item.id === movement.receivable_person_id);
    if (person && round2(person.balance - movement.amount) < 0) {
      throw new Error('No puedes eliminar este préstamo mientras existan pagos asociados.');
    }
  }

  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw error;
}
