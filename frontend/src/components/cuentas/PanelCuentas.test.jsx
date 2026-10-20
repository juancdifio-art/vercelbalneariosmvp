import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import PanelCuentas from './PanelCuentas';

const CUENTAS = [
  { id: 30, email: 'poseidon@balneario.com', rol: 'admin', administra: false, creada: '2026-10-20T12:00:00.000Z', balneario: null, reservas: 0 },
  { id: 2, email: 'admin@balneario.com', rol: 'admin', administra: true, creada: '2025-11-23T10:00:00.000Z', balneario: { id: 1, nombre: 'Zeus' }, reservas: 271 },
  { id: 5, email: 'prueba@vercel.test', rol: 'admin', administra: false, creada: '2026-10-19T10:00:00.000Z', balneario: { id: 4, nombre: 'Simulación' }, reservas: 1 },
  { id: 6, email: 'soporte@infinite.test', rol: 'soporte', administra: false, creada: '2026-10-19T10:00:00.000Z', balneario: null, reservas: 0 }
];

const responder = (body, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
const pedidos = () => global.fetch.mock.calls.map(([url, opts = {}]) => ({ url, method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : undefined }));

beforeEach(() => {
  global.fetch = vi.fn((url, opts = {}) => {
    if (opts.method === 'POST' && /\/api\/cuentas$/.test(url)) {
      const body = JSON.parse(opts.body);
      if (body.email === 'admin@balneario.com') return responder({ error: 'email_taken' }, 409);
      return responder({
        cuenta: { id: 40, email: body.email, rol: 'admin', administra: false, creada: '2026-10-20T13:00:00.000Z', balneario: body.copiarDe ? { id: 9, nombre: body.nombre } : null, reservas: 0 },
        clave: 'Kp7m-x4Qz-9tRw'
      }, 201);
    }
    if (opts.method === 'POST' && /\/api\/cuentas\/5\/clave$/.test(url)) {
      return responder({ cuenta: { id: 5, email: 'prueba@vercel.test' }, clave: 'Ab3d-Ef4h-Jk5m' });
    }
    if (/\/api\/cuentas$/.test(url)) return responder({ cuentas: CUENTAS });
    return responder({ error: 'not_found' }, 404);
  });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('panel de cuentas', () => {
  it('lista las cuentas con su balneario y sus reservas', async () => {
    render(<PanelCuentas userEmail="admin@balneario.com" onLogout={() => {}} />);

    const lista = await screen.findByRole('list', { name: 'Cuentas' });
    expect(within(lista).getAllByRole('listitem')).toHaveLength(4);
    expect(within(lista).getByText(/Zeus · 271 reservas/)).toBeInTheDocument();
    expect(within(lista).getByText(/Simulación · 1 reserva ·/)).toBeInTheDocument();
    expect(within(lista).getAllByText(/Sin balneario/)).toHaveLength(2);
    expect(within(lista).getByText('Administrador')).toBeInTheDocument();
    expect(within(lista).getByText('Soporte')).toBeInTheDocument();
  });

  it('no ofrece clave nueva para la cuenta propia ni para otro administrador', async () => {
    render(<PanelCuentas userEmail="admin@balneario.com" onLogout={() => {}} />);
    await screen.findByRole('list', { name: 'Cuentas' });

    expect(screen.queryByRole('button', { name: 'Clave nueva para admin@balneario.com' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clave nueva para prueba@vercel.test' })).toBeInTheDocument();
  });

  it('crea una cuenta sin balneario y muestra la clave una vez', async () => {
    render(<PanelCuentas userEmail="admin@balneario.com" onLogout={() => {}} />);
    await screen.findByRole('list', { name: 'Cuentas' });

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nuevo@balneario.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    const aviso = await screen.findByRole('status');
    expect(within(aviso).getByText('Cuenta creada')).toBeInTheDocument();
    expect(within(aviso).getByText('nuevo@balneario.com')).toBeInTheDocument();
    expect(within(aviso).getByText('Kp7m-x4Qz-9tRw')).toBeInTheDocument();
    expect(pedidos().find((p) => p.method === 'POST').body).toEqual({ email: 'nuevo@balneario.com' });

    fireEvent.click(within(aviso).getByRole('button', { name: 'Listo' }));
    expect(screen.queryByText('Kp7m-x4Qz-9tRw')).not.toBeInTheDocument();
  });

  it('con un modelo pide el nombre y manda de que balneario copiar', async () => {
    render(<PanelCuentas userEmail="admin@balneario.com" onLogout={() => {}} />);
    await screen.findByRole('list', { name: 'Cuentas' });

    // Solo se ofrecen como modelo las cuentas que tienen balneario.
    const opciones = within(screen.getByLabelText('Configuración')).getAllByRole('option').map((o) => o.textContent);
    expect(opciones).toEqual(['Ninguna: el cliente la carga al entrar', 'Copiar de Zeus', 'Copiar de Simulación']);

    expect(screen.queryByLabelText('Nombre del balneario')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Configuración'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'zeus@balneario.com' } });
    fireEvent.change(screen.getByLabelText('Nombre del balneario'), { target: { value: 'Balneario Zeus' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    const aviso = await screen.findByRole('status');
    expect(within(aviso).getByText('Balneario Zeus')).toBeInTheDocument();
    expect(pedidos().find((p) => p.method === 'POST').body).toEqual({ email: 'zeus@balneario.com', copiarDe: 1, nombre: 'Balneario Zeus' });
  });

  it('muestra el error de un email repetido', async () => {
    render(<PanelCuentas userEmail="admin@balneario.com" onLogout={() => {}} />);
    await screen.findByRole('list', { name: 'Cuentas' });

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@balneario.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByText('Ya hay una cuenta con ese email.')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('genera una clave nueva despues de confirmar', async () => {
    render(<PanelCuentas userEmail="admin@balneario.com" onLogout={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Clave nueva para prueba@vercel.test' }));

    const aviso = await screen.findByRole('status');
    expect(within(aviso).getByText('Clave nueva')).toBeInTheDocument();
    expect(within(aviso).getByText('Ab3d-Ef4h-Jk5m')).toBeInTheDocument();
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('prueba@vercel.test'));
  });

  it('si no se confirma no pide nada', async () => {
    window.confirm.mockReturnValue(false);
    render(<PanelCuentas userEmail="admin@balneario.com" onLogout={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Clave nueva para prueba@vercel.test' }));

    expect(pedidos().some((p) => p.method === 'POST')).toBe(false);
  });

  it('sola tiene su cerrar sesion; embebida no', async () => {
    const onLogout = vi.fn();
    const { unmount } = render(<PanelCuentas userEmail="admin@balneario.com" onLogout={onLogout} />);
    fireEvent.click(screen.getByRole('button', { name: /Cerrar sesión/ }));
    expect(onLogout).toHaveBeenCalled();
    unmount();

    render(<PanelCuentas embebida userEmail="admin@balneario.com" />);
    expect(screen.queryByRole('button', { name: /Cerrar sesión/ })).not.toBeInTheDocument();
    await screen.findByRole('list', { name: 'Cuentas' });
  });
});

describe('panel de cuentas con personal de un balneario', () => {
  it('el personal figura con su rol y su balneario no se repite como modelo', async () => {
    const conPersonal = [
      { id: 2, email: 'admin@balneario.com', rol: 'admin', administra: true, creada: '2025-11-23T10:00:00.000Z', balneario: { id: 1, nombre: 'Zeus' }, encargado: true, reservas: 271 },
      { id: 8, email: 'caja@balneario.test', rol: 'operador', administra: false, creada: '2026-10-20T13:00:00.000Z', balneario: { id: 1, nombre: 'Zeus' }, encargado: false, reservas: 271 }
    ];
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ cuentas: conPersonal }) }));
    render(<PanelCuentas userEmail="admin@balneario.com" onLogout={() => {}} />);

    const lista = await screen.findByRole('list', { name: 'Cuentas' });
    expect(within(lista).getByText('Empleado')).toBeInTheDocument();
    const opciones = within(screen.getByLabelText('Configuración')).getAllByRole('option').map((o) => o.textContent);
    expect(opciones).toEqual(['Ninguna: el cliente la carga al entrar', 'Copiar de Zeus']);
  });
});
