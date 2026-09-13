import { describe, expect, it } from 'vitest';
import { bankImportSchema } from '@/lib/validations';
import {
  createExcel,
  exportTables,
  markBankDuplicates,
  parseBankRows,
  parseCsv,
  toCsv,
} from '@/utils/portability';
import type { UserBackup } from '@/types/models';

const mapping = { date: 0, description: 1, amount: 2, dateFormat: 'ISO', decimal: '.' } as const;
const parse = (csv: string) => parseBankRows(parseCsv(csv, ','), mapping);

describe('CSV bancario', () => {
  it('conserva BOM, comillas, delimitadores y saltos dentro de una celda', () => {
    expect(
      parseCsv(
        '\uFEFFFecha;Descripción;Monto\r\n2026-09-01;"Compra; ""especial""\nlocal";-100',
        ';',
      )[1],
    ).toEqual(['2026-09-01', 'Compra; "especial"\nlocal', '-100']);
  });
  it('rechaza archivos truncados, columnas desiguales y lotes excesivos', () => {
    expect(() => parseCsv('a,b\n"ab,2', ',')).toThrow('comillas');
    expect(() => parseCsv('a,b\n1,2,3', ',')).toThrow('columnas');
    expect(() => parseCsv('a\n' + '1\n'.repeat(1001), ',')).toThrow('1000');
  });
  it('detecta fechas imposibles y montos con precisión o separadores incorrectos', () => {
    const rows = parse(
      'Fecha,Descripción,Monto\n2026-02-30,A,10\n2026-09-01,B,0\n2026-09-01,C,1.234\n2026-09-01,D,"12,34.56"',
    );
    expect(rows.every((row) => row.error && !row.selected)).toBe(true);
  });
  it('respeta el formato explícito de fecha y decimal sin inferir montos ambiguos', () => {
    const csv = parseCsv('Fecha;Descripción;Monto\n01/02/2026;Compra;-1.234,56', ';');
    const row = parseBankRows(csv, { ...mapping, dateFormat: 'DMY', decimal: ',' })[0];
    expect(row).toMatchObject({
      transaction_date: '2026-02-01',
      amount: 1234.56,
      type: 'EXPENSE',
      error: '',
    });
    expect(
      parseBankRows(csv, { ...mapping, dateFormat: 'MDY', decimal: ',' })[0].transaction_date,
    ).toBe('2026-01-02');
  });
  it('neutraliza fórmulas de texto y conserva números negativos en la plantilla', () => {
    const csv = toCsv([
      ['Descripción', 'Monto'],
      ['  =HYPERLINK("x")', -120.5],
      ['@SUM(A1)', 1],
    ]);
    expect(parseCsv(csv, ',')[1]).toEqual(['\'  =HYPERLINK("x")', '-120.5']);
    expect(csv).toContain("'@SUM(A1)");
  });
  it('desmarca duplicados en el archivo y movimientos de cuentas, incluidas transferencias', () => {
    const rows = parse(
      'Fecha,Descripción,Monto\n2026-09-01,A,-100\n2026-09-01,B,-100\n2026-09-01,C,200\n2026-09-01,D,300',
    );
    const existing = [
      {
        transaction_date: '2026-09-01',
        amount: 200,
        currency: 'HNL',
        type: 'TRANSFER',
        destination_savings_account_id: 'a',
      },
      {
        transaction_date: '2026-09-01',
        amount: 300,
        currency: 'USD',
        type: 'INCOME',
        savings_account_id: 'a',
      },
    ] as unknown as UserBackup['tables']['transactions'];
    expect(markBankDuplicates(rows, existing, 'a').map((row) => row.selected)).toEqual([
      true,
      false,
      false,
      true,
    ]);
    expect(markBankDuplicates(rows, existing, 'b')[2].duplicate).toBe(false);
  });
  it('exige categoría, cuenta y fecha real al enviar un lote', () => {
    const row = {
      ...parse('Fecha,Descripción,Monto\n2026-09-01,A,100')[0],
      allow_duplicate: false,
    };
    expect(
      bankImportSchema.safeParse({ account_id: crypto.randomUUID(), rows: [row] }).success,
    ).toBe(false);
    expect(
      bankImportSchema.safeParse({
        account_id: crypto.randomUUID(),
        rows: [{ ...row, category_id: crypto.randomUUID() }],
      }).success,
    ).toBe(true);
    expect(
      bankImportSchema.safeParse({
        account_id: crypto.randomUUID(),
        rows: [{ ...row, category_id: crypto.randomUUID(), transaction_date: '2026-02-30' }],
      }).success,
    ).toBe(false);
  });
});

describe('Exportación y reporte mensual', () => {
  it('separa monedas, excluye transferencias del balance y filtra el mes', () => {
    const backup = {
      tables: {
        categories: [],
        savings_accounts: [],
        credit_cards: [],
        transactions: [
          {
            id: '1',
            transaction_date: '2026-09-01',
            type: 'INCOME',
            currency: 'HNL',
            amount: 100,
            description: '',
          },
          {
            id: '2',
            transaction_date: '2026-09-02',
            type: 'EXPENSE',
            currency: 'HNL',
            amount: 25,
            description: '',
          },
          {
            id: '3',
            transaction_date: '2026-09-03',
            type: 'EXPENSE',
            currency: 'USD',
            amount: 10,
            description: '',
          },
          {
            id: '4',
            transaction_date: '2026-09-04',
            type: 'TRANSFER',
            currency: 'HNL',
            amount: 80,
            description: '',
          },
          {
            id: '5',
            transaction_date: '2026-08-31',
            type: 'INCOME',
            currency: 'HNL',
            amount: 500,
            description: '',
          },
        ],
      },
    } as unknown as UserBackup;
    const result = exportTables(backup, { month: 9, year: 2026 });
    expect(result.movements).toHaveLength(5);
    expect(result.summary.slice(1)).toEqual([
      ['HNL', 100, 25, 75],
      ['USD', 0, 10, -10],
    ]);
    expect(result.breakdown).toHaveLength(4);
    expect(exportTables(backup).movements).toHaveLength(6);
  });
  it('genera un XLSX real con importes numéricos y fórmulas como texto', async () => {
    const bytes = await createExcel([
      {
        name: 'Movimientos',
        rows: [
          ['Descripción', 'Monto'],
          ['=1+1', 1234.56],
        ],
      },
    ]);
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as unknown as import('exceljs').Buffer);
    expect(workbook.worksheets[0].getCell('A2').value).toBe('=1+1');
    expect(workbook.worksheets[0].getCell('B2').value).toBe(1234.56);
  }, 60000);
});
