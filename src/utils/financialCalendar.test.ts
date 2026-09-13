import { describe, expect, it } from 'vitest';
import {
  buildFinancialEvents,
  calendarMonthCells,
  financialEventStatus,
  monthlyDueDate,
} from '@/utils/financialCalendar';
import type { CardStatement, CreditCardWithBalance } from '@/types/models';

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

describe('recordatorios de corte de tarjeta', () => {
  const card = {
    id: 'card-1',
    name: 'BAC',
    bank: 'BAC',
    statement_day: 9,
    payment_due_day: null,
    balanceHnl: 0,
    balanceUsd: 0,
    color: '#ef4444',
  } as unknown as CreditCardWithBalance;

  const build = (today: string, cardStatements: CardStatement[] = []) =>
    buildFinancialEvents({
      month: { year: 2026, month: 9 },
      today,
      recurringRules: [],
      occurrences: [],
      loans: [],
      cards: [card],
      transactions: [],
      cardStatements,
    });

  it('muestra el corte aunque la tarjeta no tenga deuda y nunca lo confirma automáticamente', () => {
    const [event] = build('2026-09-08');
    expect(event).toMatchObject({
      id: 'card-statement:card-1',
      date: '2026-09-09',
      kind: 'CARD_STATEMENT',
      status: 'UPCOMING',
      amounts: [],
      entityId: 'card-1',
    });
    expect(build('2026-09-10')[0].status).toBe('OVERDUE');
  });

  it('queda confirmado solo cuando existe la fotografía manual y muestra ambas monedas separadas', () => {
    const statement = {
      card_id: 'card-1',
      statement_date: '2026-09-09',
      balance_hnl: 125,
      balance_usd: 11.49,
    } as CardStatement;
    const [event] = build('2026-09-10', [statement]);
    expect(event.status).toBe('COMPLETED');
    expect(event.amounts).toEqual([
      { amount: 125, currency: 'HNL' },
      { amount: 11.49, currency: 'USD' },
    ]);
  });
});
