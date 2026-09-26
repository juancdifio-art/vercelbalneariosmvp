import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CarpaReservationModal from './CarpaReservationModal';
import SombrillaReservationModal from './SombrillaReservationModal';
import { cocheraVacia } from '../lib/incluidos';

// Pileta y cocheras incluidas al crear una carpa o sombrilla.

function parseLocal(value) {
  if (!value) return null;
  const [a, m, d] = String(value).split('-').map(Number);
  return new Date(a, m - 1, d);
}

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ reservationGroups: [] }) }));
});
afterEach(() => vi.restoreAllMocks());

const ESTABLECIMIENTO = { carpasCapacity: 100, sombrillasCapacity: 100, hasParking: true, parkingCapacity: 10, hasPileta: true };

const BASE = {
  isReserved: false, startDate: '2026-12-01', endDate: '2026-12-05',
  clientId: 7, customerName: 'Lucia', customerPhone: '', adultsCount: '2', childrenCount: '1',
  initialPaymentAmount: '', initialPaymentMethod: '', cocheras: [], incluyePileta: false
};

function ConEstado({ Modal = CarpaReservationModal, inicial, onSaveRange = vi.fn().mockResolvedValue(true), onNuevoCliente = vi.fn() }) {
  const [form, setForm] = useState(inicial);
  return (
    <Modal
      form={form} clients={[{ id: 7, fullName: 'Lucia', vehiclePlate: 'AC456DE' }]} establishment={ESTABLECIMIENTO}
      error="" parseLocalDateFromInput={parseLocal} onChangeForm={setForm} onSaveRange={onSaveRange}
      onReleaseRange={vi.fn()} onClose={vi.fn()} reservationGroups={[]} onNuevoCliente={onNuevoCliente}
    />
  );
}

const guardar = () => screen.getByRole('button', { name: /Guardar reserva/ });

describe('alta de carpa con servicios incluidos', () => {
  it('manda la pileta incluida al guardar', async () => {
    const onSaveRange = vi.fn().mockResolvedValue(true);
    render(<ConEstado inicial={{ ...BASE, carpaNumero: 12 }} onSaveRange={onSaveRange} />);

    await userEvent.click(screen.getByLabelText(/Incluye pileta/));
    expect(screen.getByText(/4 pases de pileta incluidos/)).toBeInTheDocument();
    await waitFor(() => expect(guardar()).toBeEnabled());
    await userEvent.click(guardar());

    expect(onSaveRange.mock.calls[0][3].incluyePileta).toBe(true);
  });

  it('la primera cochera toma la patente de la ficha del cliente', async () => {
    render(<ConEstado inicial={{ ...BASE, carpaNumero: 12 }} />);
    await userEvent.click(screen.getByLabelText(/Incluir estacionamiento/));
    expect(screen.getByLabelText(/Patente del vehículo/)).toHaveValue('AC456DE');
  });

  it('con dos cocheras sin plaza manda plazas distintas', async () => {
    const onSaveRange = vi.fn().mockResolvedValue(true);
    render(<ConEstado inicial={{ ...BASE, carpaNumero: 12, cocheras: [{ ...cocheraVacia(), vehiclePlate: 'AB123CD' }] }} onSaveRange={onSaveRange} />);

    await userEvent.click(screen.getByRole('button', { name: /Agregar otra cochera/ }));
    const patentes = screen.getAllByLabelText(/Patente del vehículo/);
    await userEvent.type(patentes[1], 'AC456EF');
    await waitFor(() => expect(guardar()).toBeEnabled());
    await userEvent.click(guardar());

    const cocheras = onSaveRange.mock.calls[0][3].cocheras;
    expect(cocheras.map((c) => c.plaza)).toEqual([1, 2]);
    expect(cocheras[1].vehiclePlate).toBe('AC456EF');
  });

  it('con incluidos y sin cliente guardado no deja guardar', async () => {
    render(<ConEstado inicial={{ ...BASE, carpaNumero: 12, clientId: null, incluyePileta: true }} />);
    expect(await screen.findByText(/elegí un cliente o creá uno nuevo/)).toBeInTheDocument();
    expect(guardar()).toBeDisabled();
  });

  it('con mas personas que el tope no deja guardar', async () => {
    render(<ConEstado inicial={{ ...BASE, carpaNumero: 12, adultsCount: '5', childrenCount: '2' }} />);
    expect(await screen.findByText(/Máximo 6 personas por unidad/)).toBeInTheDocument();
    expect(guardar()).toBeDisabled();
  });

  it('el boton de cliente nuevo abre la ficha', async () => {
    const onNuevoCliente = vi.fn();
    render(<ConEstado inicial={{ ...BASE, carpaNumero: 12 }} onNuevoCliente={onNuevoCliente} />);
    await userEvent.click(screen.getByRole('button', { name: /Nuevo cliente/ }));
    expect(onNuevoCliente).toHaveBeenCalled();
  });
});

describe('alta de sombrilla con servicios incluidos', () => {
  it('la sombrilla no da pases de pileta por defecto', () => {
    render(<ConEstado Modal={SombrillaReservationModal} inicial={{ ...BASE, sombrillaNumero: 3 }} />);
    expect(screen.queryByLabelText(/Incluye pileta/)).toBeNull();
    expect(screen.getByLabelText(/Incluir estacionamiento/)).toBeInTheDocument();
  });
});
