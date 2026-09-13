import type { BankImportRow, UserBackup } from '@/types/models';
import { monthlySummary } from '@/utils/finance';
import { monthRange, type MonthYear } from '@/utils/date';

export type ExportCell = string | number;

/** CSV con comillas, saltos de línea y protección frente a fórmulas de hojas de cálculo. */
export function toCsv(rows: ExportCell[][]): string {
  return (
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((value) => {
            const text =
              typeof value === 'string' && /^[\s]*[=+\-@]/.test(value)
                ? `'${value}`
                : String(value);
            return `"${text.replaceAll('"', '""')}"`;
          })
          .join(','),
      )
      .join('\r\n')
  );
}

export function parseCsv(source: string, delimiter: string): string[][] {
  const text = source.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false,
    closed = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
        closed = true;
      } else cell += char;
    } else if (char === delimiter || char === '\n' || char === '\r') {
      row.push(cell);
      cell = '';
      closed = false;
      if (char !== delimiter) {
        if (row.some((value) => value.trim())) rows.push(row);
        row = [];
        if (char === '\r' && text[i + 1] === '\n') i++;
      }
    } else if (char === '"' && !cell && !closed) quoted = true;
    else {
      if (closed || char === '"') throw new Error('El CSV contiene comillas mal cerradas.');
      cell += char;
    }
  }
  if (quoted) throw new Error('El CSV contiene comillas sin cerrar.');
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  if (rows.length < 2) throw new Error('El archivo debe contener encabezados y movimientos.');
  if (rows.length > 1001) throw new Error('Importa como máximo 1000 movimientos por archivo.');
  if (rows.some((values) => values.length !== rows[0].length))
    throw new Error('Hay filas con diferente número de columnas. Revisa el separador.');
  return rows;
}

export interface BankMapping {
  date: number;
  description: number;
  amount: number;
  dateFormat: 'ISO' | 'DMY' | 'MDY';
  decimal: '.' | ',';
}

export function parseBankRows(rows: string[][], mapping: BankMapping): BankImportRow[] {
  return rows.slice(1).map((cells, index) => {
    const result: BankImportRow = {
      id: crypto.randomUUID(),
      line: index + 2,
      transaction_date: '',
      description: cells[mapping.description]?.trim() ?? '',
      amount: 0,
      type: 'EXPENSE',
      category_id: '',
      selected: true,
      duplicate: false,
      error: '',
    };
    try {
      const rawDate = cells[mapping.date]?.trim() ?? '';
      let iso = rawDate;
      if (mapping.dateFormat !== 'ISO') {
        const match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(rawDate);
        if (!match) throw new Error('Fecha inválida');
        const [, first, second, year] = match;
        iso = `${year}-${(mapping.dateFormat === 'DMY' ? second : first).padStart(2, '0')}-${(mapping.dateFormat === 'DMY' ? first : second).padStart(2, '0')}`;
      }
      const date = new Date(`${iso}T00:00:00Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(iso) ||
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== iso
      )
        throw new Error('Fecha inválida');
      result.transaction_date = iso;
      const rawAmount = cells[mapping.amount]?.trim() ?? '';
      const pattern =
        mapping.decimal === '.'
          ? /^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/
          : /^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/;
      if (!pattern.test(rawAmount)) throw new Error('Monto inválido; revisa el separador decimal');
      const amount = Number(
        mapping.decimal === '.'
          ? rawAmount.replaceAll(',', '')
          : rawAmount.replaceAll('.', '').replace(',', '.'),
      );
      if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 9_999_999_999)
        throw new Error('Monto fuera de rango');
      result.amount = Math.abs(amount);
      result.type = amount > 0 ? 'INCOME' : 'EXPENSE';
      if (result.description.length > 200) throw new Error('Descripción de más de 200 caracteres');
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Fila inválida';
      result.selected = false;
    }
    return result;
  });
}

/** Coincidencia amplia: fecha, monto, moneda y sentido del movimiento en la cuenta. */
export function markBankDuplicates(
  rows: BankImportRow[],
  transactions: UserBackup['tables']['transactions'],
  accountId: string,
): BankImportRow[] {
  const key = (date: string, amount: number, type: string) =>
    `${date}:${amount.toFixed(2)}:${type}`;
  const seen = new Set<string>();
  for (const tx of transactions) {
    if (tx.currency !== 'HNL') continue;
    if (tx.savings_account_id === accountId)
      seen.add(
        key(
          tx.transaction_date,
          tx.amount,
          tx.type === 'EXPENSE' || tx.type === 'TRANSFER' ? 'EXPENSE' : 'INCOME',
        ),
      );
    if (tx.destination_savings_account_id === accountId)
      seen.add(key(tx.transaction_date, tx.amount, 'INCOME'));
  }
  return rows.map((row) => {
    if (row.error) return row;
    const identity = key(row.transaction_date, row.amount, row.type);
    const duplicate = seen.has(identity);
    seen.add(identity);
    return { ...row, duplicate, selected: !duplicate };
  });
}

export function exportTables(backup: UserBackup, month?: MonthYear) {
  const range = month ? monthRange(month.year, month.month) : null;
  const transactions = backup.tables.transactions
    .filter(
      (row) => !range || (row.transaction_date >= range.start && row.transaction_date <= range.end),
    )
    .sort(
      (a, b) => a.transaction_date.localeCompare(b.transaction_date) || a.id.localeCompare(b.id),
    );
  const names = (table: { id: string; name: string }[]) =>
    new Map(table.map((row) => [row.id, row.name]));
  const categories = names(backup.tables.categories),
    accounts = names(backup.tables.savings_accounts),
    cards = names(backup.tables.credit_cards);
  const types = {
    INCOME: 'Ingreso',
    EXPENSE: 'Gasto',
    SAVING: 'Ahorro',
    TRANSFER: 'Transferencia',
  };
  const movements: ExportCell[][] = [
    [
      'ID',
      'Fecha',
      'Tipo',
      'Descripción',
      'Categoría',
      'Monto',
      'Moneda',
      'Cuenta origen / depósito',
      'Cuenta destino',
      'Tarjeta',
    ],
  ];
  for (const tx of transactions)
    movements.push([
      tx.id,
      tx.transaction_date,
      types[tx.type],
      tx.description,
      categories.get(tx.category_id ?? '') ?? '',
      tx.amount,
      tx.currency,
      accounts.get(tx.savings_account_id ?? '') ?? '',
      accounts.get(tx.destination_savings_account_id ?? '') ?? '',
      cards.get(tx.credit_card_id ?? '') ?? '',
    ]);
  const summary: ExportCell[][] = [['Moneda', 'Ingresos', 'Gastos', 'Balance (ingresos − gastos)']];
  for (const currency of ['HNL', 'USD'] as const) {
    const totals = monthlySummary(transactions, currency);
    summary.push([currency, totals.income, totals.expense, totals.balance]);
  }
  const grouped = new Map<
    string,
    { currency: string; type: string; name: string; cents: number }
  >();
  for (const tx of transactions) {
    if (tx.type !== 'INCOME' && tx.type !== 'EXPENSE') continue;
    const key = `${tx.currency}:${tx.type}:${tx.category_id}`;
    const entry = grouped.get(key) ?? {
      currency: tx.currency,
      type: types[tx.type],
      name: categories.get(tx.category_id ?? '') ?? 'Sin categoría',
      cents: 0,
    };
    entry.cents += Math.round(tx.amount * 100);
    grouped.set(key, entry);
  }
  const breakdown: ExportCell[][] = [
    ['Moneda', 'Tipo', 'Categoría', 'Total'],
    ...Array.from(grouped.values(), (row) => [row.currency, row.type, row.name, row.cents / 100]),
  ];
  return { movements, summary, breakdown };
}

export function downloadFile(content: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function createExcel(
  sheets: { name: string; rows: ExportCell[][] }[],
): Promise<Uint8Array<ArrayBuffer>> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Gasti';
  for (const { name, rows } of sheets) {
    const sheet = workbook.addWorksheet(name);
    sheet.addRows(rows);
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
    sheet.columns.forEach((column, index) => {
      column.width = Math.min(48, Math.max(16, String(rows[0][index]).length + 3));
    });
    sheet.eachRow((row, index) => {
      if (index > 1)
        row.eachCell((cell) => {
          if (typeof cell.value === 'number') cell.numFmt = '#,##0.00';
        });
    });
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(rows.length, 1), column: rows[0].length },
    };
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
