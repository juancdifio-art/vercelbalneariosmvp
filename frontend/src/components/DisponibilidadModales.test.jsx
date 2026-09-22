import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CarpaReservationModal from './CarpaReservationModal';
import ParkingReservationModal from './ParkingReservationModal';

// Los modales de alta mostraban libre lo que estaba ocupado: miraban la lista
// de reservas de la seccion (en Carpas, solo carpas y solo 30 dias). Ahora le
// preguntan al servidor por todo el periodo. Estos tests simulan esa respuesta.

function parseLocal(value) {
  if (!value) return null;
  const [a, m, d] = String(value).split('-').map(Number);
  return new Date(a, m - 1, d);
}

const reserva = (serviceType, resourceNumber, startDate, endDate) => ({
  id: `${serviceType}-${resourceNumber}`, serviceType, resourceNumber, startDate, endDate, status: 'active'
});

// El caso de la captura: la plaza 1 ocupada por una estadia de temporada, y la
// carpa 50 tomada recien a los 150 dias, fuera de los 30 que ve la grilla.
const OCUPADAS = {
  parking: [reserva('parking', 1, '2026-09-22', '2027-03-28')],
  carpa: [reserva('carpa', 50, '2027-02-20', '2027-02-28')]
};

beforeEach(() => {
  global.fetch = vi.fn((url) => {
    const servicio = new URL(url, 'http://x').searchParams.get('service');
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ reservationGroups: OCUPADAS[servicio] || [] })
    });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function modalCarpa(form, onSaveRange = vi.fn().mockResolvedValue(true)) {
  render(
    <CarpaReservationModal
      form={{
        carpaNumero: 10,
        isReserved: false,
        startDate: '2026-09-22',
        endDate: '2027-04-10', // 201 dias
        clientId: null,
        customerName: 'Prueba',
        customerPhone: '',
        dailyPrice: '15000',
        includeParking: true,
        parkingSpotNumber: null,
        parkingDailyPrice: '4000',
        initialPaymentAmount: '',
        initialPaymentMethod: '',
        parkingInitialPaymentAmount: '',
        parkingInitialPaymentMethod: '',
        ...form
      }}
      clients={[]}
      establishment={{ carpasCapacity: 100, hasParking: true, parkingCapacity: 5 }}
      error=""
      parseLocalDateFromInput={parseLocal}
      onChangeForm={vi.fn()}
      onSaveRange={onSaveRange}
      onReleaseRange={vi.fn()}
      onClose={vi.fn()}
      reservationGroups={[]}
    />
  );
  return onSaveRange;
}

describe('disponibilidad en el alta de carpa con estacionamiento', () => {
  it('marca ocupada la plaza tomada por una estadia larga', async () => {
    modalCarpa({});
    expect(await screen.findByRole('option', { name: 'Plaza 1 (ocupada)' })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Plaza 2' })).toBeEnabled();
  });

  it('marca ocupada una carpa tomada despues de los 30 dias de la grilla', async () => {
    modalCarpa({});
    expect(await screen.findByRole('option', { name: 'Carpa 50 (ocupada)' })).toBeDisabled();
  });

  it('con una plaza ocupada elegida, avisa y no deja guardar', async () => {
    modalCarpa({ parkingSpotNumber: 1 });
    expect(await screen.findByText(/La plaza 1 está ocupada/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar reserva/ })).toBeDisabled();
  });

  it('con la carpa elegida ocupada en algun dia, avisa y no deja guardar', async () => {
    modalCarpa({ carpaNumero: 50 });
    expect(await screen.findByText(/La carpa 50 está ocupada/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar reserva/ })).toBeDisabled();
  });

  it('sin plaza elegida, asigna la primera libre en todo el periodo', async () => {
    const user = userEvent.setup();
    const onSaveRange = modalCarpa({ parkingSpotNumber: null });

    const guardar = screen.getByRole('button', { name: /Guardar reserva/ });
    await waitFor(() => expect(guardar).toBeEnabled());
    await user.click(guardar);

    // La 1 esta ocupada todo el periodo: le toca la 2.
    expect(onSaveRange.mock.calls[0][3].parkingSpotNumber).toBe(2);
  });
});

describe('disponibilidad en el alta de estacionamiento', () => {
  it('no da por libre la plaza elegida si esta ocupada', async () => {
    render(
      <ParkingReservationModal
        form={{
          plazaNumero: 1,
          isReserved: false,
          startDate: '2026-12-01',
          endDate: '2026-12-05',
          clientId: null,
          customerName: 'Prueba',
          customerPhone: '',
          dailyPrice: '4000',
          initialPaymentAmount: '',
          initialPaymentMethod: ''
        }}
        clients={[]}
        establishment={{ parkingCapacity: 5 }}
        error=""
        parseLocalDateFromInput={parseLocal}
        onChangeForm={vi.fn()}
        onSaveRange={vi.fn()}
        onReleaseRange={vi.fn()}
        onClose={vi.fn()}
        reservationGroups={[]}
      />
    );

    // Antes la plaza ya elegida se daba siempre por libre.
    expect(await screen.findByText(/La plaza 1 está ocupada/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar reserva/ })).toBeDisabled();
  });
});
