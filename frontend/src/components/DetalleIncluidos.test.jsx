import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReservationDetailsModal from './ReservationDetailsModal';

// Detalle de una carpa con servicios incluidos, y de un servicio incluido.

const CARPA = {
  id: 60, serviceType: 'carpa', resourceNumber: 12, startDate: '2026-12-01', endDate: '2026-12-05',
  customerName: 'Lucia', clientId: 7, status: 'active', totalPrice: '100000', paidAmount: 0,
  adultsCount: 2, childrenCount: 1,
  incluidos: { pileta: { id: 501, asignados: 1 }, cocheras: [{ id: 502, plaza: 45, vehiclePlate: 'AB123CD' }], pasesPagos: [{ id: 503, personas: 1 }] }
};

const DEL_CLIENTE = [
  CARPA,
  { id: 501, serviceType: 'pileta', resourceNumber: 1, startDate: '2026-12-01', endDate: '2026-12-05', clientId: 7, status: 'active', totalPrice: '0', paidAmount: 0, vinculo: 'incluido', incluidaEnReservaId: 60, incluidaEnNumero: 12, incluidaEnTipo: 'carpa', paseNombres: ['Lucia'] },
  { id: 502, serviceType: 'parking', resourceNumber: 45, startDate: '2026-12-01', endDate: '2026-12-05', clientId: 7, status: 'active', totalPrice: '700000', paidAmount: 0, vehiclePlate: 'AB123CD', vinculo: 'incluido', incluidaEnReservaId: 60, incluidaEnNumero: 12, incluidaEnTipo: 'carpa' },
  { id: 503, serviceType: 'pileta', resourceNumber: 1, startDate: '2026-12-01', endDate: '2026-12-05', clientId: 7, status: 'active', totalPrice: '5000', paidAmount: 0, vinculo: 'adicional', incluidaEnReservaId: 60, incluidaEnNumero: 12, incluidaEnTipo: 'carpa', paseNombres: ['Caro'] }
];

beforeEach(() => {
  sessionStorage.setItem('authToken', 'tok');
  global.fetch = vi.fn((url) => {
    const u = String(url);
    let body = {};
    if (u.includes('clientId=')) body = { reservationGroups: DEL_CLIENTE };
    if (u.includes('/payments')) body = { payments: [] };
    if (u.includes('/guests')) body = { guests: [] };
    if (u.includes('/pase-personas')) body = { personas: [] };
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
  });
});
afterEach(() => vi.restoreAllMocks());

const props = (extra = {}) => ({
  establishment: { hasPileta: true, hasParking: true }, parseLocalDateFromInput: () => null,
  onClose: vi.fn(), onEdit: vi.fn(), onCancel: vi.fn(), onAddPayment: vi.fn(), onViewReservation: vi.fn(),
  onViewClient: vi.fn(), onVenderPase: vi.fn(), onIrALaReserva: vi.fn(), titular: { id: 7, fullName: 'Lucia' },
  ...extra
});

describe('detalle de una carpa con servicios incluidos', () => {
  it('muestra la pileta, la cochera y el pase pago en su propia seccion', async () => {
    render(<ReservationDetailsModal reservation={CARPA} {...props()} />);

    const seccion = (await screen.findByText('Servicios incluidos')).closest('div').parentElement;
    expect(within(seccion).getByText(/Pileta incluida/)).toBeInTheDocument();
    expect(await within(seccion).findByText(/Plaza 45/)).toBeInTheDocument();
    expect(within(seccion).getByText(/Pase pago/)).toBeInTheDocument();
    // No se repiten en "Otras reservas activas".
    expect(screen.queryByText(/Otras reservas activas/)).toBeNull();
  });

  it('vender un pase de pileta a los que no tienen', async () => {
    const onVenderPase = vi.fn();
    render(<ReservationDetailsModal reservation={CARPA} {...props({ onVenderPase })} />);

    await userEvent.click(screen.getByRole('button', { name: /Vender pase de pileta/ }));
    expect(onVenderPase).toHaveBeenCalledWith(expect.objectContaining({ id: 60 }));
  });

  it('tocar un servicio incluido abre su reserva', async () => {
    const onViewReservation = vi.fn();
    render(<ReservationDetailsModal reservation={CARPA} {...props({ onViewReservation })} />);

    await userEvent.click(await screen.findByRole('button', { name: /Plaza 45/ }));
    expect(onViewReservation).toHaveBeenCalledWith(expect.objectContaining({ id: 502 }));
  });
});

describe('detalle de un servicio incluido', () => {
  it('dice a que carpa pertenece, quienes tienen pase y lleva a la carpa', async () => {
    const onIrALaReserva = vi.fn();
    render(<ReservationDetailsModal reservation={DEL_CLIENTE[1]} {...props({ onIrALaReserva })} />);

    expect(screen.getByText(/Incluido en Carpa 12/)).toBeInTheDocument();
    expect(screen.getByText(/Con pase: Lucia/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Ir a la reserva/ }));
    expect(onIrALaReserva).toHaveBeenCalledWith(expect.objectContaining({ id: 501 }));
  });
});

describe('cuenta de la carpa en el detalle', () => {
  it('muestra el saldo de toda la cuenta y cobra contra ese saldo', async () => {
    const onAddPayment = vi.fn();
    render(<ReservationDetailsModal reservation={CARPA} {...props({ onAddPayment })} />);

    // Carpa 100.000 + cochera 700.000 + pase pago 5.000, sin pagos.
    expect(await screen.findByText(/Saldo de la cuenta: \$805\.000/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Agendar pago/ }));
    expect(onAddPayment).toHaveBeenCalledWith(expect.objectContaining({ id: 60 }), { total: 805000, pagado: 0 });
  });

  it('una reserva sin nada asociado se cobra como siempre', async () => {
    const onAddPayment = vi.fn();
    const suelta = { ...DEL_CLIENTE[2], vinculo: null, incluidaEnReservaId: null };
    render(<ReservationDetailsModal reservation={suelta} {...props({ onAddPayment })} />);

    await userEvent.click(screen.getByRole('button', { name: /Agendar pago/ }));
    expect(onAddPayment).toHaveBeenCalledWith(expect.objectContaining({ id: 502 }), null);
  });
});

describe('detalle de la pileta incluida en una carpa', () => {
  it('dice en el precio de que carpa va, sin $0 ni cobro propio', async () => {
    const onAddPayment = vi.fn();
    render(<ReservationDetailsModal reservation={DEL_CLIENTE[1]} {...props({ onAddPayment })} />);

    expect(await screen.findByText('Incluida en el precio de la Carpa 12.')).toBeInTheDocument();
    expect(screen.queryByText('Saldo pendiente')).toBeNull();
    expect(screen.queryByText(/Historial de pagos/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Agendar pago/ })).toBeNull();
  });

  it('el pase pago de la carpa si muestra su precio y se cobra', async () => {
    render(<ReservationDetailsModal reservation={DEL_CLIENTE[3]} {...props()} />);
    expect(await screen.findByText('Saldo pendiente')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Agendar pago/ })).toBeInTheDocument();
  });
});
