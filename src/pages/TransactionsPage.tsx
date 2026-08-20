import { useMemo, useState } from 'react';
import { Plus, Receipt, Search, SlidersHorizontal, X } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { MonthSelector } from '@/components/MonthSelector';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { TransactionList } from '@/components/transactions/TransactionList';
import { useCategories } from '@/hooks/useCategories';
import { useTransactions } from '@/hooks/useTransactions';
import { useCreditCards } from '@/hooks/useCreditCards';
import { useSavingsAccounts } from '@/hooks/useSavingsAccounts';
import { monthlySummary } from '@/utils/finance';
import { formatCurrency } from '@/utils/format';
import { getCurrentMonthYear, monthRange } from '@/utils/date';
import { cn } from '@/lib/utils';
import type { TransactionType, TransactionWithCategory } from '@/types/models';
import type { TransactionInput } from '@/lib/validations';

type TypeFilter = 'ALL' | TransactionType;

export default function TransactionsPage() {
  const [month, setMonth] = useState(getCurrentMonthYear);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionWithCategory | null>(null);
  const [deleting, setDeleting] = useState<TransactionWithCategory | null>(null);

  const { categories } = useCategories();
  const { cards } = useCreditCards();
  const { accounts } = useSavingsAccounts();

  const range = useMemo(() => monthRange(month.year, month.month), [month]);
  const filters = useMemo(() => ({ dateStart: range.start, dateEnd: range.end }), [range]);
  const { transactions, loading, create, update, remove } = useTransactions(filters);

  const summary = useMemo(() => monthlySummary(transactions), [transactions]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = minAmount ? Number(minAmount) : null;
    const max = maxAmount ? Number(maxAmount) : null;
    return transactions.filter((t) => {
      if (typeFilter !== 'ALL' && t.type !== typeFilter) return false;
      if (categoryFilter !== 'ALL') {
        if (categoryFilter === 'NONE' ? t.category_id !== null : t.category_id !== categoryFilter)
          return false;
      }
      if (min !== null && t.amount < min) return false;
      if (max !== null && t.amount > max) return false;
      if (q) {
        const haystack = `${t.description} ${t.category?.name ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, typeFilter, categoryFilter, minAmount, maxAmount, search]);

  const hasActiveFilters =
    categoryFilter !== 'ALL' || minAmount !== '' || maxAmount !== '' || typeFilter !== 'ALL';

  const clearFilters = () => {
    setTypeFilter('ALL');
    setCategoryFilter('ALL');
    setMinAmount('');
    setMaxAmount('');
    setSearch('');
  };

  const categoryOptions = useMemo(() => {
    if (typeFilter === 'INCOME') return categories.filter((c) => c.type === 'INCOME');
    if (typeFilter === 'EXPENSE') return categories.filter((c) => c.type === 'EXPENSE');
    return categories;
  }, [categories, typeFilter]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (t: TransactionWithCategory) => {
    setEditing(t);
    setFormOpen(true);
  };

  const handleSubmit = async (input: TransactionInput) => {
    if (editing) {
      await update(editing.id, input);
      toast.success('Transacción actualizada');
    } else {
      await create(input);
      toast.success('Transacción agregada');
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await remove(deleting.id);
      toast.success('Transacción eliminada');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar');
    }
  };

  const filterChips: { value: TypeFilter; label: string }[] = [
    { value: 'ALL', label: 'Todas' },
    { value: 'EXPENSE', label: 'Gastos' },
    { value: 'INCOME', label: 'Ingresos' },
    { value: 'SAVING', label: 'Ahorro' },
  ];

  return (
    <>
      <PageHeader
        title="Transacciones"
        description="Registra y gestiona tus ingresos y gastos"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nueva
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-4">
        <MonthSelector value={month} onChange={setMonth} />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryPill label="Ingresos" value={summary.income} tone="income" />
          <SummaryPill label="Gastos" value={summary.expense} tone="expense" />
          <SummaryPill label="Ahorro" value={summary.saving} tone="saving" />
          <SummaryPill label="Disponible" value={summary.balance} tone="neutral" />
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {filterChips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => setTypeFilter(chip.value)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                typeFilter === chip.value
                  ? 'border-primary bg-accent text-accent-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-64 sm:flex-none">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant={showFilters || hasActiveFilters ? 'secondary' : 'outline'}
            size="icon"
            onClick={() => setShowFilters((v) => !v)}
            aria-label="Filtros avanzados"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card className="mb-4">
          <CardContent className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-muted-foreground">Categoría</label>
              <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="ALL">Todas</option>
                <option value="NONE">Sin categoría</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Monto mín.</label>
              <Input
                type="number"
                min="0"
                inputMode="decimal"
                placeholder="0"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Monto máx.</label>
              <Input
                type="number"
                min="0"
                inputMode="decimal"
                placeholder="—"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
              />
            </div>
            {hasActiveFilters && (
              <div className="sm:col-span-4">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4" /> Limpiar filtros
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Sin transacciones"
              description="No hay movimientos que coincidan con este mes o filtro."
              action={
                <Button variant="outline" onClick={openCreate}>
                  <Plus className="h-4 w-4" /> Agregar la primera
                </Button>
              }
            />
          ) : (
            <TransactionList transactions={visible} onEdit={openEdit} onDelete={setDeleting} />
          )}
        </CardContent>
      </Card>

      <TransactionForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        categories={categories}
        creditCards={cards.filter((c) => c.currency === 'HNL')}
        savingsAccounts={accounts}
        initial={editing}
        defaultType={typeFilter === 'INCOME' || typeFilter === 'SAVING' ? typeFilter : 'EXPENSE'}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar transacción"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'income' | 'expense' | 'saving' | 'neutral';
}) {
  const toneClass =
    tone === 'income'
      ? 'text-income'
      : tone === 'expense'
        ? 'text-expense'
        : tone === 'saving'
          ? 'text-primary'
          : 'text-foreground';
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 text-lg font-semibold tabular-nums', toneClass)}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}
