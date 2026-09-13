import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecurringConfirmationModal } from '@/components/recurring/RecurringConfirmationModal';
import { getRecurringCandidates } from '@/services/recurring.service';
import type { RecurringTransactionWithRelations, Transaction } from '@/types/models';
import { todayISO } from '@/utils/date';

vi.mock('@/services/recurring.service', () => ({ getRecurringCandidates: vi.fn() }));
vi.mock('@/contexts/privacy', () => ({
  PRIVACY_KEYS: { income: 'income' },
  usePrivacy: () => ({ isHidden: () => false }),
}));

const rule = {
  id: 'rule',
  name: 'Spotify',
  type: 'EXPENSE',
  amount: 11.49,
  currency: 'USD',
  category: { name: 'Spotify' },
  credit_card: { name: 'Conecta' },
} as RecurringTransactionWithRelations;
const movement = {
  id: 'purchase',
  transaction_date: todayISO(),
  amount: 11.49,
  currency: 'USD',
  description: 'Compra Spotify',
} as Transaction;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('confirmación explícita de recurrentes', () => {
  it('exige seleccionar el movimiento existente y lo vincula sin autorizar otro', async () => {
    vi.mocked(getRecurringCandidates).mockResolvedValue([movement]);
    const confirm = vi.fn().mockResolvedValue(undefined);
    render(
      <RecurringConfirmationModal
        rule={rule}
        dueDate={todayISO()}
        onClose={vi.fn()}
        onConfirm={confirm}
      />,
    );
    await screen.findByText('Compra Spotify');
    expect(screen.getByRole('button', { name: 'Registrar y confirmar' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: /Compra Spotify/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Vincular y confirmar' }));
    await waitFor(() =>
      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({ existingTransactionId: 'purchase', allowDuplicate: false }),
      ),
    );
  });

  it('solo permite crear otro después de la excepción explícita y conserva la fecha real', async () => {
    vi.mocked(getRecurringCandidates).mockResolvedValue([movement]);
    const confirm = vi.fn().mockResolvedValue(undefined);
    render(
      <RecurringConfirmationModal
        rule={rule}
        dueDate={todayISO()}
        onClose={vi.fn()}
        onConfirm={confirm}
      />,
    );
    fireEvent.click(await screen.findByRole('radio', { name: 'Registrar un movimiento distinto' }));
    expect(screen.getByRole('button', { name: 'Registrar y confirmar' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByLabelText('Monto'), { target: { value: '12.49' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar y confirmar' }));
    await waitFor(() =>
      expect(confirm).toHaveBeenCalledWith({
        amount: 12.49,
        transactionDate: todayISO(),
        existingTransactionId: undefined,
        allowDuplicate: true,
      }),
    );
  });

  it('bloquea guardar si falla la revisión y permite recuperarla', async () => {
    vi.mocked(getRecurringCandidates)
      .mockRejectedValueOnce(new Error('Sin conexión'))
      .mockResolvedValueOnce([]);
    render(
      <RecurringConfirmationModal
        rule={rule}
        dueDate={todayISO()}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    await screen.findByText('Sin conexión');
    expect(screen.getByRole('button', { name: 'Registrar y confirmar' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar revisión' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Registrar y confirmar' })).toBeEnabled(),
    );
  });
});
