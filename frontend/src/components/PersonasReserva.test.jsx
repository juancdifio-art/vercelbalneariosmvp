import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PersonasReserva from './PersonasReserva';

// La seccion Personas del detalle de la reserva: lista, alta, edicion y
// borrado. Solo el nombre es obligatorio.

function respuesta(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

beforeEach(() => {
  sessionStorage.setItem('authToken', 'token-de-prueba');
});

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('PersonasReserva', () => {
  it('muestra las personas con su edad y su DNI', async () => {
    global.fetch = vi.fn(() =>
      respuesta({
        guests: [
          { id: 11, fullName: 'Valentina Rios', documentNumber: '40123456', age: 34, birthDate: null },
          { id: 12, fullName: 'Mateo Rios', documentNumber: null, age: null, birthDate: null }
        ]
      })
    );

    render(<PersonasReserva reservationGroupId={2500} adultsCount={1} childrenCount={1} />);

    expect(await screen.findByText('Valentina Rios')).toBeInTheDocument();
    expect(screen.getByText(/34 años · DNI 40123456/)).toBeInTheDocument();
    // Sin edad ni documento no se inventa nada.
    expect(screen.getByText('Sin más datos')).toBeInTheDocument();
  });

  it('avisa cuando faltan personas por cargar', async () => {
    global.fetch = vi.fn(() => respuesta({ guests: [{ id: 11, fullName: 'Valentina Rios' }] }));

    render(<PersonasReserva reservationGroupId={2500} adultsCount={3} childrenCount={3} />);

    expect(await screen.findByText('Cargaste 1 de 6 personas')).toBeInTheDocument();
  });

  it('no avisa cuando estan todas cargadas', async () => {
    global.fetch = vi.fn(() =>
      respuesta({ guests: [{ id: 11, fullName: 'Ana' }, { id: 12, fullName: 'Luis' }] })
    );

    render(<PersonasReserva reservationGroupId={2500} adultsCount={2} childrenCount={0} />);

    await screen.findByText('Ana');
    expect(screen.queryByText(/Cargaste/)).not.toBeInTheDocument();
  });

  it('no deja guardar sin nombre', async () => {
    global.fetch = vi.fn(() => respuesta({ guests: [] }));
    const user = userEvent.setup();

    render(<PersonasReserva reservationGroupId={2500} adultsCount={1} childrenCount={0} />);

    await user.click(await screen.findByRole('button', { name: /Agregar persona/ }));
    await user.click(screen.getByRole('button', { name: /^Agregar$/ }));

    expect(await screen.findByText('El nombre es obligatorio.')).toBeInTheDocument();
    // No se mando nada: la unica llamada es la de la lista.
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('agrega una persona con solo el nombre', async () => {
    const llamadas = [];
    global.fetch = vi.fn((url, opciones) => {
      llamadas.push({ url, opciones });
      if (opciones && opciones.method === 'POST') return respuesta({ guest: { id: 13 } }, true);
      return respuesta({ guests: [] });
    });
    const user = userEvent.setup();

    render(<PersonasReserva reservationGroupId={2500} adultsCount={1} childrenCount={0} />);

    await user.click(await screen.findByRole('button', { name: /Agregar persona/ }));
    await user.type(screen.getByLabelText(/Nombre y apellido/), 'Sofia Paz');
    await user.click(screen.getByRole('button', { name: /^Agregar$/ }));

    await waitFor(() => {
      const post = llamadas.find((l) => l.opciones && l.opciones.method === 'POST');
      expect(post).toBeTruthy();
      expect(post.url).toContain('/api/reservation-groups/2500/guests');
      expect(JSON.parse(post.opciones.body)).toEqual({
        fullName: 'Sofia Paz',
        documentNumber: null,
        age: null,
        birthDate: null
      });
    });
  });

  it('edita una persona por PATCH a su propia ruta', async () => {
    const llamadas = [];
    global.fetch = vi.fn((url, opciones) => {
      llamadas.push({ url, opciones });
      if (opciones && opciones.method === 'PATCH') return respuesta({ guest: { id: 12 } });
      return respuesta({
        guests: [{ id: 12, fullName: 'Mateo Rios', documentNumber: '52111222', age: 8, birthDate: null }]
      });
    });
    const user = userEvent.setup();

    render(<PersonasReserva reservationGroupId={2500} adultsCount={0} childrenCount={1} />);

    await user.click(await screen.findByRole('button', { name: /Editar Mateo Rios/ }));

    const edad = screen.getByLabelText(/Edad/);
    await user.clear(edad);
    await user.type(edad, '9');
    await user.click(screen.getByRole('button', { name: /^Guardar$/ }));

    await waitFor(() => {
      const patch = llamadas.find((l) => l.opciones && l.opciones.method === 'PATCH');
      expect(patch).toBeTruthy();
      expect(patch.url).toContain('/api/reservation-guests/12');
      expect(JSON.parse(patch.opciones.body).age).toBe('9');
    });
  });

  it('borra una persona', async () => {
    const llamadas = [];
    global.fetch = vi.fn((url, opciones) => {
      llamadas.push({ url, opciones });
      if (opciones && opciones.method === 'DELETE') return respuesta({ success: true });
      return respuesta({ guests: [{ id: 11, fullName: 'Valentina Rios' }] });
    });
    const user = userEvent.setup();

    render(<PersonasReserva reservationGroupId={2500} adultsCount={1} childrenCount={0} />);

    await user.click(await screen.findByRole('button', { name: /Borrar Valentina Rios/ }));

    await waitFor(() => {
      const del = llamadas.find((l) => l.opciones && l.opciones.method === 'DELETE');
      expect(del).toBeTruthy();
      expect(del.url).toContain('/api/reservation-guests/11');
    });
  });
});
