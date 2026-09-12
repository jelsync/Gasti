import { ReceiptText } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate, formatMonthYear } from '@/utils/date';
import { formatMoney } from '@/utils/format';
import { round2 } from '@/utils/finance';
import type { Currency, TransactionWithCategory } from '@/types/models';
import type { MonthYear } from '@/utils/date';
import { HIDDEN_AMOUNT, PrivacyToggle } from '@/components/ui/PrivacyToggle';
import { PRIVACY_KEYS, usePrivacy } from '@/contexts/privacy';

export interface CategoryDetailTarget {
  id: string | null;
  name: string;
  type: 'INCOME' | 'EXPENSE';
}

interface CategoryMovementDetailProps {
  open: boolean;
  onClose: () => void;
  category: CategoryDetailTarget | null;
  month: MonthYear;
  transactions: TransactionWithCategory[];
}

interface DetailRow {
  transaction: TransactionWithCategory;
  accumulated: number;
}

export function CategoryMovementDetail({
  open,
  onClose,
  category,
  month,
  transactions,
}: CategoryMovementDetailProps) {
  const { isHidden } = usePrivacy();
  const isIncome = category?.type === 'INCOME';
  const hidden = isIncome && isHidden(PRIVACY_KEYS.income);
  const movementLabel = isIncome ? 'Ingreso' : 'Gasto';
  const categoryTransactions = category
    ? transactions
        .filter(
          (transaction) =>
            transaction.type === category.type && transaction.category_id === category.id,
        )
        .sort(
          (left, right) =>
            left.transaction_date.localeCompare(right.transaction_date) ||
            left.created_at.localeCompare(right.created_at),
        )
    : [];

  const running: Record<Currency, number> = { HNL: 0, USD: 0 };
  const rows: DetailRow[] = categoryTransactions.map((transaction) => {
    running[transaction.currency] = round2(running[transaction.currency] + transaction.amount);
    return { transaction, accumulated: running[transaction.currency] };
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Detalle de ${category?.name ?? 'categoría'}`}
      description={`${isIncome ? 'Ingresos' : 'Gastos'} de ${formatMonthYear(month.month, month.year)}`}
      className="sm:max-w-2xl"
    >
      {rows.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title={`Sin ${isIncome ? 'ingresos' : 'gastos'} en esta categoría`}
          description="Los movimientos del mes seleccionado aparecerán aquí."
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {isIncome && <PrivacyToggle privacyKey={PRIVACY_KEYS.income} />}
            {(['HNL', 'USD'] as const).map((currency) => {
              const total = running[currency];
              if (total === 0) return null;
              return (
                <span
                  key={currency}
                  className={
                    'rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums ' +
                    (isIncome ? 'bg-income-soft text-income' : 'bg-expense-soft text-expense')
                  }
                >
                  Total {currency}: {hidden ? HIDDEN_AMOUNT : formatMoney(total, currency)}
                </span>
              );
            })}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-3 font-medium">Fecha</th>
                  <th className="pb-2 pr-3 font-medium">Detalle</th>
                  <th className="pb-2 pr-3 text-right font-medium">{movementLabel}</th>
                  <th className="pb-2 text-right font-medium">Acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(({ transaction, accumulated }) => (
                  <tr key={transaction.id}>
                    <td className="whitespace-nowrap py-3 pr-3 text-muted-foreground">
                      {formatDate(transaction.transaction_date)}
                    </td>
                    <td className="max-w-56 py-3 pr-3">
                      <p className="truncate font-medium">
                        {transaction.description || `${movementLabel} sin descripción`}
                      </p>
                      {(transaction.credit_card || transaction.savings_account) && (
                        <p className="truncate text-xs text-muted-foreground">
                          {transaction.credit_card
                            ? `Tarjeta ${transaction.credit_card.name}`
                            : `Cuenta ${transaction.savings_account?.name}`}
                        </p>
                      )}
                    </td>
                    <td
                      className={
                        'whitespace-nowrap py-3 pr-3 text-right font-medium tabular-nums ' +
                        (isIncome ? 'text-income' : 'text-expense')
                      }
                    >
                      {hidden
                        ? HIDDEN_AMOUNT
                        : formatMoney(transaction.amount, transaction.currency)}
                    </td>
                    <td className="whitespace-nowrap py-3 text-right font-semibold tabular-nums">
                      {hidden ? HIDDEN_AMOUNT : formatMoney(accumulated, transaction.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
