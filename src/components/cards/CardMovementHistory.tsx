import { Banknote, CreditCard, ShoppingBag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { useCreditCardMovements } from '@/hooks/useCreditCardMovements';
import { formatDate } from '@/utils/date';
import { formatMoney } from '@/utils/format';
import type { CreditCardWithBalance, Currency } from '@/types/models';

interface CardMovementHistoryProps {
  card: CreditCardWithBalance;
}

export function CardMovementHistory({ card }: CardMovementHistoryProps) {
  const { movements, loading, error } = useCreditCardMovements(card.id);
  const openings: { currency: Currency; amount: number }[] = [
    { currency: 'HNL' as const, amount: card.opening_balance },
    { currency: 'USD' as const, amount: card.opening_balance_usd },
  ].filter((opening) => opening.amount > 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Movimientos de {card.name}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Compras que aumentan la deuda y pagos que la reducen
          </p>
        </div>
        <div className="shrink-0 text-right text-sm font-semibold tabular-nums">
          <p>{formatMoney(card.balanceHnl, 'HNL')}</p>
          {(card.balanceUsd > 0 || card.opening_balance_usd > 0) && (
            <p>{formatMoney(card.balanceUsd, 'USD')}</p>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : error ? (
          <p className="py-6 text-center text-sm text-danger">{error}</p>
        ) : movements.length === 0 && openings.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="Sin movimientos"
            description="Las compras y pagos de esta tarjeta aparecerán aquí."
          />
        ) : (
          <ul className="divide-y divide-border">
            {movements.map((movement) => {
              const isCharge = movement.kind === 'CHARGE';
              return (
                <li
                  key={`${movement.kind}-${movement.id}`}
                  className="flex items-center gap-3 py-3"
                >
                  <span
                    className={
                      'flex h-10 w-10 items-center justify-center rounded-full ' +
                      (isCharge ? 'bg-expense-soft text-expense' : 'bg-income-soft text-income')
                    }
                  >
                    {isCharge ? (
                      <ShoppingBag className="h-5 w-5" />
                    ) : (
                      <Banknote className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{isCharge ? 'Compra / cargo' : 'Pago'}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {isCharge && movement.description ? `${movement.description} · ` : ''}
                      {formatDate(movement.date)}
                      {!isCharge && movement.currency === 'USD' && movement.amountHnl
                        ? ` · Pagado ${formatMoney(movement.amountHnl, 'HNL')}`
                        : ''}
                    </p>
                  </div>
                  <span
                    className={
                      'shrink-0 font-semibold tabular-nums ' +
                      (isCharge ? 'text-expense' : 'text-income')
                    }
                  >
                    {isCharge ? '+' : '−'} {formatMoney(movement.amount, movement.currency)}
                  </span>
                </li>
              );
            })}
            {openings.map((opening) => (
              <li key={`opening-${opening.currency}`} className="flex items-center gap-3 py-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: card.color }}
                >
                  <CreditCard className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Deuda inicial ({opening.currency})</p>
                  <p className="text-xs text-muted-foreground">Registrada al crear la tarjeta</p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-expense">
                  + {formatMoney(opening.amount, opening.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
