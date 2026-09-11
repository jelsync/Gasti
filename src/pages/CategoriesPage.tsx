import { useMemo, useState } from 'react';
import { ListTree, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CategoryIcon } from '@/components/CategoryIcon';
import { CategoryForm } from '@/components/categories/CategoryForm';
import { CategoryMovementDetail } from '@/components/categories/CategoryMovementDetail';
import { MonthSelector } from '@/components/MonthSelector';
import { useCategories } from '@/hooks/useCategories';
import { useTransactions } from '@/hooks/useTransactions';
import { splitCategoriesByType } from '@/services/categories.service';
import type { Category, Currency } from '@/types/models';
import type { CategoryInput } from '@/lib/validations';
import { getIncomeCategories } from '@/constants/incomeCategories';
import { getCurrentMonthYear, monthRange } from '@/utils/date';
import { formatMoney } from '@/utils/format';
import { round2 } from '@/utils/finance';

type CategoryType = 'INCOME' | 'EXPENSE';

export default function CategoriesPage() {
  const { categories, loading, create, update, remove } = useCategories();
  const [month, setMonth] = useState(getCurrentMonthYear);
  const range = useMemo(() => monthRange(month.year, month.month), [month]);
  const transactionFilters = useMemo(
    () => ({ dateStart: range.start, dateEnd: range.end, type: 'EXPENSE' as const }),
    [range],
  );
  const { transactions } = useTransactions(transactionFilters);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [formType, setFormType] = useState<CategoryType>('EXPENSE');
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [detailCategory, setDetailCategory] = useState<Category | null>(null);

  const grouped = useMemo(() => {
    const result = splitCategoriesByType(categories);
    return { ...result, INCOME: getIncomeCategories(categories) };
  }, [categories]);

  const totalsByCategory = useMemo(() => {
    const totals = new Map<string, Record<Currency, number>>();
    for (const transaction of transactions) {
      if (!transaction.category_id) continue;
      const current = totals.get(transaction.category_id) ?? { HNL: 0, USD: 0 };
      current[transaction.currency] = round2(current[transaction.currency] + transaction.amount);
      totals.set(transaction.category_id, current);
    }
    return totals;
  }, [transactions]);

  const openCreate = (type: CategoryType) => {
    setEditing(null);
    setFormType(type);
    setFormOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setFormType(category.type as CategoryType);
    setFormOpen(true);
  };

  const handleSubmit = async (input: CategoryInput) => {
    if (editing) {
      await update(editing.id, input);
      toast.success('Categoría actualizada');
    } else {
      await create(input);
      toast.success('Categoría creada');
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await remove(deleting.id);
      toast.success('Categoría eliminada');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar');
    }
  };

  const sections: { type: CategoryType; title: string }[] = [
    { type: 'EXPENSE', title: 'Gastos' },
    { type: 'INCOME', title: 'Ingresos' },
  ];

  return (
    <>
      <PageHeader
        title="Categorías"
        description="Personaliza cómo clasificas tu dinero y revisa su acumulado mensual"
        actions={<MonthSelector value={month} onChange={setMonth} />}
      />

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {sections.map(({ type, title }) => (
            <Card key={type}>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>{title}</CardTitle>
                {type === 'EXPENSE' && (
                  <Button size="sm" variant="outline" onClick={() => openCreate(type)}>
                    <Plus className="h-4 w-4" /> Nueva
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {grouped[type].length === 0 ? (
                  <EmptyState icon={Tags} title="Sin categorías" />
                ) : (
                  <ul className="divide-y divide-border">
                    {grouped[type].map((c) => {
                      const totals = totalsByCategory.get(c.id) ?? { HNL: 0, USD: 0 };
                      return (
                        <li key={c.id} className="flex items-center gap-3 py-2.5">
                          <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{c.name}</p>
                            {type === 'EXPENSE' && (
                              <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                                <span>{formatMoney(totals.HNL, 'HNL')}</span>
                                {totals.USD > 0 && <span>{formatMoney(totals.USD, 'USD')}</span>}
                              </div>
                            )}
                          </div>
                          {type === 'EXPENSE' && (
                            <>
                              <button
                                type="button"
                                onClick={() => setDetailCategory(c)}
                                aria-label={`Ver detalle de ${c.name}`}
                                title="Ver gastos del mes"
                                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                              >
                                <ListTree className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEdit(c)}
                                aria-label="Editar"
                                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleting(c)}
                                aria-label="Eliminar"
                                className="rounded-md p-1.5 text-muted-foreground hover:bg-expense-soft hover:text-expense"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {type === 'INCOME' && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Las categorías de ingreso son fijas para mantener consistentes tus reportes.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CategoryForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        initial={editing}
        defaultType={formType}
      />

      <CategoryMovementDetail
        open={!!detailCategory}
        onClose={() => setDetailCategory(null)}
        category={detailCategory}
        month={month}
        transactions={transactions}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar categoría"
        description="Las transacciones de esta categoría quedarán como «Sin categoría». Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
