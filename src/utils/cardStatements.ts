/** Día mensual ajustado al último día de los meses cortos. */
export function cardStatementDate(month: string, day: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return `${month}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}
