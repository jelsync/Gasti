import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Landmark,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoanForm } from '@/components/loans/LoanForm';
import { useLoans } from '@/hooks/useLoans';
import { useCategories } from '@/hooks/useCategories';
import { nextPaymentBreakdown, percentPaid, projectLoan } from '@/utils/loan';
import { formatCurrency, formatPercent } from '@/utils/format';
import { formatDate } from '@/utils/date';
import { cn } from '@/lib/utils';
import type { LoanWithCategory } from '@/types/models';
import type { LoanInput } from '@/lib/validations';

export default function LoansPage() {
  const { loans, loading, create, update, remove, pay } = useLoans();
  const { categories } = useCategories();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LoanWithCategory | null>(null);
  const [deleting, setDeleting] = useState<LoanWithCategory | null>(null);
  const [paying, setPaying] = useState<LoanWithCategory | null>(null);

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'EXPENSE'),
    [categories],
  );

  const totals = useMemo(
    () => ({
      owed: loans.reduce((acc, l) => acc + l.current_balance, 0),
      monthly: loans.reduce((acc, l) => acc + (l.current_balance > 0 ? l.installment : 0), 0),
    }),
    [loans],
  );

  const handleSubmit = async (input: LoanInput) => {
    if (editing) {
      await update(editing.id, input);
      toast.success('Préstamo actualizado');
    } else {
      await create(input);
      toast.success('Préstamo agregado');
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await remove(deleting.id);
      toast.success('Préstamo eliminado');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar');
    }
  };

  const handlePay = async () => {
    if (!paying) return;
    try {
      const result = await pay(paying);
      toast.success(
        `Pago registrado. Capital: ${formatCurrency(result.principal)} · Nuevo saldo: ${formatCurrency(result.newBalance)}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar el pago');
    }
  };

  const payPreview = paying
    ? nextPaymentBreakdown(paying.current_balance, paying.interest_rate, paying.installment)
    : null;

  return (
    <>
      <PageHeader
        title="Préstamos"
        description="Controla el saldo de tus préstamos y registra tus pagos"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Nuevo
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : loans.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="Sin préstamos"
          description="Agrega un préstamo para llevar cuánto debes y registrar tus cuotas."
          action={
            <Button variant="outline" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> Agregar préstamo
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-5">
              <p className="text-sm text-muted-foreground">Total que debes</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-expense">
                {formatCurrency(totals.owed)}
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-muted-foreground">Cuotas mensuales activas</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {formatCurrency(totals.monthly)}
              </p>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {loans.map((loan) => {
              const paid = percentPaid(loan.original_amount, loan.current_balance);
              const projection = projectLoan(
                loan.current_balance,
                loan.interest_rate,
                loan.installment,
                loan.start_date,
              );
              const settled = loan.current_balance <= 0;
              return (
                <Card key={loan.id}>
                  <CardContent className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{loan.name}</p>
                        {loan.loan_number && (
                          <p className="truncate text-xs text-muted-foreground">
                            N.º {loan.loan_number}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(loan);
                            setFormOpen(true);
                          }}
                          aria-label="Editar"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(loan)}
                          aria-label="Eliminar"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-expense-soft hover:text-expense"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Saldo actual</p>
                      <p className="text-2xl font-bold tabular-nums">
                        {formatCurrency(loan.current_balance)}
                      </p>
                    </div>

                    <div>
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                        <span>Pagado {formatPercent(paid)}</span>
                        <span>de {formatCurrency(loan.original_amount)}</span>
                      </div>
                      <ProgressBar value={paid} color={loan.category?.color ?? '#0d9488'} />
                    </div>

                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <Detail label="Cuota" value={formatCurrency(loan.installment)} />
                      <Detail label="Tasa anual" value={`${loan.interest_rate}%`} />
                      <Detail
                        label="Cuotas restantes"
                        value={
                          settled
                            ? 'Liquidado'
                            : projection.coversInterest
                              ? String(projection.monthsRemaining)
                              : '—'
                        }
                      />
                      <Detail
                        label="Liquidación est."
                        value={
                          settled || !projection.estimatedPayoffISO
                            ? '—'
                            : formatDate(projection.estimatedPayoffISO)
                        }
                      />
                      {loan.category && (
                        <Detail label="Categoría de pago" value={loan.category.name} />
                      )}
                      {projection.coversInterest && !settled && (
                        <Detail
                          label="Intereses restantes"
                          value={formatCurrency(projection.totalInterestRemaining)}
                        />
                      )}
                    </dl>

                    {!projection.coversInterest && !settled && (
                      <p className="flex items-center gap-2 rounded-md bg-expense-soft px-3 py-2 text-xs text-expense">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        La cuota no cubre el interés mensual; revisa los datos.
                      </p>
                    )}

                    {settled ? (
                      <p className="flex items-center gap-2 text-sm font-medium text-income">
                        <CheckCircle2 className="h-4 w-4" /> Préstamo liquidado
                      </p>
                    ) : (
                      <Button variant="outline" className="w-full" onClick={() => setPaying(loan)}>
                        <Banknote className="h-4 w-4" /> Registrar pago
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <LoanForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        expenseCategories={expenseCategories}
        initial={editing}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar préstamo"
        description="Se eliminará el préstamo (no las transacciones ya registradas). Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />

      <ConfirmDialog
        open={!!paying}
        danger={false}
        title="Registrar pago"
        description={
          paying && payPreview
            ? `Se creará un gasto de ${formatCurrency(paying.installment)}${
                paying.category ? ` en «${paying.category.name}»` : ''
              }. Capital: ${formatCurrency(payPreview.principal)} · Interés: ${formatCurrency(
                payPreview.interest,
              )}. El saldo bajará a ${formatCurrency(payPreview.newBalance)}.`
            : ''
        }
        confirmLabel="Registrar pago"
        onConfirm={handlePay}
        onClose={() => setPaying(null)}
      />
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('font-medium tabular-nums')}>{value}</dd>
    </div>
  );
}
