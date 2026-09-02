import { useMemo, useState } from 'react';
import { Copy, Pencil, PiggyBank, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { MonthSelector } from '@/components/MonthSelector';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CategoryIcon } from '@/components/CategoryIcon';
import { BudgetForm } from '@/components/budgets/BudgetForm';
import { useBudgets } from '@/hooks/useBudgets';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { budgetOverview, budgetProgress, groupByCategory, sumByType } from '@/utils/finance';
import { formatCurrency, formatPercent } from '@/utils/format';
import { getCurrentMonthYear, monthRange } from '@/utils/date';
import { cn } from '@/lib/utils';
import type { BudgetWithCategory } from '@/services/budgets.service';
import type { BudgetInput } from '@/lib/validations';

export default function BudgetsPage() {
  const [month, setMonth] = useState(getCurrentMonthYear);
  const range = useMemo(() => monthRange(month.year, month.month), [month]);
  const filters = useMemo(() => ({ dateStart: range.start, dateEnd: range.end }), [range]);

  const { budgets, loading, save, remove, copyFromPrevious } = useBudgets(month);
  const { transactions } = useTransactions(filters);
  const { categories } = useCategories();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetWithCategory | null>(null);
  const [deleting, setDeleting] = useState<BudgetWithCategory | null>(null);

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'EXPENSE'),
    [categories],
  );

  const categoryBudgets = useMemo(() => budgets.filter((b) => b.kind === 'CATEGORY'), [budgets]);
  const savingsBudget = useMemo(() => budgets.find((b) => b.kind === 'SAVINGS') ?? null, [budgets]);

  const spentByCategory = useMemo(() => {
    const groups = groupByCategory(transactions, 'EXPENSE');
    return new Map(groups.map((g) => [g.categoryId, g.total]));
  }, [transactions]);

  const savedThisMonth = useMemo(() => sumByType(transactions, 'SAVING'), [transactions]);

  const usedCategoryIds = useMemo(
    () => categoryBudgets.map((b) => b.category_id).filter((id): id is string => !!id),
    [categoryBudgets],
  );

  const totals = useMemo(() => {
    return budgetOverview(budgets, spentByCategory, savedThisMonth);
  }, [budgets, spentByCategory, savedThisMonth]);

  const handleSubmit = async (input: BudgetInput) => {
    await save(input);
    toast.success(editing ? 'Presupuesto actualizado' : 'Presupuesto creado');
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await remove(deleting.id);
      toast.success('Presupuesto eliminado');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar');
    }
  };

  const [copying, setCopying] = useState(false);
  const handleCopyPrevious = async () => {
    try {
      setCopying(true);
      const count = await copyFromPrevious();
      if (count > 0) toast.success(`Se copiaron ${count} presupuestos del mes anterior`);
      else toast.info('El mes anterior no tiene presupuestos para copiar');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo copiar');
    } finally {
      setCopying(false);
    }
  };

  const canAdd = expenseCategories.some((c) => !usedCategoryIds.includes(c.id)) || !savingsBudget;

  return (
    <>
      <PageHeader
        title="Presupuestos"
        description="Define límites mensuales por categoría"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleCopyPrevious} loading={copying}>
              <Copy className="h-4 w-4" /> Copiar mes anterior
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              disabled={!canAdd}
            >
              <Plus className="h-4 w-4" /> Nuevo
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-col gap-4">
        <MonthSelector value={month} onChange={setMonth} />
        {budgets.length > 0 && (
          <Card>
            <CardContent>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total presupuestado</span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(totals.totalUsed)} / {formatCurrency(totals.totalBudget)}
                </span>
              </div>
              <ProgressBar value={totals.percentage} />
            </CardContent>
          </Card>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : budgets.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="Sin presupuestos"
          description="Crea un presupuesto para controlar cuánto gastas por categoría."
          action={
            <Button variant="outline" onClick={() => setFormOpen(true)} disabled={!canAdd}>
              <Plus className="h-4 w-4" /> Crear presupuesto
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {savingsBudget && (
            <Card key={savingsBudget.id} className="border-primary/40">
              <CardContent>
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-primary">
                    <PiggyBank className="h-4 w-4" />
                  </span>
                  <span className="flex-1 truncate font-medium">Meta de ahorro</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(savingsBudget);
                      setFormOpen(true);
                    }}
                    aria-label="Editar"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(savingsBudget)}
                    aria-label="Eliminar"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-expense-soft hover:text-expense"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <ProgressBar
                  value={budgetProgress(savingsBudget.amount, savedThisMonth).percentage}
                  color="#0ea5e9"
                />

                <div className="mt-3 flex items-end justify-between">
                  <div className="text-xs text-muted-foreground">
                    <p>
                      Ahorrado{' '}
                      <span className="font-medium text-foreground">
                        {formatCurrency(savedThisMonth)}
                      </span>
                    </p>
                    <p className="text-primary">
                      {savedThisMonth >= savingsBudget.amount ? 'Meta cumplida 🎉' : 'Faltan '}
                      {savedThisMonth < savingsBudget.amount && (
                        <span className="font-medium">
                          {formatCurrency(savingsBudget.amount - savedThisMonth)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold tabular-nums">
                      {formatPercent(
                        budgetProgress(savingsBudget.amount, savedThisMonth).percentage,
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      meta {formatCurrency(savingsBudget.amount)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {categoryBudgets.map((budget) => {
            const spent = spentByCategory.get(budget.category_id) ?? 0;
            const progress = budgetProgress(budget.amount, spent);
            const over = progress.remaining < 0;
            return (
              <Card key={budget.id}>
                <CardContent>
                  <div className="mb-3 flex items-center gap-3">
                    <CategoryIcon
                      icon={budget.category?.icon ?? 'circle'}
                      color={budget.category?.color ?? '#94a3b8'}
                      size="sm"
                    />
                    <span className="flex-1 truncate font-medium">
                      {budget.category?.name ?? 'Sin categoría'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(budget);
                        setFormOpen(true);
                      }}
                      aria-label="Editar"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(budget)}
                      aria-label="Eliminar"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-expense-soft hover:text-expense"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <ProgressBar value={progress.percentage} color={budget.category?.color} />

                  <div className="mt-3 flex items-end justify-between">
                    <div className="text-xs text-muted-foreground">
                      <p>
                        Gastado{' '}
                        <span className="font-medium text-foreground">{formatCurrency(spent)}</span>
                      </p>
                      <p className={cn(over ? 'text-expense' : 'text-income')}>
                        {over ? 'Excedido ' : 'Disponible '}
                        <span className="font-medium">
                          {formatCurrency(Math.abs(progress.remaining))}
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold tabular-nums">
                        {formatPercent(progress.percentage)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        de {formatCurrency(budget.amount)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <BudgetForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        expenseCategories={expenseCategories}
        month={month}
        initial={editing}
        usedCategoryIds={usedCategoryIds}
        savingsUsed={!!savingsBudget}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar presupuesto"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
