import { supabase } from '@/lib/supabase';
import { round2 } from '@/utils/finance';
import type {
  FinancialGoal,
  FinancialGoalMovement,
  FinancialGoalWithProgress,
  SavingsAccount,
} from '@/types/models';
import type { FinancialGoalInput, FinancialGoalMovementInput } from '@/lib/validations';

type FinancialGoalWithAccount = FinancialGoal & {
  savings_account: Pick<SavingsAccount, 'id' | 'name' | 'color'> | null;
};

export async function getFinancialGoals(): Promise<FinancialGoalWithProgress[]> {
  const [goalsRes, movementsRes] = await Promise.all([
    supabase
      .from('financial_goals')
      .select('*, savings_account:savings_accounts(id, name, color)')
      .order('created_at', { ascending: true })
      .returns<FinancialGoalWithAccount[]>(),
    supabase.from('financial_goal_movements').select('goal_id, movement_kind, amount'),
  ]);
  if (goalsRes.error) throw goalsRes.error;
  if (movementsRes.error) throw movementsRes.error;

  const movementTotals = new Map<string, number>();
  for (const movement of movementsRes.data ?? []) {
    const signed = movement.movement_kind === 'CONTRIBUTION' ? movement.amount : -movement.amount;
    movementTotals.set(movement.goal_id, (movementTotals.get(movement.goal_id) ?? 0) + signed);
  }

  return (goalsRes.data ?? []).map((goal) => {
    const savedAmount = round2(goal.starting_amount + (movementTotals.get(goal.id) ?? 0));
    return {
      ...goal,
      saved_amount: savedAmount,
      remaining_amount: round2(Math.max(0, goal.target_amount - savedAmount)),
      percentage: round2(goal.target_amount > 0 ? (savedAmount / goal.target_amount) * 100 : 0),
    };
  });
}

export async function getFinancialGoalMovements(goalId: string): Promise<FinancialGoalMovement[]> {
  const { data, error } = await supabase
    .from('financial_goal_movements')
    .select('*')
    .eq('goal_id', goalId)
    .order('movement_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

function normalizeGoalInput(userId: string, input: FinancialGoalInput) {
  return {
    user_id: userId,
    name: input.name,
    goal_type: input.goal_type,
    target_amount: input.target_amount,
    starting_amount: input.starting_amount,
    target_date: input.target_date || null,
    savings_account_id: input.savings_account_id,
    color: input.color,
    status: input.starting_amount >= input.target_amount ? ('COMPLETED' as const) : input.status,
    notes: input.notes ?? '',
  };
}

export async function createFinancialGoal(
  userId: string,
  input: FinancialGoalInput,
): Promise<FinancialGoal> {
  const { data, error } = await supabase
    .from('financial_goals')
    .insert(normalizeGoalInput(userId, input))
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateFinancialGoal(
  id: string,
  userId: string,
  input: FinancialGoalInput,
): Promise<FinancialGoal> {
  const normalized = normalizeGoalInput(userId, input);
  const { user_id: _userId, ...changes } = normalized;
  const { data, error } = await supabase
    .from('financial_goals')
    .update(changes)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFinancialGoal(id: string): Promise<void> {
  const { error } = await supabase.from('financial_goals').delete().eq('id', id);
  if (error) throw error;
}

export async function addFinancialGoalMovement(
  goalId: string,
  input: FinancialGoalMovementInput,
): Promise<void> {
  const { error } = await supabase.rpc('create_financial_goal_movement', {
    p_goal_id: goalId,
    p_movement_kind: input.movement_kind,
    p_amount: input.amount,
    p_movement_date: input.movement_date,
    p_notes: input.notes ?? '',
  });
  if (error) throw error;
}
