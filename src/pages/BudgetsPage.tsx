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
import { useSavingsAccounts } from '@/hooks/useSavingsAccounts';
import {
  budgetOverview,
  budgetProgress,
  groupByCategory,
  savingsGoalMovement,
} from '@/utils/finance';
import { formatCurrency, formatMoney, formatPercent } from '@/utils/format';
import { getCurrentMonthYear, monthRange } from '@/utils/date';
import { cn } from '@/lib/utils';
import type { BudgetWithCategory } from '@/services/budgets.service';
import type { BudgetInput } from '@/lib/validations';
import type { Currency } from '@/types/models';

export default function BudgetsPage() {
  const [month, setMonth] = useState(getCurrentMonthYear);
  const range = useMemo(() => monthRange(month.year, month.month), [month]);
  const filters = useMemo(() => ({ dateStart: range.start, dateEnd: range.end }), [range]);

  const { budgets, loading, save, remove, copyFromPrevious } = useBudgets(month);
  const { transactions } = useTransactions(filters);
  const { categories } = useCategories();
  const { accounts } = useSavingsAccounts();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetWithCategory | null>(null);
  const [deleting, setDeleting] = useState<BudgetWithCategory | null>(null);
  const [initialCategoryId, setInitialCategoryId] = useState<string | null>(null);
  const [initialCurrency, setInitialCurrency] = useState<Currency>('HNL');

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'EXPENSE'),
    [categories],
  );

  const categoryBudgets = useMemo(() => budgets.filter((b) => b.kind === 'CATEGORY'), [budgets]);
  const savingsBudget = useMemo(() => budgets.find((b) => b.kind === 'SAVINGS') ?? null, [budgets]);

  const spentByCurrency = useMemo(() => {
    const build = (currency: Currency) =>
      new Map(
        groupByCategory(transactions, 'EXPENSE', currency).map((group) => [
          group.categoryId,
          group.total,
        ]),
      );
    return { HNL: build('HNL'), USD: build('USD') };
  }, [transactions]);

  const savedThisMonth = useMemo(
    () =>
      savingsGoalMovement(
        transactions,
        new Set(accounts.filter((account) => account.include_in_savings_goal).map((a) => a.id)),
      ),
    [transactions, accounts],
  );

  const usedBudgetKeys = useMemo(
    () =>
      categoryBudgets
        .filter((budget) => !!budget.category_id)
        .map((budget) => `${budget.category_id}:${budget.currency}`),
    [categoryBudgets],
  );

  const unbudgetedExpenses = useMemo(
    () =>
      (['HNL', 'USD'] as const)
        .flatMap((currency) =>
          Array.from(spentByCurrency[currency].entries())
            .filter(
              ([categoryId, spent]) =>
                categoryId !== null &&
                spent > 0 &&
                !usedBudgetKeys.includes(`${categoryId}:${currency}`),
            )
            .map(([categoryId, spent]) => {
              const category = expenseCategories.find((item) => item.id === categoryId);
              return {
                categoryId: categoryId as string,
                currency,
                spent,
                name: category?.name ?? 'Categoría eliminada',
                icon: category?.icon ?? 'circle',
                color: category?.color ?? '#f59e0b',
              };
            }),
        )
        .sort((left, right) => right.spent - left.spent),
    [spentByCurrency, usedBudgetKeys, expenseCategories],
  );

  const unbudgetedTotals = useMemo(
    () => ({
      HNL: unbudgetedExpenses
        .filter((item) => item.currency === 'HNL')
        .reduce((total, item) => total + item.spent, 0),
      USD: unbudgetedExpenses
        .filter((item) => item.currency === 'USD')
        .reduce((total, item) => total + item.spent, 0),
    }),
    [unbudgetedExpenses],
  );

  const totals = useMemo(
    () => ({
      HNL: budgetOverview(
        budgets.filter((budget) => budget.currency === 'HNL'),
        spentByCurrency.HNL,
        savedThisMonth,
      ),
      USD: budgetOverview(
        categoryBudgets.filter((budget) => budget.currency === 'USD'),
        spentByCurrency.USD,
        0,
      ),
    }),
    [budgets, categoryBudgets, spentByCurrency, savedThisMonth],
  );

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

  const canAdd =
    expenseCategories.some((category) =>
      (['HNL', 'USD'] as const).some(
        (currency) => !usedBudgetKeys.includes(`${category.id}:${currency}`),
      ),
    ) || !savingsBudget;

  const openNewBudget = (categoryId: string | null = null, currency: Currency = 'HNL') => {
    setEditing(null);
    setInitialCategoryId(categoryId);
    setInitialCurrency(currency);
    setFormOpen(true);
  };

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
                openNewBudget();
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
        {(budgets.length > 0 || unbudgetedTotals.HNL > 0 || unbudgetedTotals.USD > 0) && (
          <Card>
            <CardContent>
              <div className="space-y-4">
                {(['HNL', 'USD'] as const).map((currency) => {
                  const overview = totals[currency];
                  const outside = unbudgetedTotals[currency];
                  if (overview.totalBudget === 0 && outside === 0) return null;
                  return (
                    <div key={currency}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Total presupuestado ({currency})
                        </span>
                        <span className="font-semibold tabular-nums">
                          {formatMoney(overview.totalUsed, currency)} /{' '}
                          {formatMoney(overview.totalBudget, currency)}
                        </span>
                      </div>
                      <ProgressBar value={overview.percentage} />
                      {outside > 0 && (
                        <p className="mt-2 text-xs font-medium text-expense">
                          {formatMoney(outside, currency)} adicionales están fuera del presupuesto.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : budgets.length === 0 && unbudgetedExpenses.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="Sin presupuestos"
          description="Crea un presupuesto para controlar cuánto gastas por categoría."
          action={
            <Button variant="outline" onClick={() => openNewBudget()} disabled={!canAdd}>
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
            const spent = spentByCurrency[budget.currency].get(budget.category_id) ?? 0;
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
                        <span className="font-medium text-foreground">
                          {formatMoney(spent, budget.currency)}
                        </span>
                      </p>
                      <p className={cn(over ? 'text-expense' : 'text-income')}>
                        {over ? 'Excedido ' : 'Disponible '}
                        <span className="font-medium">
                          {formatMoney(Math.abs(progress.remaining), budget.currency)}
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold tabular-nums">
                        {formatPercent(progress.percentage)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        de {formatMoney(budget.amount, budget.currency)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {unbudgetedExpenses.map((item) => (
            <Card
              key={`unbudgeted-${item.categoryId}-${item.currency}`}
              className="border-expense/40"
            >
              <CardContent>
                <div className="mb-3 flex items-center gap-3">
                  <CategoryIcon icon={item.icon} color={item.color} size="sm" />
                  <span className="flex-1 truncate font-medium">{item.name}</span>
                  <span className="rounded-full bg-expense-soft px-2 py-1 text-xs font-medium text-expense">
                    Sin presupuesto
                  </span>
                </div>
                <ProgressBar value={100} color="#f59e0b" />
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    Gastado{' '}
                    <span className="font-medium text-foreground">
                      {formatMoney(item.spent, item.currency)}
                    </span>
                    <p className="text-expense">No existe un límite definido para este mes.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openNewBudget(item.categoryId, item.currency)}
                  >
                    Crear presupuesto
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BudgetForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        expenseCategories={expenseCategories}
        month={month}
        initial={editing}
        usedBudgetKeys={usedBudgetKeys}
        savingsUsed={!!savingsBudget}
        initialCategoryId={initialCategoryId}
        initialCurrency={initialCurrency}
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
