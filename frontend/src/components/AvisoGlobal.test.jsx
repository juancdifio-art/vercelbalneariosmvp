import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AvisoGlobal from './AvisoGlobal';

// Los avisos de error y de exito de la app. Antes solo se dibujaban en la
// pantalla de ingreso: adentro de la app no se veian nunca.

describe('AvisoGlobal', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('sin mensajes no dibuja nada', () => {
    const { container } = render(<AvisoGlobal error="" success="" onCerrarError={vi.fn()} onCerrarSuccess={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('muestra el error como alerta y se cierra a mano', async () => {
    const onCerrarError = vi.fn();
    render(<AvisoGlobal error="No se pudo crear la reserva." success="" onCerrarError={onCerrarError} onCerrarSuccess={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo crear la reserva.');
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByRole('button', { name: 'Cerrar aviso de error' }));
    expect(onCerrarError).toHaveBeenCalled();
  });

  it('un error no se va solo', () => {
    const onCerrarError = vi.fn();
    render(<AvisoGlobal error="Algo falló" success="" onCerrarError={onCerrarError} onCerrarSuccess={vi.fn()} />);
    act(() => { vi.advanceTimersByTime(60000); });
    expect(onCerrarError).not.toHaveBeenCalled();
  });

  it('el aviso de exito se muestra y se va solo a los 8 segundos', () => {
    const onCerrarSuccess = vi.fn();
    render(<AvisoGlobal error="" success="Reserva guardada. Cochera en la plaza 3." onCerrarError={vi.fn()} onCerrarSuccess={onCerrarSuccess} />);

    expect(screen.getByRole('status')).toHaveTextContent('Cochera en la plaza 3.');
    act(() => { vi.advanceTimersByTime(7900); });
    expect(onCerrarSuccess).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(200); });
    expect(onCerrarSuccess).toHaveBeenCalled();
  });
});
