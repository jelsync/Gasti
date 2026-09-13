import { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { mapDbError } from '@/lib/errors';
import {
  confirmCardStatement,
  getCardStatements,
  previewCardStatement,
  type CardStatementPreview,
} from '@/services/cardStatements.service';
import type { CardStatement, CreditCardWithBalance } from '@/types/models';
import { cardStatementDate } from '@/utils/cardStatements';
import { formatDate, todayISO } from '@/utils/date';
import { formatMoney } from '@/utils/format';

interface Props {
  card: CreditCardWithBalance;
  requestedDate?: string | null;
  onConfigure: () => void;
}

export function CardStatementsPanel({ card, requestedDate, onConfigure }: Props) {
  const [month, setMonth] = useState(requestedDate?.slice(0, 7) || todayISO().slice(0, 7));
  const [statements, setStatements] = useState<CardStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CardStatementPreview | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checked, setChecked] = useState(false);
  const date = card.statement_day && month ? cardStatementDate(month, card.statement_day) : null;
  const savedPreview = statements.find((item) => item.statement_date === preview?.statement_date);

  useEffect(() => {
    let cancelled = false;
    getCardStatements(card.id).then(
      (rows) => {
        if (!cancelled) {
          setStatements(rows);
          setLoading(false);
        }
      },
      (err: unknown) => {
        if (!cancelled) {
          setError(mapDbError(err));
          setLoading(false);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [card.id]);

  useEffect(() => {
    if (!requestedDate) return;
    let cancelled = false;
    previewCardStatement(card.id, requestedDate).then(
      (snapshot) => {
        if (!cancelled) setPreview(snapshot);
      },
      (err: unknown) => {
        if (!cancelled) setError(mapDbError(err));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [card.id, requestedDate]);

  const review = async (statementDate: string) => {
    setReviewing(true);
    setChecked(false);
    setError(null);
    try {
      setPreview(await previewCardStatement(card.id, statementDate));
    } catch (err) {
      setError(mapDbError(err, 'No se pudo revisar el corte.'));
    } finally {
      setReviewing(false);
    }
  };

  const confirm = async () => {
    if (!preview || !checked) return;
    setSaving(true);
    try {
      const saved = await confirmCardStatement(preview);
      setStatements((rows) =>
        [saved, ...rows.filter((row) => row.id !== saved.id)].sort((a, b) =>
          b.statement_date.localeCompare(a.statement_date),
        ),
      );
      setPreview(null);
      setChecked(false);
      toast.success(savedPreview ? 'Corte actualizado' : 'Corte confirmado');
    } catch (err) {
      toast.error(mapDbError(err, 'No se pudo confirmar el corte.'));
      setChecked(false);
      // Obliga a revisar otra vez si los movimientos cambiaron durante la revisión.
      setPreview(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card id="cortes">
      <CardHeader>
        <CardTitle>Cortes de {card.name}</CardTitle>
        <p className="text-sm text-muted-foreground">
          El corte se confirma manualmente después de registrar y revisar todas las compras de ese
          día. Puedes actualizarlo si registras una compra después con fecha del período cerrado.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {card.statement_day ? (
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Mes del corte" htmlFor={`statement-month-${card.id}`}>
              <Input
                id={`statement-month-${card.id}`}
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              />
            </Field>
            <Button
              variant="outline"
              loading={reviewing}
              disabled={!date}
              onClick={() => {
                if (date) void review(date);
              }}
            >
              <ClipboardCheck className="h-4 w-4" /> Revisar corte
            </Button>
            {date && (
              <p className="pb-2 text-sm text-muted-foreground">
                Hasta el {formatDate(date)}, inclusive
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Configura el día de corte para recibir el recordatorio en el calendario.
            </p>
            <Button variant="outline" onClick={onConfigure}>
              Configurar fechas
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Este resumen guarda el saldo al corte por moneda. Confirmarlo no registra pagos ni cambia
          la deuda o el presupuesto. Las compras con fecha posterior pertenecen al siguiente
          período.
        </p>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {loading ? (
          <Spinner />
        ) : statements.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no has confirmado cortes.</p>
        ) : (
          <ul className="divide-y divide-border">
            {statements.map((statement) => (
              <li
                key={statement.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-income" /> Corte del{' '}
                    {formatDate(statement.statement_date)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(statement.period_start)} al {formatDate(statement.statement_date)} ·
                    Confirmado el {new Date(statement.confirmed_at).toLocaleDateString('es-HN')}
                  </p>
                  <p className="mt-1 text-sm tabular-nums">
                    {formatMoney(statement.balance_hnl, 'HNL')} ·{' '}
                    {formatMoney(statement.balance_usd, 'USD')}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={reviewing}
                  onClick={() => void review(statement.statement_date)}
                >
                  Revisar / actualizar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <Modal
        open={!!preview}
        onClose={() => {
          if (!saving) setPreview(null);
        }}
        title={`${savedPreview ? 'Actualizar' : 'Confirmar'} corte de ${card.name}`}
      >
        {preview && (
          <div className="space-y-4">
            <p className="text-sm">
              Del {formatDate(preview.period_start)} al {formatDate(preview.statement_date)},
              incluyendo las compras y pagos del día de corte.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 text-left">Resumen</th>
                    <th className="py-2 text-right">HNL</th>
                    <th className="py-2 text-right">USD</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ['Saldo al iniciar el período', preview.opening_hnl, preview.opening_usd],
                      ['Compras del período (+)', preview.charges_hnl, preview.charges_usd],
                      ['Pagos del período (−)', preview.payments_hnl, preview.payments_usd],
                      ['Saldo al corte', preview.balance_hnl, preview.balance_usd],
                    ] as const
                  ).map(([label, hnl, usd]) => (
                    <tr key={label} className="border-b border-border last:font-semibold">
                      <td className="py-2 pr-2">{label}</td>
                      <td className="py-2 text-right">{formatMoney(hnl, 'HNL')}</td>
                      <td className="py-2 pl-3 text-right">{formatMoney(usd, 'USD')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {savedPreview && (
              <p className="text-xs text-muted-foreground">
                El resumen guardado mostraba {formatMoney(savedPreview.balance_hnl, 'HNL')} y{' '}
                {formatMoney(savedPreview.balance_usd, 'USD')}. Al actualizarlo se reemplazará por
                los importes revisados.
              </p>
            )}
            {preview.statement_date > todayISO() ? (
              <p className="text-sm text-muted-foreground">
                Podrás confirmar este corte a partir del {formatDate(preview.statement_date)},
                después de revisar las compras de ese día.
              </p>
            ) : (
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={checked}
                  onChange={(event) => setChecked(event.target.checked)}
                />
                Ya registré y revisé todas las compras y pagos hasta el día de corte inclusive.
              </label>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="outline" disabled={saving} onClick={() => setPreview(null)}>
                Volver
              </Button>
              <Button
                loading={saving}
                disabled={!checked || preview.statement_date > todayISO()}
                onClick={() => void confirm()}
              >
                {savedPreview ? 'Actualizar corte' : 'Confirmar corte'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}
