import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CarpaReservationModal from './CarpaReservationModal';
import SombrillaReservationModal from './SombrillaReservationModal';
import ParkingReservationModal from './ParkingReservationModal';

// La cantidad de adultos y menores vale para los cuatro servicios, pero los
// campos existian solo en el pase de pileta: en carpa, sombrilla y
// estacionamiento no habia donde cargarla, asi que toda reserva se guardaba
// con cero personas aunque la base y los dos backends ya la aceptaran.

function parseLocal(value) {
  if (!value) return null;
  const [a, m, d] = String(value).split('-').map(Number);
  return new Date(a, m - 1, d);
}

const CLIENTE = { id: 305, fullName: 'Valentina Rios', phone: '2262-445512' };

beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ reservationGroups: [] }) })
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

const MODALES = [
  { nombre: 'carpa', Modal: CarpaReservationModal, clave: 'carpaNumero' },
  { nombre: 'sombrilla', Modal: SombrillaReservationModal, clave: 'sombrillaNumero' },
  { nombre: 'estacionamiento', Modal: ParkingReservationModal, clave: 'plazaNumero' }
];

function formBase(clave, extra = {}) {
  return {
    [clave]: 50,
    isReserved: false,
    startDate: '2026-09-24',
    endDate: '2026-09-26',
    clientId: CLIENTE.id,
    customerName: CLIENTE.fullName,
    customerPhone: CLIENTE.phone,
    dailyPrice: '18000',
    initialPaymentAmount: '',
    initialPaymentMethod: '',
    parkingInitialPaymentAmount: '',
    parkingInitialPaymentMethod: '',
    ...extra
  };
}

function propsBase(onSaveRange, onChangeForm = vi.fn()) {
  return {
    clients: [CLIENTE],
    establishment: { carpasCapacity: 100, sombrillasCapacity: 100, parkingCapacity: 100 },
    error: '',
    parseLocalDateFromInput: parseLocal,
    onChangeForm,
    onSaveRange,
    onReleaseRange: vi.fn(),
    onClose: vi.fn(),
    reservationGroups: []
  };
}

describe.each(MODALES)('personas en el modal de $nombre', ({ Modal, clave }) => {
  it('manda la cantidad de adultos y menores al guardar', async () => {
    const onSaveRange = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();

    render(
      <Modal
        form={formBase(clave, { adultsCount: '3', childrenCount: '2' })}
        {...propsBase(onSaveRange)}
      />
    );

    const guardar = screen.getByRole('button', { name: /Guardar reserva/ });
    await waitFor(() => expect(guardar).toBeEnabled());
    await user.click(guardar);

    expect(onSaveRange).toHaveBeenCalledTimes(1);
    const extra = onSaveRange.mock.calls[0][3];
    expect(extra.adultsCount).toBe('3');
    expect(extra.childrenCount).toBe('2');
  });

  it('tiene campos para cargar adultos y menores', async () => {
    const onChangeForm = vi.fn();
    const user = userEvent.setup();

    render(
      <Modal
        form={formBase(clave, { adultsCount: '', childrenCount: '' })}
        {...propsBase(vi.fn().mockResolvedValue(true), onChangeForm)}
      />
    );

    // Los modales actualizan el form con un updater: se lo aplica al estado
    // previo para ver con que se queda.
    const resultado = (llamada, previo) => llamada.mock.calls.at(-1)[0](previo);

    const adultos = screen.getByLabelText(/adultos/i);
    await user.type(adultos, '4');
    expect(resultado(onChangeForm, { adultsCount: '' })).toEqual(
      expect.objectContaining({ adultsCount: '4' })
    );

    const menores = screen.getByLabelText(/menores/i);
    await user.type(menores, '1');
    expect(resultado(onChangeForm, { childrenCount: '' })).toEqual(
      expect.objectContaining({ childrenCount: '1' })
    );
  });
});
