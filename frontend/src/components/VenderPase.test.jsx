import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PoolPassModal from './PoolPassModal';

// Vender un pase de pileta pago a personas de la carpa que no tienen pase.

function parseLocal(value) {
  if (!value) return null;
  const [a, m, d] = String(value).split('-').map(Number);
  return new Date(a, m - 1, d);
}

const FORM = {
  startDate: '2026-12-01', endDate: '2026-12-05', clientId: 7, customerName: 'Lucia', customerPhone: '',
  poolAdultsCount: '0', poolChildrenCount: '0', poolAdultPricePerDay: '', poolChildPricePerDay: '',
  initialPaymentAmount: '', initialPaymentMethod: '',
  incluidaEnReservaId: 60, carpaEtiqueta: 'Carpa 12', personasElegidas: [],
  personasDisponibles: [
    { key: 'g-13', guestId: 13, fullName: 'Caro', documentNumber: '3', age: 12 },
    { key: 'g-14', guestId: 14, fullName: 'Dani', documentNumber: '4', age: 40 },
    { key: 'g-15', guestId: 15, fullName: 'Eli', documentNumber: null, age: 30 }
  ]
};

function ConEstado({ onSave = vi.fn() }) {
  const [form, setForm] = useState(FORM);
  return (
    <PoolPassModal form={form} clients={[]} establishment={{ hasPileta: true }} error=""
      parseLocalDateFromInput={parseLocal} onChangeForm={setForm} onSave={onSave} onClose={vi.fn()} />
  );
}

describe('vender pase de pileta desde la carpa', () => {
  it('dice a que carpa queda asociado', () => {
    render(<ConEstado />);
    expect(screen.getByText(/Pase pago · Carpa 12/)).toBeInTheDocument();
  });

  it('elegir personas precarga adultos y menores', async () => {
    render(<ConEstado />);
    await userEvent.click(screen.getByLabelText('Vender pase a Caro'));
    await userEvent.click(screen.getByLabelText('Vender pase a Dani'));
    expect(screen.getByLabelText('Cantidad de adultos')).toHaveValue(1);
    expect(screen.getByLabelText(/Cantidad de niños/)).toHaveValue(1);
  });

  it('una persona sin DNI o edad no se puede elegir', () => {
    render(<ConEstado />);
    expect(screen.getByLabelText('Vender pase a Eli')).toBeDisabled();
  });

  it('manda las personas elegidas al guardar', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<ConEstado onSave={onSave} />);
    await userEvent.click(screen.getByLabelText('Vender pase a Dani'));
    await userEvent.type(screen.getByLabelText(/Precio por adulto por día/), '6000');
    await userEvent.click(screen.getByRole('button', { name: /Guardar pase/ }));
    expect(onSave.mock.calls[0][0].personasElegidas).toEqual(['g-14']);
  });

  it('sin personas o sin precio no se guarda: el pase quedaria en $0', async () => {
    render(<ConEstado />);
    expect(screen.getByRole('button', { name: /Guardar pase/ })).toBeDisabled();
    expect(screen.getByText(/Cargá cuántos adultos y niños van/)).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Vender pase a Caro'));
    await userEvent.click(screen.getByLabelText('Vender pase a Dani'));
    expect(screen.getByText(/Cargá el precio por día de adultos y de niños/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Precio por adulto por día/), '6000');
    expect(screen.getByText(/Cargá el precio por día de niños/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar pase/ })).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/Precio por niño por día/), '4000');
    expect(screen.getByRole('button', { name: /Guardar pase/ })).toBeEnabled();
  });
});
