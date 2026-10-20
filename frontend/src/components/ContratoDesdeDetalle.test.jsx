import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// El contrato se imprime desde el detalle de una carpa o sombrilla.
vi.mock('../lib/contratoApi', () => ({ descargarContrato: vi.fn(() => Promise.resolve()) }));

const { default: ReservationDetailsModal } = await import('./ReservationDetailsModal');
const { descargarContrato } = await import('../lib/contratoApi');

const CARPA = {
  id: 60, serviceType: 'carpa', resourceNumber: 12, startDate: '2026-12-15', endDate: '2027-03-15',
  customerName: 'Lucia', clientId: 7, status: 'active', totalPrice: '1820000', paidAmount: 0, adultsCount: 2, childrenCount: 0
};
const COCHERA = {
  id: 502, serviceType: 'parking', resourceNumber: 45, startDate: '2026-12-15', endDate: '2027-03-15', clientId: 7, status: 'active',
  totalPrice: '700000', paidAmount: 0, vehiclePlate: 'AB123CD', vinculo: 'incluido', incluidaEnReservaId: 60
};
const PAGO = { id: 1, amount: 100000, paymentDate: '2026-10-20', method: 'cash' };

beforeEach(() => {
  descargarContrato.mockClear();
  sessionStorage.setItem('authToken', 'tok');
  global.fetch = vi.fn((url) => {
    const u = String(url);
    let body = {};
    if (u.includes('clientId=')) body = { reservationGroups: [CARPA, COCHERA] };
    if (u.includes('/payments')) body = { payments: [PAGO] };
    if (u.includes('/guests')) body = { guests: [] };
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
  });
});
afterEach(() => vi.restoreAllMocks());

const props = (reservation) => ({
  reservation,
  establishment: { name: 'Zeus', hasParking: true, maxPersonasPorUnidad: 6 },
  parseLocalDateFromInput: () => null,
  onClose: vi.fn(), onEdit: vi.fn(), onCancel: vi.fn(), onAddPayment: vi.fn(), onViewReservation: vi.fn(),
  onViewClient: vi.fn(), onVenderPase: vi.fn(), onIrALaReserva: vi.fn(),
  titular: { id: 7, fullName: 'Lucia', addressCity: 'Necochea' }
});

describe('Imprimir contrato', () => {
  it('manda la reserva, el titular, las cocheras de la cuenta, los pagos y el total de la cuenta', async () => {
    render(<ReservationDetailsModal {...props(CARPA)} />);
    // Espera a que carguen la cuenta (las cocheras) y los pagos.
    await screen.findByText('Servicios incluidos');
    await screen.findByText(/100\.000/);

    await userEvent.click(screen.getByRole('button', { name: /Imprimir contrato/ }));

    await waitFor(() => expect(descargarContrato).toHaveBeenCalled());
    const args = descargarContrato.mock.calls[0][0];
    expect(args.reserva.id).toBe(60);
    expect(args.titular).toMatchObject({ fullName: 'Lucia', addressCity: 'Necochea' });
    expect(args.vinculadas.map((g) => g.id)).toEqual([502]);
    expect(args.pagos).toEqual([PAGO]);
    expect(args.total).toBe(2520000);
  });

  it('no aparece en una reserva de estacionamiento ni en una cancelada', () => {
    const { unmount } = render(<ReservationDetailsModal {...props({ ...COCHERA, vinculo: null, incluidaEnReservaId: null })} />);
    expect(screen.queryByRole('button', { name: /Imprimir contrato/ })).not.toBeInTheDocument();
    unmount();
    render(<ReservationDetailsModal {...props({ ...CARPA, status: 'cancelled' })} />);
    expect(screen.queryByRole('button', { name: /Imprimir contrato/ })).not.toBeInTheDocument();
  });

  it('si falla, lo dice en el detalle', async () => {
    descargarContrato.mockRejectedValueOnce(new Error('No se pudo completar. Probá de nuevo.'));
    render(<ReservationDetailsModal {...props(CARPA)} />);
    await userEvent.click(screen.getByRole('button', { name: /Imprimir contrato/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo completar');
  });
});
