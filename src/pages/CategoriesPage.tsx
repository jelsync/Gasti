import { useMemo, useState } from 'react';
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CategoryIcon } from '@/components/CategoryIcon';
import { CategoryForm } from '@/components/categories/CategoryForm';
import { useCategories } from '@/hooks/useCategories';
import { splitCategoriesByType } from '@/services/categories.service';
import type { Category } from '@/types/models';
import type { CategoryInput } from '@/lib/validations';

type CategoryType = 'INCOME' | 'EXPENSE';

export default function CategoriesPage() {
  const { categories, loading, create, update, remove } = useCategories();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [formType, setFormType] = useState<CategoryType>('EXPENSE');
  const [deleting, setDeleting] = useState<Category | null>(null);

  const grouped = useMemo(() => splitCategoriesByType(categories), [categories]);

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
      <PageHeader title="Categorías" description="Personaliza cómo clasificas tu dinero" />

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
                <Button size="sm" variant="outline" onClick={() => openCreate(type)}>
                  <Plus className="h-4 w-4" /> Nueva
                </Button>
              </CardHeader>
              <CardContent>
                {grouped[type].length === 0 ? (
                  <EmptyState icon={Tags} title="Sin categorías" />
                ) : (
                  <ul className="divide-y divide-border">
                    {grouped[type].map((c) => (
                      <li key={c.id} className="flex items-center gap-3 py-2.5">
                        <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                        <span className="flex-1 truncate font-medium">{c.name}</span>
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
                      </li>
                    ))}
                  </ul>
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
