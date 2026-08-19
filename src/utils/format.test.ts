import { describe, expect, it } from 'vitest';
import { formatAmount, formatCurrency, formatPercent } from '@/utils/format';

describe('formatCurrency', () => {
  it('formatea con símbolo y separadores', () => {
    expect(formatCurrency(1250)).toBe('L 1,250.00');
    expect(formatCurrency(0)).toBe('L 0.00');
    expect(formatCurrency(1000000)).toBe('L 1,000,000.00');
  });

  it('formatea negativos', () => {
    expect(formatCurrency(-150.5)).toBe('L -150.50');
  });

  it('trata valores no finitos como 0', () => {
    expect(formatCurrency(Number.NaN)).toBe('L 0.00');
    expect(formatCurrency(Number.POSITIVE_INFINITY)).toBe('L 0.00');
  });
});

describe('formatAmount', () => {
  it('formatea sin símbolo', () => {
    expect(formatAmount(1250.5)).toBe('1,250.50');
  });
});

describe('formatPercent', () => {
  it('redondea a entero con símbolo', () => {
    expect(formatPercent(74.6)).toBe('75%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(150)).toBe('150%');
  });
});
