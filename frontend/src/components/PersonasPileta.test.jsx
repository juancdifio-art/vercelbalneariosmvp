import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PersonasReserva from './PersonasReserva';

// Pases de pileta con nombre: el tilde "Pileta" en la lista de personas de la carpa.

let guests;
let pasePersonas;
let pagoPersonas;
let puts;

beforeEach(() => {
  sessionStorage.setItem('authToken', 'tok');
  puts = [];
  guests = [
    { id: 11, fullName: 'Ana', documentNumber: '1', age: 40 },
    { id: 12, fullName: 'Beto', documentNumber: null, age: 10 },
    { id: 13, fullName: 'Caro', documentNumber: '3', age: 12 }
  ];
  pasePersonas = [{ clientId: 7, fullName: 'Lucia', documentNumber: '30111222', edad: 36 }];
  pagoPersonas = [{ guestId: 13, fullName: 'Caro' }];
  global.fetch = vi.fn((url, opts = {}) => {
    const u = String(url);
    let body = {};
    if (u.includes('/guests')) body = { guests };
    if (u.includes('/501/pase-personas')) {
      if (opts.method === 'PUT') {
        const pedido = JSON.parse(opts.body);
        puts.push(pedido);
        pasePersonas = [
          ...(pedido.incluyeTitular ? [{ clientId: 7, fullName: 'Lucia' }] : []),
          ...pedido.guestIds.map((id) => ({ guestId: id, fullName: guests.find((g) => g.id === id).fullName }))
        ];
      }
      body = { personas: pasePersonas };
    }
    if (u.includes('/503/pase-personas')) body = { personas: pagoPersonas };
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
  });
});
afterEach(() => vi.restoreAllMocks());

const TITULAR = { id: 7, fullName: 'Lucia', documentNumber: '30111222', birthDate: '1990-05-01' };

function renderPersonas(props = {}) {
  return render(
    <PersonasReserva
      reservationGroupId={60} adultsCount={2} childrenCount={2}
      titular={TITULAR} paseIncluido={{ id: 501, max: 4 }} pasesPagos={[503]}
      {...props}
    />
  );
}

const fila = (nombre) => screen.getByText(nombre).closest('li');

describe('pases de pileta en la lista de personas', () => {
  it('muestra al titular primero y cuantos pases hay asignados', async () => {
    renderPersonas();
    await screen.findByText('Ana');
    const filas = screen.getAllByRole('listitem');
    expect(within(filas[0]).getByText('Lucia')).toBeInTheDocument();
    expect(within(filas[0]).getByText('Titular')).toBeInTheDocument();
    expect(await screen.findByText('1 de 4 pases asignados')).toBeInTheDocument();
    expect(within(fila('Lucia')).getByRole('checkbox')).toBeChecked();
  });

  it('tildar a una persona completa le da el pase', async () => {
    renderPersonas();
    await screen.findByText('Ana');
    await userEvent.click(within(fila('Ana')).getByRole('checkbox'));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({ guestIds: [11], incluyeTitular: true });
    expect(await screen.findByText('2 de 4 pases asignados')).toBeInTheDocument();
  });

  it('sin DNI o edad no se puede tildar', async () => {
    renderPersonas();
    await screen.findByText('Beto');
    expect(within(fila('Beto')).getByRole('checkbox')).toBeDisabled();
    expect(within(fila('Beto')).getByText(/Completá DNI y edad/)).toBeInTheDocument();
  });

  it('quien tiene un pase pago lo muestra en vez del tilde', async () => {
    renderPersonas();
    await screen.findByText('Caro');
    await waitFor(() => expect(within(fila('Caro')).getByText('Pase pago')).toBeInTheDocument());
    expect(within(fila('Caro')).queryByRole('checkbox')).toBeNull();
  });

  it('con los pases completos no deja tildar a nadie mas', async () => {
    renderPersonas({ paseIncluido: { id: 501, max: 1 } });
    await screen.findByText('1 de 1 pases asignados');
    expect(within(fila('Ana')).getByRole('checkbox')).toBeDisabled();
  });

  it('sin pileta incluida no hay tildes', async () => {
    renderPersonas({ paseIncluido: null, pasesPagos: [] });
    await screen.findByText('Ana');
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });
});

describe('aviso de personas cargadas', () => {
  it('cuenta al titular: con titular y 3 acompanantes de 4 personas no falta nadie', async () => {
    renderPersonas();
    await screen.findByText('Ana');
    expect(screen.queryByText(/Cargaste/)).toBeNull();
  });

  it('sin titular avisa los que faltan', async () => {
    renderPersonas({ titular: null });
    expect(await screen.findByText('Cargaste 3 de 4 personas')).toBeInTheDocument();
  });
});
