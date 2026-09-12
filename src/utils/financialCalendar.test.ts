import { describe, expect, it } from 'vitest';
import {
  calendarMonthCells,
  financialEventStatus,
  monthlyDueDate,
} from '@/utils/financialCalendar';

describe('financialEventStatus', () => {
  it('distingue próximos, del día y vencidos', () => {
    expect(financialEventStatus('2026-09-10', '2026-09-11')).toBe('OVERDUE');
    expect(financialEventStatus('2026-09-11', '2026-09-11')).toBe('DUE');
    expect(financialEventStatus('2026-09-12', '2026-09-11')).toBe('UPCOMING');
  });

  it('prioriza los estados atendidos', () => {
    expect(financialEventStatus('2026-09-01', '2026-09-11', 'COMPLETED')).toBe('COMPLETED');
    expect(financialEventStatus('2026-09-01', '2026-09-11', 'SKIPPED')).toBe('SKIPPED');
  });
});

describe('monthlyDueDate', () => {
  it('ajusta el día al final del mes', () => {
    expect(monthlyDueDate({ year: 2026, month: 2 }, 31)).toBe('2026-02-28');
  });
});

describe('calendarMonthCells', () => {
  it('empieza en lunes y completa semanas enteras', () => {
    const cells = calendarMonthCells({ year: 2026, month: 9 });
    expect(cells.length % 7).toBe(0);
    expect(cells[0]).toBeNull();
    expect(cells[1]).toBe('2026-09-01');
    expect(cells.filter(Boolean)).toHaveLength(30);
  });
});
