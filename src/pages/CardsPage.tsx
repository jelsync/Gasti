import { useMemo, useState } from 'react';
import { Banknote, CreditCard as CardIcon, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CreditCardForm } from '@/components/cards/CreditCardForm';
import { CardPaymentModal } from '@/components/cards/CardPaymentModal';
import { useCreditCards } from '@/hooks/useCreditCards';
import { formatCurrency, formatPercent } from '@/utils/format';
import type { CreditCardWithBalance } from '@/types/models';
import type { CreditCardInput } from '@/lib/validations';

export default function CardsPage() {
  const { cards, loading, create, update, remove, payCard } = useCreditCards();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CreditCardWithBalance | null>(null);
  const [deleting, setDeleting] = useState<CreditCardWithBalance | null>(null);
  const [paying, setPaying] = useState<CreditCardWithBalance | null>(null);

  const totalOwed = useMemo(() => cards.reduce((acc, c) => acc + c.balance, 0), [cards]);

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

  const handlePay = async (amount: number) => {
    if (!paying) return;
    await payCard(paying.id, amount);
    toast.success('Pago registrado');
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
            <p className="mt-1 text-2xl font-bold tabular-nums text-expense">
              {formatCurrency(totalOwed)}
            </p>
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
                          <p className="truncate font-semibold">{card.name}</p>
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
                        {formatCurrency(card.balance)}
                      </p>
                    </div>

                    {usage !== null && (
                      <div>
                        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                          <span>Uso del límite {formatPercent(usage)}</span>
                          <span>de {formatCurrency(card.credit_limit ?? 0)}</span>
                        </div>
                        <ProgressBar value={usage} color={card.color} />
                      </div>
                    )}

                    <Button variant="outline" className="w-full" onClick={() => setPaying(card)}>
                      <Banknote className="h-4 w-4" /> Registrar pago
                    </Button>
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
