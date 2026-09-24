import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CarpaReservationModal from './CarpaReservationModal';

function parseLocal(value) {
  if (!value) return null;
  const [a, m, d] = String(value).split('-').map(Number);
  return new Date(a, m - 1, d);
}

const COTIZACION = {
  dias: 5, total: 50000, completo: true, diasSinTarifa: [],
  desglose: { clase: 'fecha', tramos: [{ desde: '2026-09-26', hasta: '2026-09-30', periodoId: 1, periodo: 'Baja', dias: 5, precioDia: 10000, subtotal: 50000 }], diasSinTarifa: [] }
};

beforeEach(() => {
  global.fetch = vi.fn((url) => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(String(url).includes('/tarifas/cotizar') ? { cotizacion: COTIZACION } : { reservationGroups: [] })
  }));
});
afterEach(() => vi.restoreAllMocks());

function ConEstado({ onSaveRange }) {
  const [form, setForm] = useState({
    carpaNumero: 58, isReserved: false, startDate: '2026-09-26', endDate: '2026-09-30',
    clientId: null, customerName: 'Lucia', customerPhone: '', includeParking: false,
    initialPaymentAmount: '', initialPaymentMethod: ''
  });
  return (
    <CarpaReservationModal
      form={form} clients={[]} establishment={{ carpasCapacity: 100, hasParking: true, parkingCapacity: 10 }}
      error="" parseLocalDateFromInput={parseLocal} onChangeForm={setForm} onSaveRange={onSaveRange}
      onReleaseRange={vi.fn()} onClose={vi.fn()} reservationGroups={[]}
    />
  );
}

const guardar = () => screen.getByRole('button', { name: /Guardar reserva/ });

describe('precio en el alta de carpa', () => {
  it('precarga la tarifa y la manda al guardar', async () => {
    const onSaveRange = vi.fn().mockResolvedValue(true);
    render(<ConEstado onSaveRange={onSaveRange} />);
    await waitFor(() => expect(screen.getByLabelText('Total cobrado (ARS)')).toHaveValue('50.000'));
    await waitFor(() => expect(guardar()).toBeEnabled());
    await userEvent.click(guardar());
    expect(onSaveRange.mock.calls[0][3].precio).toMatchObject({ precioTarifa: 50000, cobrado: '50000' });
  });

  it('un ajuste sin motivo no deja guardar', async () => {
    render(<ConEstado onSaveRange={vi.fn()} />);
    const total = await screen.findByDisplayValue('50.000');
    await userEvent.clear(total);
    await userEvent.type(total, '45000');
    expect(guardar()).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Motivo del ajuste/), 'amigo');
    await waitFor(() => expect(guardar()).toBeEnabled());
  });

  it('no deja guardar mientras la cotizacion esta en viaje', async () => {
    global.fetch = vi.fn((url) => (String(url).includes('/tarifas/cotizar')
      ? new Promise(() => {})
      : Promise.resolve({ ok: true, json: () => Promise.resolve({ reservationGroups: [] }) })));
    render(<ConEstado onSaveRange={vi.fn()} />);
    await screen.findByText('Calculando precio…');
    // Que termine todo lo demas (disponibilidad) antes de mirar el boton.
    await new Promise((r) => setTimeout(r, 300));
    expect(guardar()).toBeDisabled();
  });
});
