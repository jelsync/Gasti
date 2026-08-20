import { round2 } from '@/utils/finance';
import { addMonthsToISO, todayISO } from '@/utils/date';

/** Tasa mensual a partir de la tasa anual en porcentaje (9 -> 0.0075). */
export function monthlyRate(annualPct: number): number {
  return annualPct / 100 / 12;
}

/** Porcentaje pagado del capital: (original - saldo) / original, acotado a 0-100. */
export function percentPaid(original: number, currentBalance: number): number {
  if (original <= 0) return 0;
  const pct = ((original - currentBalance) / original) * 100;
  return round2(Math.min(100, Math.max(0, pct)));
}

export interface PaymentBreakdown {
  interest: number;
  principal: number;
  newBalance: number;
}

/**
 * Desglose de una cuota: parte de interés y parte de capital.
 * El capital nunca excede el saldo (última cuota).
 */
export function nextPaymentBreakdown(
  balance: number,
  annualPct: number,
  installment: number,
): PaymentBreakdown {
  const interest = round2(balance * monthlyRate(annualPct));
  const principal = round2(Math.min(installment - interest, balance));
  const safePrincipal = Math.max(0, principal);
  return {
    interest,
    principal: safePrincipal,
    newBalance: round2(Math.max(0, balance - safePrincipal)),
  };
}

/**
 * Aplica un abono a capital (pago extra): reduce el saldo por el monto completo
 * (va 100% a capital, sin interés). Nunca deja el saldo por debajo de cero.
 */
export function applyExtraPrincipal(balance: number, amount: number): number {
  return round2(Math.max(0, balance - Math.max(0, amount)));
}

export interface LoanProjection {
  /** Cuotas restantes estimadas (Infinity si la cuota no cubre el interés). */
  monthsRemaining: number;
  /** Intereses que faltan por pagar. */
  totalInterestRemaining: number;
  /** Total que falta por pagar (capital + intereses). */
  totalRemainingToPay: number;
  /** Fecha estimada de liquidación (null si la cuota no cubre el interés). */
  estimatedPayoffISO: string | null;
  /** true si la cuota alcanza a cubrir al menos el interés mensual. */
  coversInterest: boolean;
}

const MAX_MONTHS = 1200; // tope de seguridad (100 años)

/**
 * Proyecta la amortización hacia adelante desde el saldo actual.
 * Itera mes a mes (robusto) acumulando intereses hasta liquidar el saldo.
 */
export function projectLoan(
  balance: number,
  annualPct: number,
  installment: number,
  fromISO: string = todayISO(),
): LoanProjection {
  if (balance <= 0) {
    return {
      monthsRemaining: 0,
      totalInterestRemaining: 0,
      totalRemainingToPay: 0,
      estimatedPayoffISO: fromISO,
      coversInterest: true,
    };
  }

  const i = monthlyRate(annualPct);
  const firstInterest = balance * i;

  // Sin interés: se liquida en cuotas fijas.
  if (i === 0) {
    const months = Math.ceil(balance / installment);
    return {
      monthsRemaining: months,
      totalInterestRemaining: 0,
      totalRemainingToPay: round2(balance),
      estimatedPayoffISO: addMonthsToISO(fromISO, months),
      coversInterest: true,
    };
  }

  // La cuota no cubre el interés: el saldo nunca baja.
  if (installment <= firstInterest) {
    return {
      monthsRemaining: Infinity,
      totalInterestRemaining: Infinity,
      totalRemainingToPay: Infinity,
      estimatedPayoffISO: null,
      coversInterest: false,
    };
  }

  let b = balance;
  let months = 0;
  let totalInterest = 0;
  while (b > 0 && months < MAX_MONTHS) {
    const interest = b * i;
    let principal = installment - interest;
    if (principal > b) principal = b;
    totalInterest += interest;
    b -= principal;
    months += 1;
  }

  return {
    monthsRemaining: months,
    totalInterestRemaining: round2(totalInterest),
    totalRemainingToPay: round2(balance + totalInterest),
    estimatedPayoffISO: addMonthsToISO(fromISO, months),
    coversInterest: true,
  };
}
