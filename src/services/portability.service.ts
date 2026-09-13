import { supabase } from '@/lib/supabase';
import { bankImportSchema } from '@/lib/validations';
import type { BankImportRow, UserBackup } from '@/types/models';
import type { Json } from '@/types/database.types';

export async function getUserBackup(): Promise<UserBackup> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sesión no válida');
  const { data, error } = await supabase.rpc('export_user_backup');
  if (error) throw error;
  const backup = data as unknown as UserBackup;
  if (
    !backup ||
    backup.format !== 'gasti-backup' ||
    backup.version !== 1 ||
    backup.user_id !== auth.user.id ||
    !backup.tables
  )
    throw new Error('No se pudo validar el respaldo del usuario.');
  return backup;
}

export async function importBankTransactions(accountId: string, rows: BankImportRow[]) {
  const input = bankImportSchema.parse({
    account_id: accountId,
    rows: rows
      .filter((row) => row.selected)
      .map((row) => ({
        id: row.id,
        type: row.type,
        amount: row.amount,
        transaction_date: row.transaction_date,
        description: row.description,
        category_id: row.category_id,
        allow_duplicate: row.duplicate,
      })),
  });
  const { data, error } = await supabase.rpc('import_bank_transactions', {
    p_account_id: input.account_id,
    p_rows: input.rows as unknown as Json,
  });
  if (error) throw error;
  return data as { inserted: number; skipped: number };
}
