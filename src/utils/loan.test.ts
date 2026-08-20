import { describe, expect, it } from 'vitest';
import { monthlyRate, nextPaymentBreakdown, percentPaid, projectLoan } from '@/utils/loan';

describe('monthlyRate', () => {
  it('convierte tasa anual a mensual', () => {
    expect(monthlyRate(9)).toBeCloseTo(0.0075, 6);
    expect(monthlyRate(0)).toBe(0);
  });
});

describe('percentPaid', () => {
  it('calcula el porcentaje pagado del capital', () => {
    // Datos del Préstamo Vivienda de la captura
    expect(percentPaid(610570, 577752.83)).toBeCloseTo(5.37, 1);
  });
  it('acota entre 0 y 100', () => {
    expect(percentPaid(1000, 1200)).toBe(0);
    expect(percentPaid(1000, 0)).toBe(100);
    expect(percentPaid(0, 0)).toBe(0);
  });
});

describe('nextPaymentBreakdown', () => {
  it('separa interés y capital de una cuota', () => {
    const r = nextPaymentBreakdown(577752.83, 9, 6392.81);
    expect(r.interest).toBeCloseTo(4333.15, 2);
    expect(r.principal).toBeCloseTo(2059.66, 2);
    expect(r.newBalance).toBeCloseTo(575693.17, 2);
  });

  it('el capital no excede el saldo en la última cuota', () => {
    const r = nextPaymentBreakdown(100, 0, 500);
    expect(r.principal).toBe(100);
    expect(r.newBalance).toBe(0);
  });
});

describe('projectLoan', () => {
  it('préstamo sin interés se liquida en cuotas fijas', () => {
    const p = projectLoan(1000, 0, 300, '2026-01-15');
    expect(p.monthsRemaining).toBe(4);
    expect(p.totalInterestRemaining).toBe(0);
    expect(p.coversInterest).toBe(true);
  });

  it('detecta cuando la cuota no cubre el interés', () => {
    const p = projectLoan(100000, 12, 500, '2026-01-15');
    expect(p.coversInterest).toBe(false);
    expect(p.monthsRemaining).toBe(Infinity);
    expect(p.estimatedPayoffISO).toBeNull();
  });

  it('saldo cero está liquidado', () => {
    const p = projectLoan(0, 9, 5000, '2026-01-15');
    expect(p.monthsRemaining).toBe(0);
    expect(p.totalRemainingToPay).toBe(0);
  });

  it('proyecta un plazo finito con interés', () => {
    const p = projectLoan(10000, 12, 1000, '2026-01-15');
    expect(p.coversInterest).toBe(true);
    expect(p.monthsRemaining).toBeGreaterThan(10);
    expect(p.monthsRemaining).toBeLessThan(12);
    expect(p.totalInterestRemaining).toBeGreaterThan(0);
  });
});
