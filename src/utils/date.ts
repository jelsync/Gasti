// Utilidades de fecha para Gasti.
// Las fechas de transacción se manejan como cadenas 'YYYY-MM-DD' (sin zona horaria)
// para evitar desfases por husos horarios.

export const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

const MONTH_ABBR = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

export interface MonthYear {
  month: number; // 1-12
  year: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Fecha de hoy en formato 'YYYY-MM-DD' (hora local). */
export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/** Mes y año actuales (mes 1-12). */
export function getCurrentMonthYear(): MonthYear {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

/** "Agosto 2026" a partir de mes (1-12) y año. */
export function formatMonthYear(month: number, year: number): string {
  const name = MONTH_NAMES[month - 1] ?? '';
  return `${name} ${year}`;
}

/** Nombre del mes (1-12). */
export function getMonthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? '';
}

/**
 * Rango de fechas 'YYYY-MM-DD' inclusivo de un mes.
 * Ej: (2026, 8) -> { start: '2026-08-01', end: '2026-08-31' }
 */
export function monthRange(year: number, month: number): { start: string; end: string } {
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${pad2(month)}-01`,
    end: `${year}-${pad2(month)}-${pad2(lastDay)}`,
  };
}

/** Formatea 'YYYY-MM-DD' como "19 ago 2026" sin desfase de zona horaria. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTH_ABBR[m - 1] ?? ''} ${y}`;
}

/** Formatea 'YYYY-MM-DD' como "19/08/2026". */
export function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${pad2(d)}/${pad2(m)}/${y}`;
}

/** Mes anterior (envuelve al año previo en enero). */
export function previousMonth({ month, year }: MonthYear): MonthYear {
  return month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
}

/** Mes siguiente (envuelve al año siguiente en diciembre). */
export function nextMonth({ month, year }: MonthYear): MonthYear {
  return month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year };
}

/** Compara dos MonthYear: negativo si a < b, 0 si iguales, positivo si a > b. */
export function compareMonthYear(a: MonthYear, b: MonthYear): number {
  return a.year - b.year || a.month - b.month;
}

/**
 * Lista de los últimos `count` meses (incluyendo el actual), del más reciente
 * al más antiguo.
 */
export function getRecentMonths(count: number, from: MonthYear = getCurrentMonthYear()): MonthYear[] {
  const result: MonthYear[] = [];
  let cursor = from;
  for (let i = 0; i < count; i += 1) {
    result.push(cursor);
    cursor = previousMonth(cursor);
  }
  return result;
}
