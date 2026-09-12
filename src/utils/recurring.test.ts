import { describe, expect, it } from 'vitest';
import { recurringDueDate, ruleDueDateForMonth } from '@/utils/recurring';

describe('recurringDueDate', () => {
  it('conserva el día configurado cuando existe', () => {
    expect(recurringDueDate({ year: 2026, month: 9 }, 15)).toBe('2026-09-15');
  });

  it('ajusta el día 31 al final de un mes corto', () => {
    expect(recurringDueDate({ year: 2026, month: 2 }, 31)).toBe('2026-02-28');
    expect(recurringDueDate({ year: 2028, month: 2 }, 31)).toBe('2028-02-29');
  });
});

describe('ruleDueDateForMonth', () => {
  const rule = { day_of_month: 10, start_date: '2026-09-11', end_date: null };

  it('omite una fecha mensual anterior al inicio de la regla', () => {
    expect(ruleDueDateForMonth(rule, { year: 2026, month: 9 })).toBeNull();
  });

  it('devuelve la fecha de meses posteriores', () => {
    expect(ruleDueDateForMonth(rule, { year: 2026, month: 10 })).toBe('2026-10-10');
  });

  it('respeta la fecha final', () => {
    expect(
      ruleDueDateForMonth(
        { ...rule, start_date: '2026-01-01', end_date: '2026-09-09' },
        { year: 2026, month: 9 },
      ),
    ).toBeNull();
  });
});
