import { Pencil, Trash2 } from 'lucide-react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { formatCurrency } from '@/utils/format';
import { formatDate } from '@/utils/date';
import { cn } from '@/lib/utils';
import type { TransactionWithCategory } from '@/types/models';

interface TransactionListProps {
  transactions: TransactionWithCategory[];
  onEdit?: (t: TransactionWithCategory) => void;
  onDelete?: (t: TransactionWithCategory) => void;
}

export function TransactionList({ transactions, onEdit, onDelete }: TransactionListProps) {
  return (
    <ul className="divide-y divide-border">
      {transactions.map((t) => {
        const isIncome = t.type === 'INCOME';
        return (
          <li key={t.id} className="flex items-center gap-3 py-3">
            <CategoryIcon
              icon={t.category?.icon ?? 'circle'}
              color={t.category?.color ?? '#94a3b8'}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">
                {t.category?.name ?? 'Sin categoría'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {t.description ? `${t.description} · ` : ''}
                {formatDate(t.transaction_date)}
              </p>
            </div>
            <span
              className={cn(
                'shrink-0 tabular-nums font-semibold',
                isIncome ? 'text-income' : 'text-expense',
              )}
            >
              {isIncome ? '+' : '−'} {formatCurrency(t.amount)}
            </span>
            {(onEdit || onDelete) && (
              <div className="flex shrink-0 items-center gap-1">
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(t)}
                    aria-label="Editar"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(t)}
                    aria-label="Eliminar"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-expense-soft hover:text-expense"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
