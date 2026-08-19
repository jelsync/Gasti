import { useMemo, useState } from 'react';
import { Pencil, PiggyBank, Plus, Trash2 } from 'lucide-react';
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
import { budgetProgress, groupByCategory } from '@/utils/finance';
import { formatCurrency, formatPercent } from '@/utils/format';
import { getCurrentMonthYear, monthRange } from '@/utils/date';
import { cn } from '@/lib/utils';
import type { BudgetWithCategory } from '@/services/budgets.service';
import type { BudgetInput } from '@/lib/validations';

export default function BudgetsPage() {
  const [month, setMonth] = useState(getCurrentMonthYear);
  const range = useMemo(() => monthRange(month.year, month.month), [month]);
  const filters = useMemo(() => ({ dateStart: range.start, dateEnd: range.end }), [range]);

  const { budgets, loading, save, remove } = useBudgets(month);
  const { transactions } = useTransactions(filters);
  const { categories } = useCategories();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetWithCategory | null>(null);
  const [deleting, setDeleting] = useState<BudgetWithCategory | null>(null);

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'EXPENSE'),
    [categories],
  );

  const spentByCategory = useMemo(() => {
    const groups = groupByCategory(transactions, 'EXPENSE');
    return new Map(groups.map((g) => [g.categoryId, g.total]));
  }, [transactions]);

  const usedCategoryIds = useMemo(() => budgets.map((b) => b.category_id), [budgets]);

  const totals = useMemo(() => {
    const totalBudget = budgets.reduce((acc, b) => acc + b.amount, 0);
    const totalSpent = budgets.reduce(
      (acc, b) => acc + (spentByCategory.get(b.category_id) ?? 0),
      0,
    );
    return { totalBudget, totalSpent };
  }, [budgets, spentByCategory]);

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

  const canAdd = expenseCategories.some((c) => !usedCategoryIds.includes(c.id));

  return (
    <>
      <PageHeader
        title="Presupuestos"
        description="Define límites mensuales por categoría"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            disabled={!canAdd}
          >
            <Plus className="h-4 w-4" /> Nuevo
          </Button>
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
                  {formatCurrency(totals.totalSpent)} / {formatCurrency(totals.totalBudget)}
                </span>
              </div>
              <ProgressBar
                value={totals.totalBudget > 0 ? (totals.totalSpent / totals.totalBudget) * 100 : 0}
              />
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
          {budgets.map((budget) => {
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
