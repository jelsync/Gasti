import { Banknote, CirclePlus, History, Landmark } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useLoanMovements } from '@/hooks/useLoanMovements';
import { round2 } from '@/utils/finance';
import { formatDate } from '@/utils/date';
import { formatCurrency } from '@/utils/format';
import type { LoanWithCategory } from '@/types/models';

interface LoanMovementHistoryProps {
  loan: LoanWithCategory;
  refreshKey?: number;
}

export function LoanMovementHistory({ loan, refreshKey = 0 }: LoanMovementHistoryProps) {
  const { movements, loading, error } = useLoanMovements(loan.id, refreshKey);
  const recordedPrincipal = round2(
    movements.reduce((total, movement) => total + movement.principal, 0),
  );
  const previousPrincipal = Math.max(
    0,
    round2(loan.original_amount - loan.current_balance - recordedPrincipal),
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Movimientos de {loan.name}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuotas y abonos que reducen el capital del préstamo
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted-foreground">Saldo actual</p>
          <p className="font-semibold tabular-nums text-expense">
            {formatCurrency(loan.current_balance)}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : error ? (
          <p className="py-6 text-center text-sm text-danger">{error}</p>
        ) : (
          <ul className="divide-y divide-border">
            {movements.map((movement) => {
              const isExtra = movement.kind === 'EXTRA';
              return (
                <li key={movement.id} className="flex items-center gap-3 py-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-income-soft text-income">
                    {isExtra ? (
                      <CirclePlus className="h-5 w-5" />
                    ) : (
                      <Banknote className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {isExtra ? 'Abono a capital' : 'Pago de cuota'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDate(movement.date)} · Pago {formatCurrency(movement.amount)}
                      {!isExtra && ` · Interés ${formatCurrency(movement.interest)}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Saldo después: {formatCurrency(movement.balanceAfter)}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums text-income">
                    − {formatCurrency(movement.principal)}
                  </span>
                </li>
              );
            })}

            {previousPrincipal > 0 && (
              <li className="flex items-center gap-3 py-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <History className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Capital pagado antes del historial</p>
                  <p className="text-xs text-muted-foreground">
                    Diferencia acumulada antes de registrar pagos detallados
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-income">
                  − {formatCurrency(previousPrincipal)}
                </span>
              </li>
            )}

            <li className="flex items-center gap-3 py-3">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: loan.category?.color ?? '#0d9488' }}
              >
                <Landmark className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">Saldo original</p>
                <p className="text-xs text-muted-foreground">
                  Préstamo iniciado el {formatDate(loan.start_date)}
                </p>
              </div>
              <span className="shrink-0 font-semibold tabular-nums text-expense">
                + {formatCurrency(loan.original_amount)}
              </span>
            </li>
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
