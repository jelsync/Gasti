import { useMemo, useState } from 'react';
import {
  CalendarCheck,
  Check,
  CirclePause,
  CirclePlay,
  Pencil,
  Plus,
  Repeat2,
  SkipForward,
  Trash2,
  Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CategoryIcon } from '@/components/CategoryIcon';
import { HIDDEN_AMOUNT, PrivacyToggle } from '@/components/ui/PrivacyToggle';
import { RecurringTransactionForm } from '@/components/recurring/RecurringTransactionForm';
import { RecurringConfirmationModal } from '@/components/recurring/RecurringConfirmationModal';
import { MonthSelector } from '@/components/MonthSelector';
import { useRecurringTransactions } from '@/hooks/useRecurringTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useSavingsAccounts } from '@/hooks/useSavingsAccounts';
import { useCreditCards } from '@/hooks/useCreditCards';
import { PRIVACY_KEYS, usePrivacy } from '@/contexts/privacy';
import { formatDate, getCurrentMonthYear, todayISO } from '@/utils/date';
import { formatMoney } from '@/utils/format';
import { ruleDueDateForMonth } from '@/utils/recurring';
import { cn } from '@/lib/utils';
import type { RecurringTransactionInput } from '@/lib/validations';
import type { RecurringTransactionWithRelations } from '@/types/models';

interface ScheduledRule {
  rule: RecurringTransactionWithRelations;
  dueDate: string;
}

export default function RecurringTransactionsPage() {
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthYear);
  const {
    rules,
    occurrences,
    loading,
    error,
    create,
    update,
    remove,
    setActive,
    confirm,
    skip,
    restoreSkipped,
  } = useRecurringTransactions(currentMonth);
  const { categories } = useCategories();
  const { accounts, refresh: refreshAccounts } = useSavingsAccounts();
  const { cards, refresh: refreshCards } = useCreditCards();
  const { isHidden } = usePrivacy();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTransactionWithRelations | null>(null);
  const [deleting, setDeleting] = useState<RecurringTransactionWithRelations | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<ScheduledRule | null>(null);

  const todayIso = todayISO();

  const scheduled = useMemo<ScheduledRule[]>(() => {
    const handled = new Set(occurrences.map((occurrence) => occurrence.recurring_transaction_id));
    return rules.flatMap((rule) => {
      if (!rule.is_active) return [];
      const dueDate = ruleDueDateForMonth(rule, currentMonth);
      if (!dueDate || handled.has(rule.id)) return [];
      return [{ rule, dueDate }];
    });
  }, [rules, occurrences, currentMonth]);

  const pending = scheduled.filter((item) => item.dueDate <= todayIso);
  const upcoming = scheduled.filter((item) => item.dueDate > todayIso);
  const skipped = occurrences
    .filter((occurrence) => occurrence.status === 'SKIPPED')
    .map((occurrence) => ({
      occurrence,
      rule: rules.find((rule) => rule.id === occurrence.recurring_transaction_id),
    }))
    .filter(
      (item): item is typeof item & { rule: RecurringTransactionWithRelations } => !!item.rule,
    );

  const handleSubmit = async (input: RecurringTransactionInput) => {
    if (editing) {
      await update(editing.id, input);
      toast.success('Movimiento recurrente actualizado');
    } else {
      await create(input);
      toast.success('Movimiento recurrente creado');
    }
  };

  const runAction = async (key: string, action: () => Promise<void>, success: string) => {
    try {
      setActionId(key);
      await action();
      toast.success(success);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo completar la acción');
    } finally {
      setActionId(null);
    }
  };

  const deleteRule = async () => {
    if (!deleting) return;
    try {
      await remove(deleting.id);
      toast.success('Movimiento recurrente eliminado');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo eliminar');
    }
  };

  return (
    <>
      <PageHeader
        title="Transacciones recurrentes"
        description="Confirma cada movimiento antes de que afecte tus saldos, tarjetas y reportes"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Nueva
          </Button>
        }
      />

      <div className="mb-5">
        <MonthSelector value={currentMonth} onChange={setCurrentMonth} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : error ? (
        <Card className="p-5 text-sm text-danger">{error}</Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Pendientes de confirmar</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Revisa si ya registraste el movimiento antes de confirmarlo u omitirlo.
                </p>
              </div>
              <span className="rounded-full bg-accent px-2.5 py-1 text-sm font-semibold text-primary">
                {pending.length}
              </span>
            </CardHeader>
            <CardContent>
              {pending.length === 0 ? (
                <EmptyState
                  icon={CalendarCheck}
                  title="Todo está al día"
                  description="No tienes movimientos recurrentes vencidos este mes."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {pending.map((item) => (
                    <ScheduledRow
                      key={item.rule.id}
                      item={item}
                      hidden={item.rule.type === 'INCOME' && isHidden(PRIVACY_KEYS.income)}
                      busy={actionId?.endsWith(item.rule.id) ?? false}
                      onConfirm={() => setConfirming(item)}
                      onSkip={() =>
                        void runAction(
                          `skip:${item.rule.id}`,
                          () => skip(item.rule.id, item.dueDate),
                          'Movimiento omitido este mes',
                        )
                      }
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {upcoming.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Próximos este mes</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border">
                  {upcoming.map((item) => (
                    <ScheduledRow
                      key={item.rule.id}
                      item={item}
                      hidden={item.rule.type === 'INCOME' && isHidden(PRIVACY_KEYS.income)}
                      busy={actionId?.endsWith(item.rule.id) ?? false}
                      onConfirm={() => setConfirming(item)}
                      onSkip={() =>
                        void runAction(
                          `skip:${item.rule.id}`,
                          () => skip(item.rule.id, item.dueDate),
                          'Movimiento omitido este mes',
                        )
                      }
                    />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {skipped.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Omitidos este mes</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border">
                  {skipped.map(({ occurrence, rule }) => (
                    <li key={occurrence.id} className="flex items-center gap-3 py-3">
                      <CategoryIcon
                        icon={rule.category?.icon ?? 'repeat-2'}
                        color={rule.category?.color ?? '#0ea5e9'}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{rule.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Omitido para {formatDate(occurrence.due_date)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={actionId === `restore:${occurrence.id}`}
                        onClick={() =>
                          void runAction(
                            `restore:${occurrence.id}`,
                            () => restoreSkipped(occurrence.id),
                            'Movimiento restaurado',
                          )
                        }
                      >
                        <Undo2 className="h-4 w-4" /> Restaurar
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {occurrences.some((occurrence) => occurrence.status === 'COMPLETED') && (
            <Card>
              <CardHeader>
                <CardTitle>Confirmados este mes</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border">
                  {occurrences
                    .filter((occurrence) => occurrence.status === 'COMPLETED')
                    .map((occurrence) => (
                      <li key={occurrence.id} className="flex items-center gap-3 py-3">
                        <Check className="h-4 w-4 shrink-0 text-income" />
                        <div>
                          <p className="font-medium">
                            {rules.find((rule) => rule.id === occurrence.recurring_transaction_id)
                              ?.name ?? 'Movimiento recurrente'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Recordatorio del {formatDate(occurrence.due_date)} atendido con una
                            transacción registrada.
                          </p>
                        </div>
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Reglas mensuales</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pausar una regla conserva su configuración y sus transacciones anteriores.
                </p>
              </div>
              {rules.some((rule) => rule.type === 'INCOME') && (
                <PrivacyToggle privacyKey={PRIVACY_KEYS.income} />
              )}
            </CardHeader>
            <CardContent>
              {rules.length === 0 ? (
                <EmptyState
                  icon={Repeat2}
                  title="Sin movimientos recurrentes"
                  description="Agrega ingresos o gastos que se repiten todos los meses."
                  action={
                    <Button variant="outline" onClick={() => setFormOpen(true)}>
                      <Plus className="h-4 w-4" /> Crear el primero
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-border">
                  {rules.map((rule) => (
                    <li
                      key={rule.id}
                      className={cn(
                        'flex items-center gap-3 py-3',
                        !rule.is_active && 'opacity-60',
                      )}
                    >
                      <CategoryIcon
                        icon={rule.category?.icon ?? 'repeat-2'}
                        color={rule.category?.color ?? '#0ea5e9'}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium">{rule.name}</p>
                          {!rule.is_active && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              Pausado
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          Día {rule.day_of_month} · {rule.category?.name ?? 'Sin categoría'} ·{' '}
                          {rule.credit_card
                            ? `Tarjeta ${rule.credit_card.name}`
                            : rule.savings_account
                              ? `Cuenta ${rule.savings_account.name}`
                              : 'Sin cuenta'}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'hidden shrink-0 font-semibold tabular-nums sm:block',
                          rule.type === 'INCOME' ? 'text-income' : 'text-expense',
                        )}
                      >
                        {rule.type === 'INCOME' && isHidden(PRIVACY_KEYS.income)
                          ? HIDDEN_AMOUNT
                          : formatMoney(rule.amount, rule.currency)}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            void runAction(
                              `active:${rule.id}`,
                              () => setActive(rule.id, !rule.is_active),
                              rule.is_active ? 'Movimiento pausado' : 'Movimiento reactivado',
                            )
                          }
                          aria-label={rule.is_active ? 'Pausar' : 'Reactivar'}
                          title={rule.is_active ? 'Pausar' : 'Reactivar'}
                          disabled={actionId === `active:${rule.id}`}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                        >
                          {rule.is_active ? (
                            <CirclePause className="h-4 w-4" />
                          ) : (
                            <CirclePlay className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(rule);
                            setFormOpen(true);
                          }}
                          aria-label="Editar"
                          title="Editar"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(rule)}
                          aria-label="Eliminar"
                          title="Eliminar"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-expense-soft hover:text-expense"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <RecurringTransactionForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        categories={categories}
        accounts={accounts}
        cards={cards}
        initial={editing}
      />

      {confirming && (
        <RecurringConfirmationModal
          key={`${confirming.rule.id}:${confirming.dueDate}`}
          rule={confirming.rule}
          dueDate={confirming.dueDate}
          onClose={() => setConfirming(null)}
          onConfirm={async (input) => {
            await confirm(confirming.rule.id, confirming.dueDate, input);
            await Promise.all([refreshAccounts(), refreshCards()]);
            toast.success(
              input.existingTransactionId
                ? 'Movimiento vinculado; recordatorio atendido'
                : 'Movimiento registrado; recordatorio atendido',
            );
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar movimiento recurrente"
        description="Se eliminará la regla, pero las transacciones que ya confirmaste se conservarán."
        confirmLabel="Eliminar"
        onConfirm={deleteRule}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}

function ScheduledRow({
  item,
  hidden,
  busy,
  onConfirm,
  onSkip,
}: {
  item: ScheduledRule;
  hidden: boolean;
  busy: boolean;
  onConfirm: () => void;
  onSkip: () => void;
}) {
  const rule = item.rule;
  const invalid =
    !rule.category_id ||
    (rule.type === 'EXPENSE' && !rule.savings_account_id && !rule.credit_card_id);

  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <CategoryIcon
          icon={rule.category?.icon ?? 'repeat-2'}
          color={rule.category?.color ?? '#0ea5e9'}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{rule.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {formatDate(item.dueDate)} · {rule.category?.name ?? 'Requiere categoría'}
            {rule.credit_card
              ? ` · Tarjeta ${rule.credit_card.name}`
              : rule.savings_account
                ? ` · Cuenta ${rule.savings_account.name}`
                : ''}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 font-semibold tabular-nums',
            rule.type === 'INCOME' ? 'text-income' : 'text-expense',
          )}
        >
          {hidden ? HIDDEN_AMOUNT : formatMoney(rule.amount, rule.currency)}
        </span>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onSkip} disabled={busy}>
          <SkipForward className="h-4 w-4" /> Omitir
        </Button>
        <Button size="sm" onClick={onConfirm} loading={busy} disabled={invalid}>
          <Check className="h-4 w-4" /> Confirmar
        </Button>
      </div>
      {invalid && (
        <span className="text-xs text-danger sm:basis-full">
          Edita esta regla para volver a seleccionar su categoría o forma de pago.
        </span>
      )}
    </li>
  );
}
