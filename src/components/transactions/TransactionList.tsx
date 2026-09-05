import { CreditCard as CardIcon, Pencil, Trash2 } from 'lucide-react';
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

function display(t: TransactionWithCategory) {
  if (t.type === 'TRANSFER') {
    return {
      name: t.credit_card ? `Pago de ${t.credit_card.name}` : 'Transferencia entre cuentas',
      icon: t.credit_card ? 'credit-card' : 'arrow-left-right',
      color: t.credit_card?.color ?? '#0ea5e9',
      sign: '→',
      amountClass: 'text-primary',
    };
  }
  if (t.type === 'SAVING') {
    return {
      name: t.savings_account?.name ?? 'Ahorro',
      icon: 'piggy-bank',
      color: t.savings_account?.color ?? '#0ea5e9',
      sign: '→',
      amountClass: 'text-primary',
    };
  }
  const isIncome = t.type === 'INCOME';
  return {
    name: t.category?.name ?? 'Sin categoría',
    icon: t.category?.icon ?? 'circle',
    color: t.category?.color ?? '#94a3b8',
    sign: isIncome ? '+' : '−',
    amountClass: isIncome ? 'text-income' : 'text-expense',
  };
}

export function TransactionList({ transactions, onEdit, onDelete }: TransactionListProps) {
  return (
    <ul className="divide-y divide-border">
      {transactions.map((t) => {
        const d = display(t);
        const canEdit = !t.credit_card_id && !t.loan_id;
        return (
          <li key={t.id} className="flex items-center gap-3 py-3">
            <CategoryIcon icon={d.icon} color={d.color} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{d.name}</p>
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                {t.credit_card && (
                  <span className="inline-flex items-center gap-0.5">
                    <CardIcon className="h-3 w-3" />
                    {t.credit_card.name} ·{' '}
                  </span>
                )}
                {t.description ? `${t.description} · ` : ''}
                {formatDate(t.transaction_date)}
                {t.savings_account && t.type === 'INCOME'
                  ? ` · Depositado en ${t.savings_account.name}`
                  : t.savings_account && t.type === 'EXPENSE'
                    ? ` · Debitado de ${t.savings_account.name}`
                    : t.type === 'TRANSFER'
                      ? t.credit_card
                        ? ` · Pagado desde ${t.savings_account?.name ?? 'cuenta'}`
                        : ` · ${t.savings_account?.name ?? 'Cuenta'} → ${t.destination_savings_account?.name ?? 'Cuenta'}`
                      : t.credit_card && t.type === 'EXPENSE'
                        ? ` · Compra con ${t.credit_card.name}`
                        : ''}
              </p>
            </div>
            <span className={cn('shrink-0 font-semibold tabular-nums', d.amountClass)}>
              {d.sign} {formatCurrency(t.amount)}
            </span>
            {(onEdit || onDelete) && (
              <div className="flex shrink-0 items-center gap-1">
                {onEdit && canEdit && (
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
