import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClientSearchInput from './ClientSearchInput';

const DEUDORA = { id: 5, fullName: 'Andrea Ortiz', phone: '2262-111111' };
const AL_DIA = { id: 9, fullName: 'Andres Lopez', phone: '2262-222222' };

// Una reserva terminada con saldo (deuda) y una en curso con saldo (no cuenta).
const RESERVAS = [
  {
    id: 1, clientId: 5, status: 'active', serviceType: 'carpa', resourceNumber: 12,
    startDate: '2020-01-01', endDate: '2020-01-10', totalPrice: '100000.00', paidAmount: 40528
  },
  {
    id: 2, clientId: 9, status: 'active', serviceType: 'carpa', resourceNumber: 20,
    startDate: '2020-01-01', endDate: '2099-12-31', totalPrice: '500000.00', paidAmount: 0
  }
];

beforeEach(() => {
  sessionStorage.setItem('authToken', 'token-de-prueba');
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ reservationGroups: RESERVAS }) })
  );
});

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

// El buscador es controlado: el modal guarda el cliente elegido.
function Envoltorio() {
  const [elegido, setElegido] = useState(null);
  return (
    <ClientSearchInput
      clients={[DEUDORA, AL_DIA]}
      selectedClientId={elegido}
      onSelect={(c) => setElegido(c ? c.id : null)}
    />
  );
}

describe('ClientSearchInput: deuda de reservas terminadas', () => {
  it('marca al cliente con deuda en la lista, antes de elegirlo', async () => {
    const user = userEvent.setup();
    render(<Envoltorio />);

    await user.type(screen.getByPlaceholderText(/Buscar por nombre/), 'Andr');

    const filaDeudora = (await screen.findByText('Andrea Ortiz')).closest('button');
    expect(await within(filaDeudora).findByText('Debe $59.472')).toBeInTheDocument();
  });

  it('no marca a quien solo tiene saldo de una reserva en curso', async () => {
    const user = userEvent.setup();
    render(<Envoltorio />);

    await user.type(screen.getByPlaceholderText(/Buscar por nombre/), 'Andr');
    await screen.findByText('Debe $59.472');

    const filaAlDia = screen.getByText('Andres Lopez').closest('button');
    expect(within(filaAlDia).queryByText(/Debe/)).not.toBeInTheDocument();
  });

  it('al elegirlo avisa cuanto debe y de que reserva', async () => {
    const user = userEvent.setup();
    render(<Envoltorio />);

    await user.type(screen.getByPlaceholderText(/Buscar por nombre/), 'Andrea');
    await screen.findByText('Debe $59.472');
    await user.click(screen.getByText('Andrea Ortiz'));

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent('Debe $59.472 de 1 reserva ya terminada');
    expect(aviso).toHaveTextContent('Carpa 12');
    expect(aviso).toHaveTextContent('10/01/2020');
  });
});
