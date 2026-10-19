import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import BandejaSoporte from './BandejaSoporte';

const LISTA = [
  { id: 2, nombre: 'Poseidon', noLeidos: 1, ultimo: { texto: 'No anda el pago', deSoporte: false, creado: '2026-10-19T12:00:00.000Z' } },
  { id: 1, nombre: 'Zeus', noLeidos: 0, ultimo: { texto: 'Listo, gracias', deSoporte: true, creado: '2026-10-18T12:00:00.000Z' } },
  { id: 3, nombre: 'Apolo', noLeidos: 0, ultimo: null }
];
const HILO_POSEIDON = [
  { id: 7, deSoporte: false, tipo: 'error', texto: 'No anda el pago', pantalla: 'Reservas', leido: true, creado: '2026-10-19T12:00:00.000Z' }
];

const responder = (body, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

beforeEach(() => {
  global.fetch = vi.fn((url, opts = {}) => {
    if (opts.method === 'POST') {
      return responder({ mensaje: { id: 8, deSoporte: true, tipo: null, texto: 'Ya lo revisamos', pantalla: null, leido: false, creado: '2026-10-19T13:00:00.000Z' } }, 201);
    }
    if (/\/bandeja\/2$/.test(url)) return responder({ mensajes: HILO_POSEIDON });
    if (/\/bandeja$/.test(url)) return responder({ establecimientos: LISTA });
    return responder({ error: 'not_found' }, 404);
  });
});

describe('bandeja de soporte', () => {
  it('lista los balnearios con lo que espera respuesta y el total sin leer', async () => {
    render(<BandejaSoporte userEmail="soporte@infinite.test" onLogout={() => {}} />);

    const lista = await screen.findByRole('navigation', { name: 'Balnearios' });
    const items = await within(lista).findAllByRole('button');
    expect(items.map((b) => within(b).getAllByText(/./)[0].textContent)).toEqual(['Poseidon', 'Zeus', 'Apolo']);
    expect(within(lista).getByLabelText('1 sin leer')).toBeInTheDocument();
    expect(within(lista).getByText('Vos: Listo, gracias')).toBeInTheDocument();
    expect(within(lista).getByText('Sin mensajes')).toBeInTheDocument();
  });

  it('abre el hilo de un balneario y responde', async () => {
    render(<BandejaSoporte userEmail="soporte@infinite.test" onLogout={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: /Poseidon/ }));

    expect(await screen.findByText('desde Reservas')).toBeInTheDocument();
    expect(screen.getAllByText('No anda el pago').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('Mensaje'), { target: { value: 'Ya lo revisamos' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByText('Ya lo revisamos')).toBeInTheDocument();
    const [url, opts] = global.fetch.mock.calls.find(([, o]) => o?.method === 'POST');
    expect(url).toMatch(/\/api\/soporte\/bandeja\/2$/);
    expect(JSON.parse(opts.body)).toEqual({ texto: 'Ya lo revisamos' });
    // Soporte no elige tipo: eso es del balneario.
    expect(screen.queryByRole('group', { name: 'Tipo de mensaje' })).toBeNull();
  });

  it('cerrar sesion llama a onLogout', async () => {
    const onLogout = vi.fn();
    render(<BandejaSoporte userEmail="soporte@infinite.test" onLogout={onLogout} />);
    fireEvent.click(screen.getByRole('button', { name: /Cerrar sesión/ }));
    expect(onLogout).toHaveBeenCalled();
  });
});
