import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CarpaReservationModal from './CarpaReservationModal';

// Cuenta unica en el alta: pases de pileta pagos, subtotal por item y un solo pago.

function parseLocal(value) {
  if (!value) return null;
  const [a, m, d] = String(value).split('-').map(Number);
  return new Date(a, m - 1, d);
}

// La carpa cotiza 50.000 por los 5 dias.
const COTIZACION = {
  dias: 5, total: 50000, completo: true, diasSinTarifa: [],
  desglose: { clase: 'fecha', tramos: [{ desde: '2026-12-01', hasta: '2026-12-05', periodoId: 1, periodo: 'Alta', dias: 5, precioDia: 10000, subtotal: 50000 }], diasSinTarifa: [] }
};

beforeEach(() => {
  global.fetch = vi.fn((url) => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(String(url).includes('/tarifas/cotizar') ? { cotizacion: COTIZACION } : { reservationGroups: [] })
  }));
});
afterEach(() => vi.restoreAllMocks());

const CLIENTE = { id: 7, fullName: 'Lucia', documentNumber: '30111222', birthDate: '1990-05-01' };
const BASE = {
  carpaNumero: 12, isReserved: false, startDate: '2026-12-01', endDate: '2026-12-05',
  clientId: 7, customerName: 'Lucia', customerPhone: '', adultsCount: '2', childrenCount: '1',
  initialPaymentAmount: '', initialPaymentMethod: '', cocheras: [], incluyePileta: false,
  acompanantes: [{ fullName: 'Dani', documentNumber: '4', age: '30' }, { fullName: 'Eli', documentNumber: '5', age: '10' }]
};

function ConEstado({ inicial = BASE, onSaveRange = vi.fn().mockResolvedValue(true) }) {
  const [form, setForm] = useState(inicial);
  return (
    <CarpaReservationModal
      form={form} clients={[CLIENTE]} establishment={{ carpasCapacity: 100, hasParking: false, hasPileta: true }}
      error="" parseLocalDateFromInput={parseLocal} onChangeForm={setForm} onSaveRange={onSaveRange}
      onReleaseRange={vi.fn()} onClose={vi.fn()} reservationGroups={[]} onNuevoCliente={vi.fn()}
    />
  );
}

const cuenta = () => screen.getByRole('region', { name: 'Cuenta de la reserva' });
const guardar = () => screen.getByRole('button', { name: /Guardar reserva/ });

describe('cuenta unica en el alta de la carpa', () => {
  it('vender un pase pago suma su subtotal a la cuenta', async () => {
    render(<ConEstado />);
    await within(cuenta()).findAllByText('$50.000');

    await userEvent.click(screen.getByRole('button', { name: 'Pase de pileta pago para Dani' }));
    await userEvent.click(screen.getByRole('button', { name: 'Pase de pileta pago para Eli' }));
    await userEvent.type(screen.getByLabelText('Precio por día adulto (ARS)'), '5000');
    await userEvent.type(screen.getByLabelText('Precio por día menor (ARS)'), '3000');

    // (1 adulto x 5000 + 1 menor x 3000) x 5 dias = 40.000
    expect(within(cuenta()).getByText('Pileta paga (2 pases)')).toBeInTheDocument();
    expect(within(cuenta()).getByText('$40.000')).toBeInTheDocument();
    expect(within(cuenta()).getByText('$90.000')).toBeInTheDocument();
  });

  it('un pase pago sin precio por dia no deja guardar', async () => {
    render(<ConEstado />);
    await within(cuenta()).findAllByText('$50.000');
    await userEvent.click(screen.getByRole('button', { name: 'Pase de pileta pago para Dani' }));

    expect(screen.getByText(/Cargá el precio por día/)).toBeInTheDocument();
    expect(guardar()).toBeDisabled();
  });

  it('quien tiene pase incluido no puede tener ademas un pase pago', async () => {
    render(<ConEstado inicial={{ ...BASE, incluyePileta: true }} />);
    const incluido = screen.getByRole('button', { name: 'Pase de pileta para Dani' });
    const pago = screen.getByRole('button', { name: 'Pase de pileta pago para Dani' });
    expect(incluido).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(pago);
    expect(pago).toHaveAttribute('aria-pressed', 'true');
    expect(incluido).toHaveAttribute('aria-pressed', 'false');
  });

  it('se cobra un solo pago por toda la cuenta y se manda al guardar', async () => {
    const onSaveRange = vi.fn().mockResolvedValue(true);
    render(<ConEstado onSaveRange={onSaveRange} />);
    await within(cuenta()).findAllByText('$50.000');
    await userEvent.click(screen.getByRole('button', { name: 'Pase de pileta pago para Dani' }));
    await userEvent.type(screen.getByLabelText('Precio por día adulto (ARS)'), '5000');

    expect(screen.queryByText(/Monto a pagar ahora por carpa/)).toBeNull();
    await userEvent.type(screen.getByLabelText('Monto a pagar ahora (ARS)'), '60000');
    expect(within(cuenta()).getByText(/Saldo: \$15\.000/)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Medio de pago'), 'cash');
    await waitFor(() => expect(guardar()).toBeEnabled());
    await userEvent.click(guardar());

    const extra = onSaveRange.mock.calls[0][3];
    expect(extra.pagoInicial).toEqual({ monto: '60000', metodo: 'cash' });
    expect(extra.pasePago).toEqual({ precioAdultoPorDia: '5000', precioMenorPorDia: '' });
  });

  it('no deja pagar mas que el total ni pagar sin medio de pago', async () => {
    render(<ConEstado />);
    await within(cuenta()).findAllByText('$50.000');
    const monto = screen.getByLabelText('Monto a pagar ahora (ARS)');

    await userEvent.type(monto, '50001');
    expect(screen.getByText(/no puede superar el total/)).toBeInTheDocument();
    expect(guardar()).toBeDisabled();

    await userEvent.clear(monto);
    await userEvent.type(monto, '1000');
    expect(screen.getByText(/elegí el medio de pago/i)).toBeInTheDocument();
    expect(guardar()).toBeDisabled();
  });
});
