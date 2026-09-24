import { describe, it, expect, vi, afterEach } from 'vitest';
import { envolverFetch, expiracionDelToken, EVENTO_SESION_VENCIDA } from './sesion';

// Token JWT armado a mano: solo importa el payload (la firma no se valida en el navegador).
function tokenQueVence(segundosDesdeAhora) {
  const payload = { userId: 2, exp: Math.floor(Date.now() / 1000) + segundosDesdeAhora };
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.firma`;
}

const respuesta = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.restoreAllMocks());

describe('envolverFetch', () => {
  it('avisa que la sesion vencio cuando la API responde invalid_token', async () => {
    const aviso = vi.fn();
    window.addEventListener(EVENTO_SESION_VENCIDA, aviso);
    const f = envolverFetch(() => Promise.resolve(respuesta(401, { error: 'invalid_token' })));
    const res = await f('/api/reservation-groups');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'invalid_token' });
    expect(aviso).toHaveBeenCalledTimes(1);
    window.removeEventListener(EVENTO_SESION_VENCIDA, aviso);
  });

  it('tambien con missing_token', async () => {
    const aviso = vi.fn();
    window.addEventListener(EVENTO_SESION_VENCIDA, aviso);
    await envolverFetch(() => Promise.resolve(respuesta(401, { error: 'missing_token' })))('/api/clients');
    expect(aviso).toHaveBeenCalledTimes(1);
    window.removeEventListener(EVENTO_SESION_VENCIDA, aviso);
  });

  it('no avisa por otros 401, como una contrasena actual incorrecta', async () => {
    const aviso = vi.fn();
    window.addEventListener(EVENTO_SESION_VENCIDA, aviso);
    await envolverFetch(() => Promise.resolve(respuesta(401, { error: 'invalid_password' })))('/api/auth/password');
    await envolverFetch(() => Promise.resolve(respuesta(401, { error: 'invalid_credentials' })))('/api/auth/login');
    await envolverFetch(() => Promise.resolve(respuesta(200, { ok: true })))('/api/tarifas');
    expect(aviso).not.toHaveBeenCalled();
    window.removeEventListener(EVENTO_SESION_VENCIDA, aviso);
  });

  it('no rompe con un 401 sin cuerpo JSON', async () => {
    const f = envolverFetch(() => Promise.resolve(new Response('nope', { status: 401 })));
    const res = await f('/api/x');
    expect(await res.text()).toBe('nope');
  });
});

describe('expiracionDelToken', () => {
  it('lee el exp del token en milisegundos', () => {
    const t = tokenQueVence(3600);
    const exp = expiracionDelToken(t);
    expect(Math.abs(exp - (Date.now() + 3600 * 1000))).toBeLessThan(2000);
  });

  it('devuelve null si el token no se puede leer', () => {
    expect(expiracionDelToken('no-es-un-token')).toBeNull();
    expect(expiracionDelToken('')).toBeNull();
  });
});

