// Utilidades de formato para Gasti.
// Moneda por defecto: Lempira hondureño (HNL), símbolo "L".

export const CURRENCY_SYMBOL = 'L';

const amountFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formatea un monto como moneda: 1250 -> "L 1,250.00".
 * Se prefija el símbolo manualmente para garantizar el formato exacto en HNL.
 */
export function formatCurrency(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${CURRENCY_SYMBOL} ${amountFormatter.format(safe)}`;
}

/** Formatea un número sin símbolo: 1250 -> "1,250.00". */
export function formatAmount(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return amountFormatter.format(safe);
}

/** Formatea un porcentaje entero: 0.75 no; recibe 75 -> "75%". */
export function formatPercent(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${Math.round(safe)}%`;
}
