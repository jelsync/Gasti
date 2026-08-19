import { describe, expect, it } from 'vitest';
import {
  compareMonthYear,
  formatDate,
  formatMonthYear,
  getRecentMonths,
  monthRange,
  nextMonth,
  previousMonth,
} from '@/utils/date';

describe('monthRange', () => {
  it('devuelve el primer y último día del mes', () => {
    expect(monthRange(2026, 8)).toEqual({ start: '2026-08-01', end: '2026-08-31' });
  });
  it('maneja febrero bisiesto y no bisiesto', () => {
    expect(monthRange(2024, 2).end).toBe('2024-02-29');
    expect(monthRange(2026, 2).end).toBe('2026-02-28');
  });
});

describe('formatMonthYear', () => {
  it('devuelve nombre del mes y año', () => {
    expect(formatMonthYear(8, 2026)).toBe('Agosto 2026');
    expect(formatMonthYear(1, 2025)).toBe('Enero 2025');
  });
});

describe('previousMonth / nextMonth', () => {
  it('retrocede envolviendo el año', () => {
    expect(previousMonth({ month: 1, year: 2026 })).toEqual({ month: 12, year: 2025 });
  });
  it('avanza envolviendo el año', () => {
    expect(nextMonth({ month: 12, year: 2026 })).toEqual({ month: 1, year: 2027 });
  });
});

describe('formatDate', () => {
  it('formatea sin desfase de zona horaria', () => {
    expect(formatDate('2026-08-19')).toBe('19 ago 2026');
    expect(formatDate('2026-01-01')).toBe('1 ene 2026');
  });
});

describe('compareMonthYear', () => {
  it('ordena por año y luego mes', () => {
    expect(compareMonthYear({ month: 1, year: 2026 }, { month: 12, year: 2025 })).toBeGreaterThan(
      0,
    );
    expect(compareMonthYear({ month: 5, year: 2026 }, { month: 5, year: 2026 })).toBe(0);
  });
});

describe('getRecentMonths', () => {
  it('devuelve la cantidad pedida, del más reciente al más antiguo', () => {
    const months = getRecentMonths(3, { month: 3, year: 2026 });
    expect(months).toEqual([
      { month: 3, year: 2026 },
      { month: 2, year: 2026 },
      { month: 1, year: 2026 },
    ]);
  });
});
