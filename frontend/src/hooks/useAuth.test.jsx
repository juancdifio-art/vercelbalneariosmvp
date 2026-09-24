import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useAuth from './useAuth';
import { EVENTO_SESION_VENCIDA } from '../lib/sesion';

function tokenQueVence(segundosDesdeAhora) {
  const payload = { userId: 2, exp: Math.floor(Date.now() / 1000) + segundosDesdeAhora };
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.firma`;
}

const MENSAJE = 'Tu sesión venció. Volvé a iniciar sesión.';

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  sessionStorage.clear();
});

describe('useAuth y la sesion vencida', () => {
  it('rehidrata una sesion vigente', () => {
    sessionStorage.setItem('authToken', tokenQueVence(3600));
    sessionStorage.setItem('authEmail', 'admin@balneario.com');
    const { result } = renderHook(() => useAuth());
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('al cargar con un token vencido cierra la sesion y avisa', () => {
    sessionStorage.setItem('authToken', tokenQueVence(-60));
    sessionStorage.setItem('authEmail', 'admin@balneario.com');
    const { result } = renderHook(() => useAuth());
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBe(MENSAJE);
    expect(sessionStorage.getItem('authToken')).toBeNull();
  });

  it('cuando la API avisa que el token no sirve, cierra la sesion y avisa', () => {
    sessionStorage.setItem('authToken', tokenQueVence(3600));
    sessionStorage.setItem('authEmail', 'admin@balneario.com');
    const onLogoutCleanup = vi.fn();
    const { result } = renderHook(() => useAuth({ onLogoutCleanup }));
    act(() => {
      window.dispatchEvent(new Event(EVENTO_SESION_VENCIDA));
    });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBe(MENSAJE);
    expect(onLogoutCleanup).toHaveBeenCalled();
  });

  it('sin sesion abierta, el aviso no hace nada', () => {
    const { result } = renderHook(() => useAuth());
    act(() => {
      window.dispatchEvent(new Event(EVENTO_SESION_VENCIDA));
    });
    expect(result.current.error).toBe('');
  });

  it('cierra la sesion sola cuando llega la hora de vencimiento', () => {
    vi.useFakeTimers();
    sessionStorage.setItem('authToken', tokenQueVence(120));
    sessionStorage.setItem('authEmail', 'admin@balneario.com');
    const { result } = renderHook(() => useAuth());
    expect(result.current.isAuthenticated).toBe(true);
    act(() => {
      vi.advanceTimersByTime(121 * 1000);
    });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBe(MENSAJE);
  });
});
