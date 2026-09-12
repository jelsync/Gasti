import { useMemo, useState } from 'react';
import {
  Archive,
  BadgeCheck,
  CircleEqual,
  ClipboardCheck,
  PencilLine,
  Trash2,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { MonthSelector } from '@/components/MonthSelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ReconciliationForm } from '@/components/reconciliation/ReconciliationForm';
import { MonthClosureForm } from '@/components/reconciliation/MonthClosureForm';
import { useReconciliation } from '@/hooks/useReconciliation';
import { useTransactions } from '@/hooks/useTransactions';
import { useLoans } from '@/hooks/useLoans';
import { useCreditCards } from '@/hooks/useCreditCards';
import { monthlySummary } from '@/utils/finance';
import {
  compareMonthYear,
  formatDate,
  formatMonthYear,
  getCurrentMonthYear,
  monthRange,
  todayISO,
} from '@/utils/date';
import { formatMoney } from '@/utils/format';
import type { AccountReconciliationWithAccount, SavingsAccountWithBalance } from '@/types/models';
import type { MonthClosureSnapshot } from '@/services/reconciliation.service';

export default function ReconciliationPage() {
  const [month, setMonth] = useState(getCurrentMonthYear);
  const [reconciling, setReconciling] = useState<SavingsAccountWithBalance | null>(null);
  const [deleting, setDeleting] = useState<AccountReconciliationWithAccount | null>(null);
  const [closureOpen, setClosureOpen] = useState(false);
  const range = useMemo(() => monthRange(month.year, month.month), [month]);
  const filters = useMemo(() => ({ dateStart: range.start, dateEnd: range.end }), [range]);
  const {
    accounts,
    reconciliations,
    closure,
    loading,
    error,
    reconcile,
    removeReconciliation,
    closeMonth,
  } = useReconciliation(month);
  const { transactions, loading: transactionsLoading } = useTransactions(filters);
  const { loans, loading: loansLoading } = useLoans();
  const { cards, loading: cardsLoading } = useCreditCards();
  const currentMonth = getCurrentMonthYear();
  const futureMonth = compareMonthYear(month, currentMonth) > 0;
  const canCloseMonth = range.end <= todayISO();
  const reconciliationDate = compareMonthYear(month, currentMonth) === 0 ? todayISO() : range.end;

  const reconciledAccountIds = useMemo(
    () => new Set(reconciliations.map((item) => item.savings_account_id)),
    [reconciliations],
  );
  const summaryHnl = useMemo(() => monthlySummary(transactions, 'HNL'), [transactions]);
  const summaryUsd = useMemo(() => monthlySummary(transactions, 'USD'), [transactions]);
  const savedSnapshot = closure?.snapshot as unknown as MonthClosureSnapshot | undefined;
  const isLoading = loading || transactionsLoading || loansLoading || cardsLoading;

  const saveClosure = async (notes: string) => {
    const snapshot: MonthClosureSnapshot = {
      generatedAt: new Date().toISOString(),
      accounts: accounts.map((account) => ({
        id: account.id,
        name: account.name,
        balance: account.balance,
      })),
      summary: {
        incomeHnl: summaryHnl.income,
        expenseHnl: summaryHnl.expense,
        incomeUsd: summaryUsd.income,
        expenseUsd: summaryUsd.expense,
      },
      debts: {
        loansHnl: loans.reduce((total, loan) => total + loan.current_balance, 0),
        cardsHnl: cards.reduce((total, card) => total + card.balanceHnl, 0),
        cardsUsd: cards.reduce((total, card) => total + card.balanceUsd, 0),
      },
    };
    await closeMonth(snapshot, notes);
    toast.success(closure ? 'Cierre actualizado' : 'Mes cerrado');
  };

  return (
    <>
      <PageHeader
        title="Conciliación y cierre"
        description="Compara tus cuentas con el banco y conserva una fotografía de cada mes"
        actions={<MonthSelector value={month} onChange={setMonth} />}
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : error ? (
        <p className="py-10 text-center text-sm text-danger">{error}</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard
              label="Cuentas conciliadas"
              value={`${reconciledAccountIds.size} de ${accounts.length}`}
              icon={ClipboardCheck}
            />
            <SummaryCard
              label="Ajustes aplicados"
              value={String(reconciliations.filter((item) => item.apply_adjustment).length)}
              icon={CircleEqual}
            />
            <SummaryCard
              label="Estado del mes"
              value={closure ? 'Cerrado' : 'Abierto'}
              icon={closure ? BadgeCheck : Archive}
              success={!!closure}
            />
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Saldos al {formatDate(reconciliationDate)}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  El saldo calculado incluye movimientos y ajustes aplicados hasta esa fecha.
                </p>
              </div>
              {canCloseMonth && accounts.length > 0 && (
                <Button
                  variant={closure ? 'outline' : 'primary'}
                  onClick={() => setClosureOpen(true)}
                >
                  <Archive className="h-4 w-4" />
                  {closure ? 'Actualizar cierre' : 'Cerrar mes'}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!futureMonth && !canCloseMonth && (
                <p className="mb-4 rounded-[var(--radius)] bg-muted p-3 text-xs text-muted-foreground">
                  Podrás guardar el cierre cuando finalice el mes. Mientras tanto puedes conciliar
                  tus cuentas al día de hoy.
                </p>
              )}
              {accounts.length === 0 ? (
                <EmptyState icon={Wallet} title="No había cuentas en este período" />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {accounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center gap-3 rounded-[var(--radius)] border border-border p-4"
                    >
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: account.color }}
                      >
                        <Wallet className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{account.name}</p>
                        <p className="font-bold tabular-nums">
                          {formatMoney(account.balance, 'HNL')}
                        </p>
                        {reconciledAccountIds.has(account.id) && (
                          <p className="text-xs font-medium text-income">Conciliada este mes</p>
                        )}
                      </div>
                      {!futureMonth && (
                        <Button size="sm" variant="outline" onClick={() => setReconciling(account)}>
                          Conciliar
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {closure && savedSnapshot && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Fotografía guardada de {formatMonthYear(month.month, month.year)}
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Guardada el {formatDate(closure.closed_at.slice(0, 10))}. El cierre no bloquea
                  correcciones.
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SnapshotAmount
                  label="Saldo en cuentas"
                  value={savedSnapshot.accounts.reduce(
                    (total, account) => total + account.balance,
                    0,
                  )}
                />
                <SnapshotAmount label="Ingresos" value={savedSnapshot.summary.incomeHnl} />
                <SnapshotAmount label="Gastos" value={savedSnapshot.summary.expenseHnl} />
                <SnapshotAmount label="Deuda en préstamos" value={savedSnapshot.debts.loansHnl} />
                <SnapshotAmount label="Deuda en tarjetas" value={savedSnapshot.debts.cardsHnl} />
                {(savedSnapshot.summary.incomeUsd > 0 || savedSnapshot.summary.expenseUsd > 0) && (
                  <SnapshotAmount
                    label="Ingresos / gastos USD"
                    value={savedSnapshot.summary.incomeUsd}
                    secondary={savedSnapshot.summary.expenseUsd}
                    currency="USD"
                  />
                )}
                {savedSnapshot.debts.cardsUsd > 0 && (
                  <SnapshotAmount
                    label="Deuda en tarjetas USD"
                    value={savedSnapshot.debts.cardsUsd}
                    currency="USD"
                  />
                )}
                <div className="sm:col-span-2 lg:col-span-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Saldos guardados por cuenta
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {savedSnapshot.accounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex justify-between gap-3 rounded-[var(--radius)] border border-border px-3 py-2 text-sm"
                      >
                        <span className="truncate">{account.name}</span>
                        <span className="shrink-0 font-semibold tabular-nums">
                          {formatMoney(account.balance, 'HNL')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Historial de conciliaciones</CardTitle>
            </CardHeader>
            <CardContent>
              {reconciliations.length === 0 ? (
                <EmptyState
                  icon={ClipboardCheck}
                  title="Sin conciliaciones este mes"
                  description="Selecciona una cuenta y compara su saldo con el banco."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {reconciliations.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-3">
                      <PencilLine className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {item.savings_account?.name ?? 'Cuenta eliminada'}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatDate(item.reconciliation_date)}
                          {item.notes ? ` · ${item.notes}` : ''}
                          {!item.apply_adjustment ? ' · Sin aplicar' : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={
                            item.difference > 0
                              ? 'font-semibold tabular-nums text-income'
                              : item.difference < 0
                                ? 'font-semibold tabular-nums text-expense'
                                : 'font-semibold tabular-nums'
                          }
                        >
                          {formatMoney(item.difference, 'HNL')}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Real: {formatMoney(item.actual_balance, 'HNL')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDeleting(item)}
                        aria-label="Eliminar conciliación"
                        className="rounded-md p-2 text-muted-foreground hover:bg-expense-soft hover:text-expense"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <ReconciliationForm
        account={reconciling}
        date={reconciliationDate}
        minDate={range.start}
        maxDate={reconciliationDate}
        onClose={() => setReconciling(null)}
        onSubmit={async (input) => {
          await reconcile(input);
          toast.success(
            input.apply_adjustment ? 'Saldo conciliado y ajustado' : 'Comparación guardada',
          );
        }}
      />
      <MonthClosureForm
        open={closureOpen}
        updating={!!closure}
        existingNotes={closure?.notes ?? ''}
        onClose={() => setClosureOpen(false)}
        onSubmit={saveClosure}
      />
      <ConfirmDialog
        open={!!deleting}
        title="Eliminar conciliación"
        description="Si aplicaste la diferencia, eliminarla también revertirá ese ajuste en el saldo de la cuenta."
        confirmLabel="Eliminar"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await removeReconciliation(deleting.id);
            toast.success('Conciliación eliminada');
          } catch (cause) {
            toast.error(cause instanceof Error ? cause.message : 'No se pudo eliminar');
          }
        }}
      />
    </>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  success = false,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
  success?: boolean;
}) {
  return (
    <Card className="flex items-center justify-between p-4">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={success ? 'mt-1 text-xl font-bold text-income' : 'mt-1 text-xl font-bold'}>
          {value}
        </p>
      </div>
      <Icon className={success ? 'h-5 w-5 text-income' : 'h-5 w-5 text-primary'} />
    </Card>
  );
}

function SnapshotAmount({
  label,
  value,
  secondary,
  currency = 'HNL',
}: {
  label: string;
  value: number;
  secondary?: number;
  currency?: 'HNL' | 'USD';
}) {
  return (
    <div className="rounded-[var(--radius)] bg-muted p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-bold tabular-nums">{formatMoney(value, currency)}</p>
      {secondary !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">
          Gastos: {formatMoney(secondary, currency)}
        </p>
      )}
    </div>
  );
}
