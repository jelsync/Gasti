import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CardStatementsPanel } from '@/components/cards/CardStatementsPanel';
import type { CreditCardWithBalance } from '@/types/models';

const service = vi.hoisted(() => ({
  getCardStatements: vi.fn(),
  previewCardStatement: vi.fn(),
  confirmCardStatement: vi.fn(),
}));
vi.mock('@/services/cardStatements.service', () => service);
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/utils/date', async (original) => ({
  ...(await original<typeof import('@/utils/date')>()),
  todayISO: () => '2026-09-09',
}));

const card: CreditCardWithBalance = {
  id: 'card-1',
  user_id: 'user-1',
  name: 'BAC',
  bank: 'BAC',
  color: '#000000',
  opening_balance: 0,
  opening_balance_usd: 0,
  credit_limit: null,
  credit_limit_usd: null,
  statement_day: 9,
  payment_due_day: 20,
  balanceHnl: 0,
  balanceUsd: 11.49,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  currency: 'HNL',
};
const snapshot = {
  card_id: card.id,
  statement_date: '2026-09-09',
  statement_day: 9,
  period_start: '2026-08-10',
  opening_hnl: 0,
  opening_usd: 0,
  charges_hnl: 0,
  charges_usd: 11.49,
  payments_hnl: 0,
  payments_usd: 0,
  balance_hnl: 0,
  balance_usd: 11.49,
};

beforeEach(() => {
  vi.clearAllMocks();
  service.getCardStatements.mockResolvedValue([]);
  service.previewCardStatement.mockResolvedValue(snapshot);
  service.confirmCardStatement.mockResolvedValue({
    ...snapshot,
    id: 'statement-1',
    user_id: 'user-1',
    confirmed_at: '2026-09-09T18:00:00Z',
  });
});

afterEach(cleanup);

describe('Revisión manual del corte', () => {
  it('solo confirma después de revisar y marcar todas las compras del día', async () => {
    render(<CardStatementsPanel card={card} onConfigure={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Revisar corte' }));
    const confirm = await screen.findByRole('button', { name: 'Confirmar corte' });
    expect(confirm).toBeDisabled();
    expect(service.confirmCardStatement).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(service.confirmCardStatement).toHaveBeenCalledWith(snapshot));
    expect(await screen.findByText('Corte del 9 sep 2026')).toBeInTheDocument();
  });

  it('abre la revisión desde el calendario pero impide confirmar fechas futuras', async () => {
    service.previewCardStatement.mockResolvedValue({
      ...snapshot,
      statement_date: '2026-10-09',
      period_start: '2026-09-10',
    });
    render(<CardStatementsPanel card={card} requestedDate="2026-10-09" onConfigure={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'Confirmar corte' })).toBeDisabled();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(service.previewCardStatement).toHaveBeenCalledWith(card.id, '2026-10-09');
    expect(service.confirmCardStatement).not.toHaveBeenCalled();
  });
});
