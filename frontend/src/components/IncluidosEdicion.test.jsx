import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReservationEditModal from './ReservationEditModal';

// Edicion de una carpa con servicios incluidos, y de los incluidos mismos.

function parseLocal(value) {
  if (!value) return null;
  const [a, m, d] = String(value).split('-').map(Number);
  return new Date(a, m - 1, d);
}

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ reservationGroups: [] }) }));
});
afterEach(() => vi.restoreAllMocks());

const ESTABLECIMIENTO = { carpasCapacity: 100, hasParking: true, parkingCapacity: 10, hasPileta: true };

function Editor({ inicial, onSave = vi.fn(), onIrALaReserva = vi.fn(), espiar }) {
  const [modal, setModal] = useState(inicial);
  if (espiar) espiar(modal);
  return (
    <ReservationEditModal
      modal={modal} setModal={setModal} saving={false} onSave={onSave} onClose={vi.fn()}
      establishment={ESTABLECIMIENTO} reservationGroups={[]} parseLocalDateFromInput={parseLocal}
      onIrALaReserva={onIrALaReserva}
    />
  );
}

const CARPA = {
  id: 60, serviceType: 'carpa', resourceNumber: 12, startDate: '2026-12-01', endDate: '2026-12-05', clientId: 7,
  tempNotes: '', tempCustomerName: 'Lucia', tempCustomerPhone: '', tempPrecio: { cobrado: '1000', motivo: '', precioTarifa: 1000 },
  incluidos: { pileta: { id: 501, asignados: 2 }, cocheras: [{ id: 502, plaza: 45, vehiclePlate: 'AB123CD' }], pasesPagos: [] }
};

describe('editar el pase de pileta incluido', () => {
  it('no se edita: ofrece ir a la reserva de la carpa', async () => {
    const onIrALaReserva = vi.fn();
    render(<Editor onIrALaReserva={onIrALaReserva} inicial={{ id: 501, serviceType: 'pileta', vinculo: 'incluido', incluidaEnReservaId: 60, incluidaEnTipo: 'carpa', incluidaEnNumero: 12, startDate: '2026-12-01', endDate: '2026-12-05', tempNotes: '' }} />);

    expect(screen.getByText(/Incluido en Carpa 12/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Guardar cambios/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Ir a la reserva/ }));
    expect(onIrALaReserva).toHaveBeenCalledWith(expect.objectContaining({ incluidaEnReservaId: 60 }));
  });
});

describe('editar una cochera incluida', () => {
  it('las fechas se cambian desde la carpa; la patente se puede cambiar', async () => {
    render(<Editor inicial={{ id: 502, serviceType: 'parking', resourceNumber: 45, vinculo: 'incluido', incluidaEnReservaId: 60, incluidaEnTipo: 'carpa', incluidaEnNumero: 12, startDate: '2026-12-01', endDate: '2026-12-05', tempVehiclePlate: 'AB123CD', tempNotes: '', tempPrecio: { cobrado: '', motivo: '' } }} />);

    expect(screen.getByText(/Incluido en Carpa 12/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Fecha de entrada/)).toBeDisabled();
    expect(screen.getByLabelText(/Patente del vehículo/)).toBeEnabled();
  });
});

describe('editar una carpa con servicios incluidos', () => {
  it('muestra las cocheras incluidas y permite quitar una', async () => {
    let ultimo;
    render(<Editor inicial={CARPA} espiar={(m) => { ultimo = m; }} />);

    expect(screen.getByText(/Plaza 45/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Quitar cochera de la plaza 45/ }));
    expect(ultimo.tempCocherasCanceladas).toEqual([502]);
    expect(screen.getByText(/Se cancela al guardar/)).toBeInTheDocument();
  });

  it('permite quitar la pileta incluida', async () => {
    let ultimo;
    render(<Editor inicial={CARPA} espiar={(m) => { ultimo = m; }} />);

    const pileta = screen.getByLabelText(/Incluye pileta/);
    expect(pileta).toBeChecked();
    await userEvent.click(pileta);
    expect(ultimo.tempIncluyePileta).toBe(false);
  });

  it('agregar una cochera manda la plaza que asignaria el sistema', async () => {
    const onSave = vi.fn();
    render(<Editor inicial={CARPA} onSave={onSave} />);

    await userEvent.click(screen.getByLabelText(/Agregar otra cochera incluida/));
    await userEvent.type(screen.getAllByLabelText(/Patente del vehículo/)[0], 'AC456EF');
    const guardar = screen.getByRole('button', { name: /Guardar cambios/ });
    await waitFor(() => expect(guardar).toBeEnabled());
    await userEvent.click(guardar);

    expect(onSave).toHaveBeenCalledWith({ plazasCocheras: [1] });
  });

  it('sin cliente guardado no deja agregar incluidos', async () => {
    render(<Editor inicial={{ ...CARPA, clientId: null, incluidos: null, tempIncluyePileta: true }} />);
    expect(screen.getByText(/elegí un cliente o creá uno nuevo/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar cambios/ })).toBeDisabled();
  });
});
