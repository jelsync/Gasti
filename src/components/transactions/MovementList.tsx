import { CreditCard as CardIcon, Pencil, Trash2 } from 'lucide-react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { formatCurrency, formatMoney } from '@/utils/format';
import { formatDate } from '@/utils/date';
import { cn } from '@/lib/utils';
import type { TransactionWithCategory } from '@/types/models';
import type { CardChargeWithCard } from '@/services/cards.service';

export type MovementItem =
  | { type: 'tx'; date: string; tx: TransactionWithCategory }
  | { type: 'charge'; date: string; charge: CardChargeWithCard };

interface MovementListProps {
  items: MovementItem[];
  onEditTx?: (t: TransactionWithCategory) => void;
  onDeleteTx?: (t: TransactionWithCategory) => void;
  onDeleteCharge?: (c: CardChargeWithCard) => void;
}

function txDisplay(t: TransactionWithCategory) {
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

export function MovementList({ items, onEditTx, onDeleteTx, onDeleteCharge }: MovementListProps) {
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => {
        if (item.type === 'charge') {
          const c = item.charge;
          return (
            <li key={`c-${c.id}`} className="flex items-center gap-3 py-3">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: c.card?.color ?? '#6366f1' }}
              >
                <CardIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">
                  Compra: {c.card?.name ?? 'Tarjeta'}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.description ? `${c.description} · ` : ''}
                  {formatDate(c.charge_date)} · aumenta deuda
                </p>
              </div>
              <span className="shrink-0 font-semibold tabular-nums text-muted-foreground">
                {formatMoney(c.amount, c.currency)}
              </span>
              {onDeleteCharge && (
                <button
                  type="button"
                  onClick={() => onDeleteCharge(c)}
                  aria-label="Eliminar"
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-expense-soft hover:text-expense"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          );
        }

        const t = item.tx;
        const d = txDisplay(t);
        const canEdit = !t.credit_card_id && !t.loan_id;
        return (
          <li key={`t-${t.id}`} className="flex items-center gap-3 py-3">
            <CategoryIcon icon={d.icon} color={d.color} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{d.name}</p>
              <p className="truncate text-xs text-muted-foreground">
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
            {(onEditTx || onDeleteTx) && (
              <div className="flex shrink-0 items-center gap-1">
                {onEditTx && canEdit && (
                  <button
                    type="button"
                    onClick={() => onEditTx(t)}
                    aria-label="Editar"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                {onDeleteTx && (
                  <button
                    type="button"
                    onClick={() => onDeleteTx(t)}
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
