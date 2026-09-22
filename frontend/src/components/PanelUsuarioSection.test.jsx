import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PanelUsuarioSection from './PanelUsuarioSection';

const ESTABLECIMIENTO = {
  estName: 'Zeus',
  setEstName: vi.fn(),
  estHasParking: true,
  setEstHasParking: vi.fn(),
  estParkingCapacity: 300,
  setEstParkingCapacity: vi.fn(),
  estHasCarpas: true,
  setEstHasCarpas: vi.fn(),
  estCarpasCapacity: 103,
  setEstCarpasCapacity: vi.fn(),
  estHasSombrillas: true,
  setEstHasSombrillas: vi.fn(),
  estSombrillasCapacity: 218,
  setEstSombrillasCapacity: vi.fn(),
  estHasPileta: false,
  setEstHasPileta: vi.fn(),
  estPoolMaxOccupancy: null,
  setEstPoolMaxOccupancy: vi.fn(),
  onSubmit: vi.fn((e) => e.preventDefault()),
  estSaving: false,
  error: '',
  success: ''
};

function renderPanel(props = {}) {
  return render(
    <PanelUsuarioSection
      authToken="token-de-prueba"
      userEmail="admin@balneario.com"
      onEmailChanged={vi.fn()}
      establecimiento={ESTABLECIMIENTO}
      {...props}
    />
  );
}

beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 2,
          email: 'admin@balneario.com',
          role: 'admin',
          createdAt: '2025-11-23T10:00:00.000Z'
        })
    })
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PanelUsuarioSection', () => {
  it('arranca en la solapa Perfil y muestra el email', async () => {
    renderPanel();

    expect(await screen.findByText('admin@balneario.com')).toBeInTheDocument();
  });

  it('muestra el nivel de acceso que devuelve la API', async () => {
    renderPanel();

    expect(await screen.findByText('Administrador')).toBeInTheDocument();
  });

  it('cambia a la solapa Establecimiento al clickearla', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Establecimiento' }));

    expect(screen.getByDisplayValue('Zeus')).toBeInTheDocument();
  });

  it('avisa si la contrasena nueva tiene menos de 8 caracteres', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Cambiar contraseña' }));
    await user.type(screen.getByLabelText('Contraseña actual'), 'admin123');
    await user.type(screen.getByLabelText('Contraseña nueva'), 'corta');
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

    expect(
      await screen.findByText('La contraseña nueva necesita al menos 8 caracteres.')
    ).toBeInTheDocument();
  });

  it('no llama a la API si la validacion local falla', async () => {
    const user = userEvent.setup();
    renderPanel();

    // El unico fetch esperado es el GET /me del montaje.
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    await user.type(screen.getByLabelText('Contraseña actual'), 'admin123');
    await user.type(screen.getByLabelText('Contraseña nueva'), 'corta');
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
