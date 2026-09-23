import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CarpaReservationModal from './CarpaReservationModal';
import ParkingReservationModal from './ParkingReservationModal';
import ReservationEditModal from './ReservationEditModal';

// La patente es obligatoria para usar el estacionamiento.

function parseLocal(value) {
  if (!value) return null;
  const [a, m, d] = String(value).split('-').map(Number);
  return new Date(a, m - 1, d);
}

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ reservationGroups: [] }) }));
});
afterEach(() => vi.restoreAllMocks());

const BASE = {
  isReserved: false,
  startDate: '2026-09-26',
  endDate: '2026-09-30',
  clientId: null,
  customerName: 'Lucia',
  customerPhone: '',
  dailyPrice: '',
  initialPaymentAmount: '',
  initialPaymentMethod: '',
  parkingSpotNumber: 3,
  parkingDailyPrice: '',
  parkingInitialPaymentAmount: '',
  parkingInitialPaymentMethod: ''
};

function ConEstado({ Modal, inicial, onSaveRange, clients = [] }) {
  const [form, setForm] = useState(inicial);
  return (
    <Modal
      form={form}
      clients={clients}
      establishment={{ carpasCapacity: 100, hasParking: true, parkingCapacity: 10 }}
      error=""
      parseLocalDateFromInput={parseLocal}
      onChangeForm={setForm}
      onSaveRange={onSaveRange}
      onReleaseRange={vi.fn()}
      onClose={vi.fn()}
      reservationGroups={[]}
    />
  );
}

const guardar = () => screen.getByRole('button', { name: /Guardar reserva/ });

describe('patente en el alta de carpa con estacionamiento', () => {
  it('sin patente no deja guardar y avisa', async () => {
    render(<ConEstado Modal={CarpaReservationModal} inicial={{ ...BASE, carpaNumero: 58, includeParking: true }} onSaveRange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/Falta la patente del vehículo/)).toBeInTheDocument());
    expect(guardar()).toBeDisabled();
  });

  it('con patente guarda y la manda normalizada', async () => {
    const onSaveRange = vi.fn().mockResolvedValue(true);
    render(<ConEstado Modal={CarpaReservationModal} inicial={{ ...BASE, carpaNumero: 58, includeParking: true }} onSaveRange={onSaveRange} />);
    await userEvent.type(screen.getByLabelText(/Patente del vehículo/), 'ab 123 cd');
    await waitFor(() => expect(guardar()).toBeEnabled());
    await userEvent.click(guardar());
    expect(onSaveRange.mock.calls[0][3].vehiclePlate).toBe('AB123CD');
  });

  it('sin estacionamiento no la pide', async () => {
    render(<ConEstado Modal={CarpaReservationModal} inicial={{ ...BASE, carpaNumero: 58, includeParking: false }} onSaveRange={vi.fn()} />);
    expect(screen.queryByLabelText(/Patente del vehículo/)).not.toBeInTheDocument();
    await waitFor(() => expect(guardar()).toBeEnabled());
  });
});

describe('patente en el alta de estacionamiento', () => {
  it('es obligatoria siempre', async () => {
    render(<ConEstado Modal={ParkingReservationModal} inicial={{ ...BASE, plazaNumero: 3 }} onSaveRange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/Falta la patente del vehículo/)).toBeInTheDocument());
    expect(guardar()).toBeDisabled();
  });

  it('se completa sola con la de la ficha del cliente', async () => {
    const clients = [{ id: 9, fullName: 'Lucia Fernandez', phone: '2262', vehiclePlate: 'AC456DE' }];
    render(<ConEstado Modal={ParkingReservationModal} inicial={{ ...BASE, plazaNumero: 3, customerName: '' }} onSaveRange={vi.fn()} clients={clients} />);
    await userEvent.type(screen.getByLabelText('Buscar cliente guardado'), 'Lucia');
    await userEvent.click(await screen.findByText('Lucia Fernandez'));
    expect(screen.getByLabelText(/Patente del vehículo/)).toHaveValue('AC456DE');
  });
});

describe('patente al editar un estacionamiento', () => {
  it('no deja guardar si se borra', async () => {
    function Editor() {
      const [modal, setModal] = useState({ id: 1, serviceType: 'parking', resourceNumber: 3, startDate: '2026-09-26', endDate: '2026-09-30', tempVehiclePlate: 'AB123CD', tempNotes: '' });
      return <ReservationEditModal modal={modal} setModal={setModal} saving={false} onSave={vi.fn()} onClose={vi.fn()} establishment={{ parkingCapacity: 10 }} reservationGroups={[]} parseLocalDateFromInput={parseLocal} />;
    }
    render(<Editor />);
    const campo = screen.getByLabelText(/Patente del vehículo/);
    const boton = screen.getByRole('button', { name: /Guardar cambios/ });
    expect(boton).toBeEnabled();
    await userEvent.clear(campo);
    expect(boton).toBeDisabled();
  });
});
