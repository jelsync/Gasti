import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Archive,
  ArchiveRestore,
  Banknote,
  CalendarDays,
  CreditCard as CardIcon,
  Pencil,
  Plus,
  Receipt,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CreditCardForm } from '@/components/cards/CreditCardForm';
import { CardMovementHistory } from '@/components/cards/CardMovementHistory';
import { CardStatementsPanel } from '@/components/cards/CardStatementsPanel';
import { useCreditCards } from '@/hooks/useCreditCards';
import { formatMoney, formatPercent } from '@/utils/format';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';
import type { CreditCardWithBalance } from '@/types/models';
import type { CreditCardInput } from '@/lib/validations';

const cardActionLinkClass =
  'inline-flex h-9 items-center justify-center gap-2 rounded-[var(--radius)] border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export default function CardsPage() {
  const [searchParams] = useSearchParams();
  const requestedCardId = searchParams.get('card');
  const requestedStatementDate = searchParams.get('statement_date');
  const { cards, loading, create, update, setArchived, refresh } = useCreditCards();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CreditCardWithBalance | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(requestedCardId);

  useEffect(() => {
    if (requestedCardId) setSelectedCardId(requestedCardId);
  }, [requestedCardId]);

  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedCardId) ?? null,
    [cards, selectedCardId],
  );

  const activeCards = useMemo(() => cards.filter((card) => !card.is_archived), [cards]);
  const archivedCards = useMemo(() => cards.filter((card) => card.is_archived), [cards]);
  const displayCards = useMemo(
    () => [...activeCards, ...archivedCards],
    [activeCards, archivedCards],
  );

  useEffect(() => {
    if (loading) return;
    if (cards.length === 0) {
      setSelectedCardId(null);
    } else if (!cards.some((card) => card.id === selectedCardId)) {
      setSelectedCardId(activeCards[0]?.id ?? cards[0].id);
    }
  }, [cards, activeCards, selectedCardId, loading]);

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

  const handleArchive = async (card: CreditCardWithBalance, archived: boolean) => {
    try {
      await setArchived(card.id, archived);
      toast.success(
        archived ? 'Tarjeta archivada; su historial se conserva' : 'Tarjeta reactivada',
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la tarjeta');
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
            {displayCards.map((card, index) => {
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
                <Fragment key={card.id}>
                  {card.is_archived && index === activeCards.length && (
                    <div className="sm:col-span-2 mt-2">
                      <h2 className="text-base font-semibold">Tarjetas archivadas</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Conservan su historial y puedes reactivarlas cuando lo necesites.
                      </p>
                    </div>
                  )}
                  <Card
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
                      card.is_archived && 'border-dashed bg-muted/20',
                      selectedCardId === card.id && 'border-primary ring-1 ring-primary/30',
                    )}
                  >
                    <CardContent className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
                            style={{ backgroundColor: card.color }}
                          >
                            <CardIcon className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{card.name}</p>
                            {card.is_archived && (
                              <span className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                Archivada
                              </span>
                            )}
                            {card.bank && (
                              <p className="truncate text-xs text-muted-foreground">{card.bank}</p>
                            )}
                            {card.payment_due_day && (
                              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                <CalendarDays className="h-3.5 w-3.5" />
                                Pago: día {card.payment_due_day}
                              </p>
                            )}
                            {card.statement_day && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Corte manual: día {card.statement_day}
                              </p>
                            )}
                          </div>
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

                      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditing(card);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" /> Editar
                        </Button>
                        {!card.is_archived && (
                          <Link
                            to={`${ROUTES.transactions}?new=card-charge&card=${card.id}`}
                            onClick={(event) => event.stopPropagation()}
                            className={cardActionLinkClass}
                          >
                            <Receipt className="h-4 w-4" /> Registrar compra
                          </Link>
                        )}
                        <Link
                          to={`${ROUTES.transactions}?new=card-payment&card=${card.id}`}
                          onClick={(event) => event.stopPropagation()}
                          className={cardActionLinkClass}
                        >
                          <Banknote className="h-4 w-4" /> Pagar tarjeta
                        </Link>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleArchive(card, !card.is_archived);
                          }}
                        >
                          {card.is_archived ? (
                            <>
                              <ArchiveRestore className="h-4 w-4" /> Reactivar tarjeta
                            </>
                          ) : (
                            <>
                              <Archive className="h-4 w-4" /> Archivar tarjeta
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Fragment>
              );
            })}
          </div>

          {selectedCard && (
            <>
              <CardStatementsPanel
                key={`${selectedCard.id}-${requestedStatementDate ?? ''}`}
                card={selectedCard}
                requestedDate={selectedCard.id === requestedCardId ? requestedStatementDate : null}
                onConfigure={() => {
                  setEditing(selectedCard);
                  setFormOpen(true);
                }}
              />
              <CardMovementHistory card={selectedCard} onChanged={refresh} />
            </>
          )}
        </div>
      )}

      <CreditCardForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        initial={editing}
      />
    </>
  );
}
