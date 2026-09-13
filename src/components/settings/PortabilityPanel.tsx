import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Field } from '@/components/ui/Field';
import { MonthSelector } from '@/components/MonthSelector';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useCategories } from '@/hooks/useCategories';
import { useSavingsAccounts } from '@/hooks/useSavingsAccounts';
import { usePrivacy, PRIVACY_KEYS } from '@/contexts/privacy';
import { getUserBackup, importBankTransactions } from '@/services/portability.service';
import { mapDbError } from '@/lib/errors';
import {
  createExcel,
  downloadFile,
  exportTables,
  markBankDuplicates,
  parseBankRows,
  parseCsv,
  toCsv,
  type BankMapping,
} from '@/utils/portability';
import { getCurrentMonthYear, todayISO } from '@/utils/date';
import { formatCurrency } from '@/utils/format';
import type { BankImportRow } from '@/types/models';

export function PortabilityPanel() {
  const [month, setMonth] = useState(getCurrentMonthYear);
  const [allMonths, setAllMonths] = useState(false);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [accountId, setAccountId] = useState('');
  const [source, setSource] = useState('');
  const [filename, setFilename] = useState('');
  const [delimiter, setDelimiter] = useState(',');
  const [mapping, setMapping] = useState<BankMapping>({
    date: 0,
    description: 1,
    amount: 2,
    dateFormat: 'ISO',
    decimal: '.',
  });
  const [rows, setRows] = useState<BankImportRow[]>([]);
  const [confirming, setConfirming] = useState(false);
  const { categories, error: categoryError, loading: categoriesLoading } = useCategories();
  const { accounts, error: accountError, loading: accountsLoading, refresh } = useSavingsAccounts();
  const { isHidden } = usePrivacy();
  const selected = rows.filter((row) => row.selected);
  let csv: string[][] = [],
    csvError = '';
  if (source) {
    try {
      csv = parseCsv(source, delimiter);
    } catch (error) {
      csvError = error instanceof Error ? error.message : 'CSV inválido';
    }
  }

  const run = async (action: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(mapDbError(error, 'No se pudo completar la operación.'));
    } finally {
      working.current = false;
      setBusy(false);
    }
  };

  const exportData = (format: 'csv' | 'excel' | 'report' | 'backup') =>
    run(async () => {
      const backup = await getUserBackup();
      if (format === 'backup') {
        downloadFile(
          JSON.stringify(backup, null, 2),
          `gasti-respaldo-${todayISO()}.json`,
          'application/json;charset=utf-8',
        );
      } else {
        const period = format === 'report' || !allMonths ? month : undefined;
        const suffix = period ? `${period.year}-${String(period.month).padStart(2, '0')}` : 'todos';
        const data = exportTables(backup, period);
        if (format === 'csv')
          downloadFile(
            toCsv(data.movements),
            `gasti-movimientos-${suffix}.csv`,
            'text/csv;charset=utf-8',
          );
        else {
          const sheets =
            format === 'report'
              ? [
                  { name: 'Resumen mensual', rows: data.summary },
                  { name: 'Categorías', rows: data.breakdown },
                  { name: 'Movimientos', rows: data.movements },
                ]
              : [{ name: 'Movimientos', rows: data.movements }];
          downloadFile(
            await createExcel(sheets),
            `gasti-${format === 'report' ? 'reporte' : 'movimientos'}-${suffix}.xlsx`,
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          );
        }
      }
      toast.success('Archivo preparado para descargar');
    });

  const preview = () =>
    run(async () => {
      setRows([]);
      if (!accounts.some((account) => account.id === accountId))
        throw new Error('Selecciona una cuenta');
      if (
        new Set([mapping.date, mapping.description, mapping.amount]).size !== 3 ||
        [mapping.date, mapping.description, mapping.amount].some(
          (index) => index < 0 || index >= csv[0].length,
        )
      )
        throw new Error('Selecciona una columna diferente para cada campo');
      const backup = await getUserBackup();
      const parsed = markBankDuplicates(
        parseBankRows(csv, mapping),
        backup.tables.transactions,
        accountId,
      );
      setRows(parsed);
    });

  const changeMapping = (value: Partial<BankMapping>) => {
    setMapping((current) => ({ ...current, ...value }));
    setRows([]);
  };
  const updateRow = (id: string, value: Partial<BankImportRow>) =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...value } : row)));
  const confirmImport = () =>
    run(async () => {
      const result = await importBankTransactions(accountId, rows);
      setRows([]);
      setSource('');
      setFilename('');
      toast.success(
        `${result.inserted} movimientos importados; ${result.skipped} duplicados o reintentos omitidos.`,
      );
      await refresh();
    });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Exportación y respaldo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Descarga tus movimientos o un reporte mensual con ingresos, gastos y categorías
            separados por moneda. Los archivos incluyen los importes completos, aunque estén ocultos
            en pantalla.
          </p>
          <MonthSelector
            value={month}
            onChange={(value) => {
              if (!busy) setMonth(value);
            }}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allMonths}
              disabled={busy}
              onChange={(event) => setAllMonths(event.target.checked)}
            />{' '}
            Exportar movimientos de todos los meses
          </label>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={() => void exportData('csv')}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void exportData('excel')}>
              <Download className="h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void exportData('report')}>
              <Download className="h-4 w-4" /> Reporte del mes (Excel)
            </Button>
          </div>
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              El respaldo JSON incluye todos tus datos de Gasti: cuentas, movimientos, categorías,
              presupuestos, deudas, metas, recurrencias y cierres. Conserva sus relaciones para una
              recuperación técnica; no incluye contraseñas ni preferencias de este navegador. La
              restauración automática no está disponible.
            </p>
            <Button variant="outline" disabled={busy} onClick={() => void exportData('backup')}>
              <Download className="h-4 w-4" /> Descargar respaldo completo
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Importar movimientos bancarios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Carga un CSV de una cuenta en lempiras. Usa montos positivos para ingresos y negativos
            para gastos. Excluye transferencias, préstamos y pagos de tarjeta: regístralos en sus
            formularios para conservar sus vínculos.
          </p>
          {(categoryError || accountError) && (
            <p role="alert" className="text-sm text-expense">
              {categoryError || accountError}
            </p>
          )}
          <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cuenta bancaria (HNL)" htmlFor="import-account">
                <Select
                  id="import-account"
                  value={accountId}
                  onChange={(event) => {
                    setAccountId(event.target.value);
                    setRows([]);
                  }}
                >
                  <option value="">Selecciona una cuenta</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Archivo CSV (UTF-8, máximo 2 MB)" htmlFor="bank-file">
                <Input
                  id="bank-file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    setRows([]);
                    setSource('');
                    setFilename('');
                    if (!file) return;
                    void run(async () => {
                      if (file.size > 2 * 1024 * 1024)
                        throw new Error('El archivo supera los 2 MB');
                      const text = await file.text();
                      if (text.includes('\uFFFD') || text.includes('\0'))
                        throw new Error('Guarda el archivo como CSV UTF-8');
                      setSource(text);
                      setFilename(file.name);
                    });
                  }}
                />
              </Field>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                downloadFile(
                  toCsv([
                    ['Fecha', 'Descripción', 'Monto'],
                    ['2026-09-01', 'Salario', 15000],
                    ['2026-09-02', 'Supermercado', -850.5],
                  ]),
                  'plantilla-bancaria.csv',
                  'text/csv;charset=utf-8',
                )
              }
            >
              Descargar plantilla CSV
            </Button>
            {source && (
              <>
                <p className="text-sm">Archivo: {filename}</p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Separador" htmlFor="bank-delimiter">
                    <Select
                      id="bank-delimiter"
                      value={delimiter}
                      onChange={(event) => {
                        setDelimiter(event.target.value);
                        setRows([]);
                      }}
                    >
                      <option value=",">Coma</option>
                      <option value=";">Punto y coma</option>
                      <option value={'\t'}>Tabulación</option>
                    </Select>
                  </Field>
                  <Field label="Formato de fecha" htmlFor="bank-date-format">
                    <Select
                      id="bank-date-format"
                      value={mapping.dateFormat}
                      onChange={(event) =>
                        changeMapping({
                          dateFormat: event.target.value as BankMapping['dateFormat'],
                        })
                      }
                    >
                      <option value="ISO">AAAA-MM-DD</option>
                      <option value="DMY">DD/MM/AAAA</option>
                      <option value="MDY">MM/DD/AAAA</option>
                    </Select>
                  </Field>
                  <Field label="Separador decimal" htmlFor="bank-decimal">
                    <Select
                      id="bank-decimal"
                      value={mapping.decimal}
                      onChange={(event) =>
                        changeMapping({ decimal: event.target.value as '.' | ',' })
                      }
                    >
                      <option value=".">Punto: 1,234.56</option>
                      <option value=",">Coma: 1.234,56</option>
                    </Select>
                  </Field>
                </div>
                {csvError ? (
                  <p role="alert" className="text-sm text-expense">
                    {csvError}
                  </p>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-3">
                      {(
                        [
                          { key: 'date', label: 'Columna de fecha' },
                          { key: 'description', label: 'Columna de descripción' },
                          { key: 'amount', label: 'Columna de monto con signo' },
                        ] as const
                      ).map(({ key, label }) => (
                        <Field key={key} label={label} htmlFor={`bank-${key}`}>
                          <Select
                            id={`bank-${key}`}
                            value={mapping[key]}
                            onChange={(event) =>
                              changeMapping({ [key]: Number(event.target.value) })
                            }
                          >
                            {csv[0].map((name, index) => (
                              <option key={index} value={index}>
                                {index + 1}. {name}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      disabled={
                        !accountId ||
                        categoriesLoading ||
                        accountsLoading ||
                        !!categoryError ||
                        !!accountError
                      }
                      onClick={() => void preview()}
                    >
                      <Upload className="h-4 w-4" /> Preparar vista previa
                    </Button>
                  </>
                )}
              </>
            )}
            {rows.length > 0 && (
              <>
                <p className="text-sm">
                  {rows.length} filas: {selected.length} seleccionadas,{' '}
                  {rows.filter((row) => row.duplicate).length} posibles duplicados y{' '}
                  {rows.filter((row) => row.error).length} inválidas. Asigna categorías antes de
                  confirmar. Seleccionar un posible duplicado autoriza importarlo.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {(['INCOME', 'EXPENSE'] as const).map((type) => (
                    <Field
                      key={type}
                      label={
                        type === 'INCOME'
                          ? 'Categoría para todos los ingresos'
                          : 'Categoría para todos los gastos'
                      }
                      htmlFor={`bulk-${type}`}
                    >
                      <Select
                        id={`bulk-${type}`}
                        value=""
                        onChange={(event) => {
                          const categoryId = event.target.value;
                          if (categoryId)
                            setRows((current) =>
                              current.map((row) =>
                                row.type === type ? { ...row, category_id: categoryId } : row,
                              ),
                            );
                        }}
                      >
                        <option value="">Asignar categoría…</option>
                        {categories
                          .filter((category) => category.type === type)
                          .map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                      </Select>
                    </Field>
                  ))}
                </div>
                <div className="max-h-96 overflow-auto rounded-md border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        {[
                          'Importar',
                          'Fecha',
                          'Descripción',
                          'Monto HNL',
                          'Categoría',
                          'Revisión',
                        ].map((label) => (
                          <th key={label} className="p-3">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id} className="border-t border-border">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              aria-label={`Importar fila ${row.line}`}
                              checked={row.selected}
                              disabled={!!row.error}
                              onChange={(event) =>
                                updateRow(row.id, { selected: event.target.checked })
                              }
                            />
                          </td>
                          <td className="whitespace-nowrap p-3">{row.transaction_date || '—'}</td>
                          <td className="min-w-40 p-3">{row.description}</td>
                          <td className="whitespace-nowrap p-3">
                            {row.type === 'INCOME' ? 'Ingreso' : 'Gasto'}
                            <br />
                            {isHidden(PRIVACY_KEYS.account(accountId)) ||
                            (row.type === 'INCOME' && isHidden(PRIVACY_KEYS.income))
                              ? '••••'
                              : formatCurrency(row.amount)}
                          </td>
                          <td className="min-w-48 p-3">
                            <Select
                              aria-label={`Categoría de fila ${row.line}`}
                              value={row.category_id}
                              disabled={!!row.error}
                              onChange={(event) =>
                                updateRow(row.id, { category_id: event.target.value })
                              }
                            >
                              <option value="">Selecciona categoría</option>
                              {categories
                                .filter((category) => category.type === row.type)
                                .map((category) => (
                                  <option key={category.id} value={category.id}>
                                    {category.name}
                                  </option>
                                ))}
                            </Select>
                          </td>
                          <td className="min-w-40 p-3">
                            {row.error || (row.duplicate ? 'Posible duplicado' : 'Nuevo')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button
                  disabled={
                    selected.length === 0 || selected.some((row) => row.error || !row.category_id)
                  }
                  onClick={() => setConfirming(true)}
                >
                  Importar {selected.length} movimientos
                </Button>
              </>
            )}
          </fieldset>
          {busy && (
            <p role="status" className="text-sm text-muted-foreground">
              Procesando…
            </p>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={confirming}
        title="Confirmar importación"
        description={`Se registrarán hasta ${selected.length} movimientos en ${accounts.find((account) => account.id === accountId)?.name ?? 'la cuenta'}. Afectarán el saldo, los ingresos o gastos y los presupuestos. ${selected.filter((row) => row.duplicate).length} posibles duplicados seleccionados expresamente.`}
        confirmLabel="Confirmar importación"
        danger={false}
        onConfirm={confirmImport}
        onClose={() => setConfirming(false)}
      />
    </>
  );
}
