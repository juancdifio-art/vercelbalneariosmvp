import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CarpaReservationModal from './CarpaReservationModal';

// Datos de cada persona y pases de pileta, cargados en el alta de la carpa.

function parseLocal(value) {
  if (!value) return null;
  const [a, m, d] = String(value).split('-').map(Number);
  return new Date(a, m - 1, d);
}

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ reservationGroups: [] }) }));
});
afterEach(() => vi.restoreAllMocks());

const CLIENTE = { id: 7, fullName: 'Lucia', documentNumber: '30111222', birthDate: '1990-05-01' };
const BASE = {
  carpaNumero: 12, isReserved: false, startDate: '2026-12-01', endDate: '2026-12-05',
  clientId: 7, customerName: 'Lucia', customerPhone: '', adultsCount: '2', childrenCount: '2',
  initialPaymentAmount: '', initialPaymentMethod: '', cocheras: [], incluyePileta: false
};

function ConEstado({ inicial = BASE, onSaveRange = vi.fn().mockResolvedValue(true), clientes = [CLIENTE] }) {
  const [form, setForm] = useState(inicial);
  return (
    <CarpaReservationModal
      form={form} clients={clientes} establishment={{ carpasCapacity: 100, hasParking: false, hasPileta: true }}
      error="" parseLocalDateFromInput={parseLocal} onChangeForm={setForm} onSaveRange={onSaveRange}
      onReleaseRange={vi.fn()} onClose={vi.fn()} reservationGroups={[]} onNuevoCliente={vi.fn()}
    />
  );
}

const cargar = async (n, nombre, dni, edad) => {
  await userEvent.type(screen.getByLabelText(`Nombre del acompañante ${n}`), nombre);
  if (dni) await userEvent.type(screen.getByLabelText(`DNI del acompañante ${n}`), dni);
  if (edad) await userEvent.type(screen.getByLabelText(`Edad del acompañante ${n}`), edad);
};

describe('personas en el alta de la carpa', () => {
  it('una fila por persona: el titular con los datos de su ficha y los acompanantes', () => {
    render(<ConEstado />);
    expect(screen.getByLabelText('DNI del titular')).toHaveValue('30111222');
    expect(screen.getByLabelText('Fecha de nacimiento del titular')).toHaveValue('1990-05-01');
    expect(screen.getByLabelText('Nombre del acompañante 3')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nombre del acompañante 4')).toBeNull();
  });

  it('con pileta, un click en cada persona le da o le saca el pase', async () => {
    render(<ConEstado inicial={{ ...BASE, incluyePileta: true }} />);
    await cargar(1, 'Ana', '1', '40');

    const ana = screen.getByRole('button', { name: 'Pase de pileta para Ana' });
    expect(ana).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('2 de 4 pases elegidos')).toBeInTheDocument();

    await userEvent.click(ana);
    expect(ana).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('1 de 4 pases elegidos')).toBeInTheDocument();
  });

  it('sin DNI o edad no se puede elegir', async () => {
    render(<ConEstado inicial={{ ...BASE, incluyePileta: true }} />);
    await cargar(1, 'Beto', '', '10');
    expect(screen.getByRole('button', { name: 'Pase de pileta para Beto' })).toBeDisabled();
  });

  it('con 4 elegidos no deja elegir un quinto', async () => {
    render(<ConEstado inicial={{ ...BASE, adultsCount: '6', childrenCount: '0', incluyePileta: true }} />);
    await cargar(1, 'Ana', '1', '40');
    await cargar(2, 'Caro', '3', '12');
    await cargar(3, 'Dani', '4', '15');
    await cargar(4, 'Eli', '5', '30');
    expect(screen.getByText('4 de 4 pases elegidos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pase de pileta para Eli' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pase de pileta para Eli' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('al guardar manda las personas de esta reserva y los datos del titular', async () => {
    const onSaveRange = vi.fn().mockResolvedValue(true);
    render(<ConEstado inicial={{ ...BASE, incluyePileta: true }} onSaveRange={onSaveRange} />);
    await cargar(1, 'Ana', '1', '40');
    const guardar = screen.getByRole('button', { name: /Guardar reserva/ });
    await waitFor(() => expect(guardar).toBeEnabled());
    await userEvent.click(guardar);

    const extra = onSaveRange.mock.calls[0][3];
    expect(extra.titular).toEqual({ documentNumber: '30111222', birthDate: '1990-05-01', pileta: true });
    expect(extra.personas).toEqual([{ fullName: 'Ana', documentNumber: '1', age: '40', pileta: true }]);
  });
});
