import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import UsuariosPanel from './UsuariosPanel';

const USUARIOS = [
  { id: 2, email: 'admin@balneario.test', rol: 'admin', encargado: true, creado: '2026-10-20T12:00:00.000Z' },
  { id: 8, email: 'caja@balneario.test', rol: 'operador', encargado: false, creado: '2026-10-20T13:00:00.000Z' }
];

const responder = (body, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
const pedidos = () => global.fetch.mock.calls.map(([url, o = {}]) => ({ url: String(url), method: o.method || 'GET', body: o.body ? JSON.parse(o.body) : undefined }));

beforeEach(() => {
  global.fetch = vi.fn((url, o = {}) => {
    const u = String(url);
    if (o.method === 'POST' && /\/api\/usuarios$/.test(u)) {
      const b = JSON.parse(o.body);
      if (b.email === 'admin@balneario.test') return responder({ error: 'email_taken' }, 409);
      return responder({ usuario: { id: 9, email: b.email, rol: b.rol, encargado: false }, clave: 'Kp7m-x4Qz-9tRw' }, 201);
    }
    if (o.method === 'POST' && /\/usuarios\/8\/clave$/.test(u)) return responder({ usuario: USUARIOS[1], clave: 'Ab3d-Ef4h-Jk5m' });
    if (o.method === 'PATCH' || o.method === 'DELETE') return responder({ ok: true });
    return responder({ usuarios: USUARIOS });
  });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('Panel de usuario > Usuarios', () => {
  it('lista al personal; al encargado no se le ofrecen cambios', async () => {
    render(<UsuariosPanel />);
    const lista = await screen.findByRole('list', { name: 'Usuarios del balneario' });
    expect(within(lista).getAllByRole('listitem')).toHaveLength(2);
    expect(within(lista).getByText('Dueño')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitar a admin@balneario.test' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar a caja@balneario.test' })).toBeInTheDocument();
  });

  it('crea un usuario de pileta y muestra la clave una vez', async () => {
    render(<UsuariosPanel />);
    await screen.findByRole('list', { name: 'Usuarios del balneario' });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'pileta@balneario.test' } });
    fireEvent.change(screen.getByLabelText('Rol'), { target: { value: 'pileta' } });
    expect(screen.getByText(/Solo ve los pases de pileta/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Crear usuario' }));

    const aviso = await screen.findByRole('status');
    expect(within(aviso).getByText('Kp7m-x4Qz-9tRw')).toBeInTheDocument();
    expect(pedidos().find((p) => p.method === 'POST').body).toEqual({ email: 'pileta@balneario.test', rol: 'pileta' });
  });

  it('muestra el error de un email repetido', async () => {
    render(<UsuariosPanel />);
    await screen.findByRole('list', { name: 'Usuarios del balneario' });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@balneario.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear usuario' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya hay una cuenta con ese email.');
  });

  it('cambia el rol, genera clave nueva y quita, cada uno con su pedido', async () => {
    render(<UsuariosPanel />);
    await screen.findByRole('list', { name: 'Usuarios del balneario' });

    fireEvent.change(screen.getByLabelText('Rol de caja@balneario.test'), { target: { value: 'pileta' } });
    await waitFor(() => expect(pedidos().some((p) => p.method === 'PATCH')).toBe(true));
    expect(pedidos().find((p) => p.method === 'PATCH')).toMatchObject({ body: { rol: 'pileta' } });

    fireEvent.click(screen.getByRole('button', { name: 'Clave nueva para caja@balneario.test' }));
    expect(await screen.findByText('Ab3d-Ef4h-Jk5m')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Quitar a caja@balneario.test' }));
    await waitFor(() => expect(pedidos().some((p) => p.method === 'DELETE' && /\/usuarios\/8$/.test(p.url))).toBe(true));
  });
});
