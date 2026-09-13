import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { PrivacyContext } from '@/contexts/privacy';
import type { Category, RecurringTransactionWithRelations, Transaction } from '@/types/models';
import type { ManualRecurringMatch } from '@/utils/manualRecurringGuard';

const accountId = '11111111-1111-4111-8111-111111111111';
const categoryId = '22222222-2222-4222-8222-222222222222';
const match: ManualRecurringMatch = {
  rule: {
    id: 'rule',
    name: 'Spotify',
    type: 'EXPENSE',
    amount: 100,
    currency: 'HNL',
  } as RecurringTransactionWithRelations,
  dueDate: '2026-09-19',
  transaction: null,
};
afterEach(cleanup);

function setup(matches: ManualRecurringMatch[] = [match]) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  const onSubmitRecurring = vi.fn().mockResolvedValue(undefined);
  const checkRecurring = vi.fn().mockResolvedValue(matches);
  render(
    <PrivacyContext.Provider value={{ isHidden: () => false, toggle: () => {} }}>
      <TransactionForm
        open
        onClose={onClose}
        onSubmit={onSubmit}
        onSubmitRecurring={onSubmitRecurring}
        checkRecurring={checkRecurring}
        categories={[{ id: categoryId, name: 'Spotify', type: 'EXPENSE' } as Category]}
        creditCards={[]}
        savingsAccounts={[{ id: accountId, name: 'Banco', balance: 500 }]}
      />
    </PrivacyContext.Provider>,
  );
  fireEvent.change(screen.getByLabelText('Monto'), { target: { value: '100' } });
  fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: categoryId } });
  fireEvent.change(screen.getByLabelText('Debitar de cuenta'), { target: { value: accountId } });
  fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-09-12' } });
  return { onSubmit, onClose, onSubmitRecurring, checkRecurring };
}

describe('revisión recurrente en formulario manual', () => {
  it('si otra sesión atendió la recurrencia no crea un movimiento independiente como alternativa', async () => {
    const handlers = setup();
    handlers.onSubmitRecurring.mockRejectedValue(new Error('Esta recurrencia ya fue atendida'));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Registrar y atender esta recurrencia' }),
    );
    await screen.findByRole('alert');
    expect(handlers.onSubmit).not.toHaveBeenCalled();
    expect(handlers.onClose).not.toHaveBeenCalled();
  });
  it('no crea antes de decidir y atender pendiente usa la ruta recurrente con fecha manual', async () => {
    const handlers = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    await screen.findByRole('button', { name: 'Registrar y atender esta recurrencia' });
    expect(handlers.onSubmit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar y atender esta recurrencia' }));
    await waitFor(() =>
      expect(handlers.onSubmitRecurring).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({ transaction_date: '2026-09-12', amount: 100 }),
        }),
        match,
      ),
    );
    expect(handlers.onSubmit).not.toHaveBeenCalled();
  });
  it('una confirmada solo permite otro registro con elección explícita', async () => {
    const handlers = setup([
      {
        ...match,
        transaction: {
          amount: 100,
          currency: 'HNL',
          transaction_date: '2026-09-10',
        } as Transaction,
      },
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    await screen.findByText(/Ya registrado/);
    expect(
      screen.queryByRole('button', { name: 'Registrar y atender esta recurrencia' }),
    ).toBeNull();
    expect(handlers.onSubmit).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Es otro movimiento: guardar independiente' }),
    );
    await waitFor(() => expect(handlers.onSubmit).toHaveBeenCalledTimes(1));
    expect(handlers.onSubmitRecurring).not.toHaveBeenCalled();
  });
  it('un error consultando coincidencias no guarda silenciosamente', async () => {
    const handlers = setup();
    handlers.checkRecurring.mockRejectedValue(new Error('No se pudo consultar las recurrencias'));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    await screen.findByText('No se pudo consultar las recurrencias');
    expect(handlers.onSubmit).not.toHaveBeenCalled();
    expect(handlers.onClose).not.toHaveBeenCalled();
  });
  it('volver a editar obliga a consultar nuevamente antes de guardar', async () => {
    const handlers = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Volver al formulario' }));
    fireEvent.change(screen.getByLabelText('Monto'), { target: { value: '200' } });
    handlers.checkRecurring.mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    await waitFor(() => expect(handlers.onSubmit).toHaveBeenCalledTimes(1));
    expect(handlers.checkRecurring).toHaveBeenCalledTimes(2);
    expect(handlers.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ input: expect.objectContaining({ amount: 200 }) }),
    );
  });
});
