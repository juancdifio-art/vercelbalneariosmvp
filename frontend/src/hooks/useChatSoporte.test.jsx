import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// El modulo guarda lo ultimo que se mando al chat: cada test lo importa de cero.
let useChatSoporte;
let idDelChat;

const scriptDelChat = () => document.querySelector('script[src^="https://embed.tawk.to/"]');

// Lo que hace el script de Tawk al terminar de cargar.
function simularCarga() {
  const api = window.Tawk_API;
  api.setAttributes = vi.fn();
  api.hideWidget = vi.fn();
  api.showWidget = vi.fn();
  api.onLoad();
  return api;
}

const DATOS = { email: 'encargado@zeus.com', establecimiento: 'Zeus', pantalla: 'Carpas' };

beforeEach(async () => {
  vi.resetModules();
  document.head.querySelectorAll('script').forEach((s) => s.remove());
  delete window.Tawk_API;
  ({ default: useChatSoporte } = await import('./useChatSoporte'));
  ({ idDelChat } = await import('../lib/chatSoporte'));
});

describe('chat de soporte', () => {
  it('sin id configurado no carga nada', () => {
    renderHook(() => useChatSoporte(DATOS, null));
    expect(scriptDelChat()).toBeNull();
    expect(window.Tawk_API).toBeUndefined();
  });

  it('solo acepta ids con la forma propiedad/widget', () => {
    expect(idDelChat(' 64f1a2b3c4/1h9abc ')).toBe('64f1a2b3c4/1h9abc');
    expect(idDelChat('')).toBeNull();
    expect(idDelChat(undefined)).toBeNull();
    expect(idDelChat('abc/def"><script>')).toBeNull();
    expect(idDelChat('https://embed.tawk.to/abc/def')).toBeNull();
  });

  it('carga el widget una sola vez, con quien escribe', () => {
    const { rerender } = renderHook((d) => useChatSoporte(d, 'abc/def'), { initialProps: DATOS });
    rerender({ ...DATOS, pantalla: 'Tarifas' });

    expect(document.querySelectorAll('script[src="https://embed.tawk.to/abc/def"]')).toHaveLength(1);
    expect(window.Tawk_API.visitor).toEqual({ name: 'Zeus', email: 'encargado@zeus.com' });
  });

  it('al cargar manda el establecimiento y la pantalla actual, aunque haya cambiado mientras cargaba', () => {
    const { rerender } = renderHook((d) => useChatSoporte(d, 'abc/def'), { initialProps: DATOS });
    rerender({ ...DATOS, pantalla: 'Tarifas' });
    const api = simularCarga();

    expect(api.setAttributes).toHaveBeenLastCalledWith(
      { name: 'Zeus', email: 'encargado@zeus.com', establecimiento: 'Zeus', pantalla: 'Tarifas' },
      expect.any(Function)
    );
  });

  it('con el widget cargado, cada cambio de pantalla se le avisa', () => {
    const { rerender } = renderHook((d) => useChatSoporte(d, 'abc/def'), { initialProps: DATOS });
    const api = simularCarga();
    rerender({ ...DATOS, pantalla: 'Reservas' });

    expect(api.setAttributes).toHaveBeenLastCalledWith(
      expect.objectContaining({ pantalla: 'Reservas' }),
      expect.any(Function)
    );
  });

  it('al cerrar sesion se oculta y al volver a entrar se muestra', () => {
    const primera = renderHook(() => useChatSoporte(DATOS, 'abc/def'));
    const api = simularCarga();
    primera.unmount();
    expect(api.hideWidget).toHaveBeenCalled();

    renderHook(() => useChatSoporte(DATOS, 'abc/def'));
    expect(api.showWidget).toHaveBeenCalled();
    expect(document.querySelectorAll('script[src="https://embed.tawk.to/abc/def"]')).toHaveLength(1);
  });
});
