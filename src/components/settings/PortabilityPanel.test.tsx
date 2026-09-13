import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PortabilityPanel } from '@/components/settings/PortabilityPanel';
import { PrivacyContext } from '@/contexts/privacy';
import { getUserBackup, importBankTransactions } from '@/services/portability.service';

const account = '33333333-3333-4333-8333-333333333333';
const category = '44444444-4444-4444-8444-444444444444';
vi.mock('@/hooks/useCategories', () => ({
  useCategories: () => ({
    categories: [{ id: '44444444-4444-4444-8444-444444444444', type: 'EXPENSE', name: 'Comida' }],
    loading: false,
    error: null,
  }),
}));
vi.mock('@/hooks/useSavingsAccounts', () => ({
  useSavingsAccounts: () => ({
    accounts: [{ id: '33333333-3333-4333-8333-333333333333', name: 'Cuenta de prueba' }],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));
vi.mock('@/services/portability.service', () => ({
  getUserBackup: vi.fn(),
  importBankTransactions: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserBackup).mockResolvedValue({
    tables: {
      transactions: [
        {
          savings_account_id: account,
          amount: 100,
          type: 'EXPENSE',
          currency: 'HNL',
          transaction_date: '2026-09-01',
        },
      ],
    },
  } as Awaited<ReturnType<typeof getUserBackup>>);
  vi.mocked(importBankTransactions).mockResolvedValue({ inserted: 1, skipped: 0 });
});
afterEach(cleanup);

async function prepare(hidden = false) {
  const user = userEvent.setup();
  render(
    <PrivacyContext.Provider value={{ isHidden: () => hidden, toggle: vi.fn() }}>
      <PortabilityPanel />
    </PrivacyContext.Provider>,
  );
  await user.selectOptions(screen.getByLabelText('Cuenta bancaria (HNL)'), account);
  const file = new File(['CSV'], 'banco.csv', { type: 'text/csv' });
  Object.defineProperty(file, 'text', {
    value: async () =>
      'Fecha,Descripción,Monto\n2026-09-01,Compra existente,-100\n2026-09-02,Compra nueva,-50',
  });
  await user.upload(screen.getByLabelText('Archivo CSV (UTF-8, máximo 2 MB)'), file);
  await user.click(await screen.findByRole('button', { name: 'Preparar vista previa' }));
  await screen.findByLabelText('Importar fila 2');
  return user;
}

describe('Flujo de importación bancaria', () => {
  it('exige categoría y confirmación, y deja los duplicados sin seleccionar', async () => {
    const user = await prepare();
    expect(screen.getByLabelText('Importar fila 2')).not.toBeChecked();
    expect(screen.getByLabelText('Importar fila 3')).toBeChecked();
    expect(screen.getByRole('button', { name: 'Importar 1 movimientos' })).toBeDisabled();
    expect(importBankTransactions).not.toHaveBeenCalled();
    await user.selectOptions(screen.getByLabelText('Categoría de fila 3'), category);
    await user.click(screen.getByRole('button', { name: 'Importar 1 movimientos' }));
    expect(importBankTransactions).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirmar importación' }));
    await waitFor(() => expect(importBankTransactions).toHaveBeenCalledOnce());
    const [accountId, rows] = vi.mocked(importBankTransactions).mock.calls[0];
    expect(accountId).toBe(account);
    expect(rows.filter((row) => row.selected)).toEqual([
      expect.objectContaining({ amount: 50, type: 'EXPENSE', category_id: category }),
    ]);
    await waitFor(() => expect(screen.queryByLabelText('Importar fila 3')).not.toBeInTheDocument());
  });
  it('invalida la vista previa al cambiar el formato del archivo y respeta privacidad', async () => {
    const user = await prepare(true);
    expect(screen.getAllByText(/••••/)).toHaveLength(2);
    await user.selectOptions(screen.getByLabelText('Separador decimal'), ',');
    expect(screen.queryByLabelText('Importar fila 2')).not.toBeInTheDocument();
    expect(importBankTransactions).not.toHaveBeenCalled();
  });
  it('conserva los UUID y la selección después de un error para permitir reintentar', async () => {
    const user = await prepare();
    vi.mocked(importBankTransactions).mockRejectedValueOnce(new Error('Sin conexión'));
    await user.selectOptions(screen.getByLabelText('Categoría de fila 3'), category);
    await user.click(screen.getByRole('button', { name: 'Importar 1 movimientos' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar importación' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Importar fila 3')).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Importar 1 movimientos' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar importación' }));
    await waitFor(() => expect(importBankTransactions).toHaveBeenCalledTimes(2));
    expect(vi.mocked(importBankTransactions).mock.calls[0][1]).toEqual(
      vi.mocked(importBankTransactions).mock.calls[1][1],
    );
  });
});
