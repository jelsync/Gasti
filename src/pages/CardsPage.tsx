import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard as CardIcon, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CreditCardForm } from '@/components/cards/CreditCardForm';
import { CardMovementHistory } from '@/components/cards/CardMovementHistory';
import { useCreditCards } from '@/hooks/useCreditCards';
import { formatMoney, formatPercent } from '@/utils/format';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';
import type { CreditCardWithBalance } from '@/types/models';
import type { CreditCardInput } from '@/lib/validations';

export default function CardsPage() {
  const { cards, loading, create, update, remove } = useCreditCards();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CreditCardWithBalance | null>(null);
  const [deleting, setDeleting] = useState<CreditCardWithBalance | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedCardId) ?? null,
    [cards, selectedCardId],
  );

  useEffect(() => {
    if (cards.length === 0) {
      setSelectedCardId(null);
    } else if (!cards.some((card) => card.id === selectedCardId)) {
      setSelectedCardId(cards[0].id);
    }
  }, [cards, selectedCardId]);

  const totals = useMemo(() => {
    const acc = { hnl: 0, usd: 0 };
    for (const c of cards) {
      acc.hnl += c.balanceHnl;
      acc.usd += c.balanceUsd;
    }
    return acc;
  }, [cards]);

  const handleSubmit = async (input: CreditCardInput) => {
    if (editing) {
      await update(editing.id, input);
      toast.success('Tarjeta actualizada');
    } else {
      await create(input);
      toast.success('Tarjeta agregada');
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await remove(deleting.id);
      toast.success('Tarjeta eliminada');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar');
    }
  };

  return (
    <>
      <PageHeader
        title="Tarjetas de crédito"
        description="Cuánto debes en cada tarjeta (informativo)"
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

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : cards.length === 0 ? (
        <EmptyState
          icon={CardIcon}
          title="Sin tarjetas"
          description="Agrega tus tarjetas para llevar cuánto debes en cada una."
          action={
            <Button variant="outline" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> Agregar tarjeta
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Total que debes en tarjetas</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <p className="text-2xl font-bold tabular-nums text-expense">
                {formatMoney(totals.hnl, 'HNL')}
              </p>
              {totals.usd > 0 && (
                <p className="text-2xl font-bold tabular-nums text-expense">
                  {formatMoney(totals.usd, 'USD')}
                </p>
              )}
            </div>
          </Card>

          <p className="text-sm text-muted-foreground">
            Los movimientos (compras, abonos y pagos) se registran desde{' '}
            <Link to={ROUTES.transactions} className="font-medium text-primary hover:underline">
              Transacciones
            </Link>
            .
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {cards.map((card) => {
              const usageHnl =
                card.credit_limit && card.credit_limit > 0
                  ? (card.balanceHnl / card.credit_limit) * 100
                  : null;
              const usageUsd =
                card.credit_limit_usd && card.credit_limit_usd > 0
                  ? (card.balanceUsd / card.credit_limit_usd) * 100
                  : null;
              const showUsd =
                card.balanceUsd > 0 || card.opening_balance_usd > 0 || usageUsd !== null;
              return (
                <Card
                  key={card.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedCardId === card.id}
                  onClick={() => setSelectedCardId(card.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedCardId(card.id);
                    }
                  }}
                  className={cn(
                    'cursor-pointer transition-colors hover:border-primary/60',
                    selectedCardId === card.id && 'border-primary ring-1 ring-primary/30',
                  )}
                >
                  <CardContent className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
                          style={{ backgroundColor: card.color }}
                        >
                          <CardIcon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{card.name}</p>
                          {card.bank && (
                            <p className="truncate text-xs text-muted-foreground">{card.bank}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditing(card);
                            setFormOpen(true);
                          }}
                          aria-label="Editar"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleting(card);
                          }}
                          aria-label="Eliminar"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-expense-soft hover:text-expense"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Deuda en Lempiras</p>
                        <p className="text-xl font-bold tabular-nums">
                          {formatMoney(card.balanceHnl, 'HNL')}
                        </p>
                        {usageHnl !== null && (
                          <div className="mt-1.5">
                            <ProgressBar value={usageHnl} color={card.color} />
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {formatPercent(usageHnl)} de{' '}
                              {formatMoney(card.credit_limit ?? 0, 'HNL')}
                            </p>
                          </div>
                        )}
                      </div>
                      {showUsd && (
                        <div>
                          <p className="text-xs text-muted-foreground">Deuda en Dólares</p>
                          <p className="text-xl font-bold tabular-nums">
                            {formatMoney(card.balanceUsd, 'USD')}
                          </p>
                          {usageUsd !== null && (
                            <div className="mt-1.5">
                              <ProgressBar value={usageUsd} color={card.color} />
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {formatPercent(usageUsd)} de{' '}
                                {formatMoney(card.credit_limit_usd ?? 0, 'USD')}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {selectedCard && <CardMovementHistory card={selectedCard} />}
        </div>
      )}

      <CreditCardForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        initial={editing}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar tarjeta"
        description="Se eliminará la tarjeta y sus movimientos. Las transacciones quedarán sin tarjeta asignada. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
