import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SoportePanel from './SoportePanel';

const HILO = [
  { id: 1, deSoporte: false, tipo: 'error', texto: 'No me deja guardar la carpa 12', pantalla: 'Carpas', leido: true, creado: '2026-10-19T15:00:00.000Z' },
  { id: 2, deSoporte: true, tipo: null, texto: 'Ya lo arreglamos, probá de nuevo', pantalla: null, leido: true, creado: '2026-10-19T16:00:00.000Z' }
];

let respuestaPost;

beforeEach(() => {
  respuestaPost = { ok: true, status: 201, body: { mensaje: { id: 3, deSoporte: false, tipo: 'sugerencia', texto: 'Estaría bueno ver la patente en la grilla', pantalla: 'Estacionamiento', leido: false, creado: '2026-10-19T17:00:00.000Z' } } };
  global.fetch = vi.fn((url, opts = {}) => {
    if (opts.method === 'POST') {
      return Promise.resolve({ ok: respuestaPost.ok, status: respuestaPost.status, json: () => Promise.resolve(respuestaPost.body) });
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ mensajes: HILO }) });
  });
});

describe('panel de soporte del balneario', () => {
  it('muestra el hilo: lo propio con tipo y pantalla, y las respuestas de soporte', async () => {
    const onLeido = vi.fn();
    render(<SoportePanel abierto pestanaInicial="mensajes" pantalla="Carpas" onCerrar={() => {}} onLeido={onLeido} />);

    expect(await screen.findByText('No me deja guardar la carpa 12')).toBeInTheDocument();
    // La etiqueta del tipo va junto a la pantalla, arriba del texto.
    expect(screen.getByText('desde Carpas').parentElement).toHaveTextContent('Error');
    expect(screen.getByText('Ya lo arreglamos, probá de nuevo')).toBeInTheDocument();
    expect(screen.getByText(/^Soporte ·/)).toBeInTheDocument();
    expect(screen.getByText(/Vos ·.*Visto/)).toBeInTheDocument();
    expect(global.fetch.mock.calls[0][0]).toMatch(/\/api\/soporte\/mensajes$/);
    await waitFor(() => expect(onLeido).toHaveBeenCalled());
  });

  it('manda el mensaje con el tipo elegido y la pantalla actual, y limpia la caja', async () => {
    render(<SoportePanel abierto pestanaInicial="mensajes" pantalla="Estacionamiento" onCerrar={() => {}} />);
    await screen.findByText('No me deja guardar la carpa 12');

    fireEvent.click(screen.getByRole('button', { name: 'Sugerencia' }));
    fireEvent.change(screen.getByLabelText('Mensaje'), { target: { value: 'Estaría bueno ver la patente en la grilla' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByText('Estaría bueno ver la patente en la grilla')).toBeInTheDocument();
    const [url, opts] = global.fetch.mock.calls.find(([, o]) => o?.method === 'POST');
    expect(url).toMatch(/\/api\/soporte\/mensajes$/);
    expect(JSON.parse(opts.body)).toEqual({ texto: 'Estaría bueno ver la patente en la grilla', tipo: 'sugerencia', pantalla: 'Estacionamiento' });
    expect(screen.getByLabelText('Mensaje')).toHaveValue('');
  });

  it('sin texto no deja enviar', async () => {
    render(<SoportePanel abierto pestanaInicial="mensajes" pantalla="Inicio" onCerrar={() => {}} />);
    await screen.findByText('No me deja guardar la carpa 12');
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
  });

  it('si la API frena el envio, muestra el aviso y conserva lo escrito', async () => {
    respuestaPost = { ok: false, status: 429, body: { error: 'demasiados_mensajes' } };
    render(<SoportePanel abierto pestanaInicial="mensajes" pantalla="Inicio" onCerrar={() => {}} />);
    await screen.findByText('No me deja guardar la carpa 12');

    fireEvent.change(screen.getByLabelText('Mensaje'), { target: { value: 'hola' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Esperá un minuto');
    expect(screen.getByLabelText('Mensaje')).toHaveValue('hola');
  });

  it('cerrado no pide nada; abierto se cierra con Esc', async () => {
    const onCerrar = vi.fn();
    const { rerender } = render(<SoportePanel abierto={false} pantalla="Inicio" onCerrar={onCerrar} />);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();

    rerender(<SoportePanel abierto pestanaInicial="mensajes" pantalla="Inicio" onCerrar={onCerrar} />);
    await screen.findByRole('dialog', { name: 'Soporte' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCerrar).toHaveBeenCalled();
  });
});
