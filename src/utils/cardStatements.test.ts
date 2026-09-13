import { describe, expect, it } from 'vitest';
import { cardStatementDate } from '@/utils/cardStatements';

describe('Fecha mensual del corte', () => {
  it('mantiene el día de BAC y ajusta los meses cortos y bisiestos', () => {
    expect(cardStatementDate('2026-09', 9)).toBe('2026-09-09');
    expect(cardStatementDate('2026-02', 31)).toBe('2026-02-28');
    expect(cardStatementDate('2024-02', 31)).toBe('2024-02-29');
    expect(cardStatementDate('2026-04', 31)).toBe('2026-04-30');
  });
});
