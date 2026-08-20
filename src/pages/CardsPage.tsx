import { useMemo, useState } from 'react';
import { Banknote, CreditCard as CardIcon, Pencil, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CreditCardForm } from '@/components/cards/CreditCardForm';
import { CardPaymentModal, type CardPaymentArgs } from '@/components/cards/CardPaymentModal';
import { CardChargeModal } from '@/components/cards/CardChargeModal';
import { useCreditCards } from '@/hooks/useCreditCards';
import { formatMoney, formatPercent } from '@/utils/format';
import type { CreditCardWithBalance } from '@/types/models';
import type { CardChargeInput, CreditCardInput } from '@/lib/validations';

export default function CardsPage() {
  const { cards, loading, create, update, remove, payCard, addCharge } = useCreditCards();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CreditCardWithBalance | null>(null);
  const [deleting, setDeleting] = useState<CreditCardWithBalance | null>(null);
  const [paying, setPaying] = useState<CreditCardWithBalance | null>(null);
  const [charging, setCharging] = useState<CreditCardWithBalance | null>(null);

  const totals = useMemo(() => {
    const acc = { HNL: 0, USD: 0 };
    for (const c of cards) acc[c.currency] += c.balance;
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

  const handlePay = async (args: CardPaymentArgs) => {
    if (!paying) return;
    await payCard(paying, args);
    toast.success('Pago registrado');
  };

  const handleCharge = async (input: CardChargeInput) => {
    if (!charging) return;
    await addCharge(charging.id, input);
    toast.success('Compra registrada');
  };

  return (
    <>
      <PageHeader
        title="Tarjetas de crédito"
        description="Cuánto debes en cada tarjeta"
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
                {formatMoney(totals.HNL, 'HNL')}
              </p>
              {totals.USD > 0 && (
                <p className="text-2xl font-bold tabular-nums text-expense">
                  {formatMoney(totals.USD, 'USD')}
                </p>
              )}
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            {cards.map((card) => {
              const usage =
                card.credit_limit && card.credit_limit > 0
                  ? (card.balance / card.credit_limit) * 100
                  : null;
              return (
                <Card key={card.id}>
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
                          <p className="flex items-center gap-2 truncate font-semibold">
                            {card.name}
                            {card.currency === 'USD' && (
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                USD
                              </span>
                            )}
                          </p>
                          {card.bank && (
                            <p className="truncate text-xs text-muted-foreground">{card.bank}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
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
                          onClick={() => setDeleting(card)}
                          aria-label="Eliminar"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-expense-soft hover:text-expense"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Deuda actual</p>
                      <p className="text-2xl font-bold tabular-nums">
                        {formatMoney(card.balance, card.currency)}
                      </p>
                    </div>

                    {usage !== null && (
                      <div>
                        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                          <span>Uso del límite {formatPercent(usage)}</span>
                          <span>de {formatMoney(card.credit_limit ?? 0, card.currency)}</span>
                        </div>
                        <ProgressBar value={usage} color={card.color} />
                      </div>
                    )}

                    {card.currency === 'USD' ? (
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" onClick={() => setPaying(card)}>
                          <Banknote className="h-4 w-4" /> Pago
                        </Button>
                        <Button variant="outline" onClick={() => setCharging(card)}>
                          <ShoppingCart className="h-4 w-4" /> Compra
                        </Button>
                      </div>
                    ) : (
                      <Button variant="outline" className="w-full" onClick={() => setPaying(card)}>
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

      <CreditCardForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        initial={editing}
      />

      <CardPaymentModal
        open={!!paying}
        card={paying}
        onClose={() => setPaying(null)}
        onSubmit={handlePay}
      />

      <CardChargeModal
        open={!!charging}
        card={charging}
        onClose={() => setCharging(null)}
        onSubmit={handleCharge}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar tarjeta"
        description="Se eliminará la tarjeta y sus pagos. Las transacciones quedarán sin tarjeta asignada. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
