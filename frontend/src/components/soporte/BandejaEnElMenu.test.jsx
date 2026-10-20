import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import AuthenticatedShell from '../AuthenticatedShell';

const NAV = [
  { id: 'inicio', label: 'Inicio', group: 'principal' },
  { id: 'clientes', label: 'Clientes', group: 'admin' }
];

let contador;

beforeEach(() => {
  contador = { noLeidos: 0 };
  global.fetch = vi.fn((url) => {
    if (/\/soporte\/no-leidos$/.test(url)) return Promise.resolve({ ok: true, json: () => Promise.resolve(contador) });
    if (/\/soporte\/bandeja$/.test(url)) return Promise.resolve({ ok: true, json: () => Promise.resolve({ establecimientos: [] }) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
});

const shell = (props = {}) => (
  <AuthenticatedShell
    establishment={{ name: 'Zeus' }}
    userEmail="admin@balneario.com"
    activeSection="inicio"
    onChangeSection={() => {}}
    sidebarCollapsed={false}
    onToggleSidebar={() => {}}
    onLogout={() => {}}
    navItems={NAV}
    {...props}
  >
    <p>Contenido del balneario</p>
  </AuthenticatedShell>
);

describe('la bandeja de soporte en el menu de un balneario', () => {
  it('una cuenta que no atiende soporte no la ve', async () => {
    render(shell());
    const menu = screen.getByRole('complementary');
    await within(menu).findByText('Clientes');
    await new Promise((r) => setTimeout(r, 0));
    expect(within(menu).queryByText('Bandeja de soporte')).toBeNull();
  });

  it('una cuenta que atiende la ve con sus no leidos y la abre sin perder el balneario', async () => {
    contador = { noLeidos: 0, bandeja: 2 };
    const onChangeSection = vi.fn();
    const { rerender } = render(shell({ onChangeSection }));

    const menu = screen.getByRole('complementary');
    const item = await within(menu).findByRole('button', { name: /Bandeja de soporte/ });
    expect(within(item).getByLabelText('2 sin leer')).toBeInTheDocument();
    fireEvent.click(item);
    expect(onChangeSection).toHaveBeenCalledWith('bandeja-soporte');

    rerender(shell({ onChangeSection, activeSection: 'bandeja-soporte' }));
    expect(await screen.findByRole('navigation', { name: 'Balnearios' })).toBeInTheDocument();
    expect(screen.queryByText('Contenido del balneario')).toBeNull();
    // El menu del balneario sigue ahi.
    expect(within(menu).getByText('Clientes')).toBeInTheDocument();
  });
});

describe('el personal del balneario', () => {
  it('no ve el boton de Soporte ni pregunta los no leidos', async () => {
    render(shell({ conSoporte: false }));
    await screen.findAllByRole('button', { name: /Inicio/ });
    expect(screen.queryByRole('button', { name: /^Soporte/ })).not.toBeInTheDocument();
    expect(global.fetch.mock.calls.some(([url]) => /\/soporte\//.test(url))).toBe(false);
  });
});
