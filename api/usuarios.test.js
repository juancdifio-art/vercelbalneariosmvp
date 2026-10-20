import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { queryMock, txMock, rolMock } from './test/pg-mock.js';
import { ALFABETO } from './_cuentas/servicio.js';
import { puede } from './_permisos/permisos.js';

// Usuarios por balneario: el control de roles a la entrada de la API
// (_permisos) y el alta del personal por el encargado (_usuarios).
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgres://test';

const handler = (await import('./index.js')).default;
const token = `Bearer ${jwt.sign({ userId: 2, email: 'a@b.c' }, 'test-secret', { expiresIn: '1h' })}`;

const comoRol = (role) => rolMock.mockResolvedValueOnce({ rows: [{ role }] });
const responde = (rows) => queryMock.mockResolvedValueOnce({ rows });
const sqlDe = (patron) => queryMock.mock.calls.find(([sql]) => patron.test(sql));
const FORMATO_CLAVE = new RegExp(`^[${ALFABETO}]{4}-[${ALFABETO}]{4}-[${ALFABETO}]{4}$`);

beforeEach(() => {
  queryMock.mockReset();
  txMock.mockClear();
  rolMock.mockClear();
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

describe('qué puede cada rol', () => {
  it('el encargado puede todo; el empleado opera pero no configura; pileta solo mira', () => {
    expect(puede('admin', 'POST', 'tarifas')).toBe(true);
    expect(puede('operador', 'GET', 'tarifas')).toBe(true);
    expect(puede('operador', 'POST', 'tarifas')).toBe(false);
    expect(puede('operador', 'POST', 'reservation-groups')).toBe(true);
    expect(puede('operador', 'PUT', 'contrato')).toBe(false);
    expect(puede('operador', 'GET', 'usuarios')).toBe(false);
    // Pileta solo mira los pases: la lista filtrada a pileta y quien va en cada pase.
    expect(puede('pileta', 'GET', 'reservation-groups', { servicio: 'pileta' })).toBe(true);
    expect(puede('pileta', 'GET', 'reservation-groups', { partes: ['7', 'pase-personas'] })).toBe(true);
    expect(puede('pileta', 'GET', 'establishment', { partes: ['me'] })).toBe(true);
    expect(puede('pileta', 'GET', 'reservation-groups')).toBe(false);
    expect(puede('pileta', 'GET', 'reservation-groups', { servicio: 'carpa' })).toBe(false);
    expect(puede('pileta', 'GET', 'reservation-groups', { partes: ['7', 'payments'] })).toBe(false);
    expect(puede('pileta', 'GET', 'clients')).toBe(false);
    expect(puede('pileta', 'PUT', 'reservation-groups', { partes: ['7', 'pase-personas'] })).toBe(false);
    expect(puede('pileta', 'POST', 'reservation-groups')).toBe(false);
    expect(puede('pileta', 'GET', 'reports')).toBe(false);
    // Una ruta sin control (auth, soporte, cuentas) no pasa por aca.
    expect(puede('operador', 'POST', 'soporte')).toBe(true);
    // Un rol que no es encargado ni personal no entra a los recursos del balneario.
    expect(puede('soporte', 'GET', 'tarifas')).toBe(false);
    expect(puede(undefined, 'GET', 'reservation-groups')).toBe(false);
    expect(puede('jefe', 'GET', 'clients')).toBe(false);
  });
});

describe('control de roles a la entrada de la API', () => {
  it('frena a un empleado que quiere cambiar tarifas, sin tocar datos', async () => {
    comoRol('operador');
    const res = await request(handler).post('/?route=tarifas').set('Authorization', token).send({ precio: 1 });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('sin_permiso');
    expect(rolMock.mock.calls[0][1]).toEqual([2]);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('deja pasar a un empleado que reserva (sigue a la ruta)', async () => {
    comoRol('operador');
    // Con el cuerpo vacio la ruta contesta 400: lo que importa es que no es el 403 del control.
    const res = await request(handler).post('/?route=reservation-groups').set('Authorization', token).send({});
    expect(res.status).not.toBe(403);
    expect(rolMock).toHaveBeenCalledTimes(1);
  });

  it('pileta mira los pases de pileta, pero no el resto de las reservas, los pagos ni reportes', async () => {
    comoRol('pileta');
    responde([]);
    expect((await request(handler).get('/?route=reservation-groups&service=pileta').set('Authorization', token)).status).toBe(404);
    comoRol('pileta');
    expect((await request(handler).get('/?route=reservation-groups').set('Authorization', token)).status).toBe(403);
    comoRol('pileta');
    expect((await request(handler).get('/?route=reservation-groups/7/payments').set('Authorization', token)).status).toBe(403);
    comoRol('pileta');
    expect((await request(handler).post('/?route=reservation-groups').set('Authorization', token).send({})).status).toBe(403);
    comoRol('pileta');
    expect((await request(handler).get('/?route=reports/payments').set('Authorization', token)).status).toBe(403);
  });

  it('un empleado no cambia la configuracion del balneario ni el contrato', async () => {
    comoRol('operador');
    expect((await request(handler).post('/?route=establishment').set('Authorization', token).send({ name: 'X' })).status).toBe(403);
    comoRol('operador');
    expect((await request(handler).put('/?route=contrato').set('Authorization', token).send({})).status).toBe(403);
  });

  it('sin token no consulta el rol: la ruta contesta 401', async () => {
    const res = await request(handler).get('/?route=reservation-groups');
    expect(res.status).toBe(401);
    expect(rolMock).not.toHaveBeenCalled();
  });

  it('las rutas de auth y soporte no pasan por el control', async () => {
    responde([{ id: 2, email: 'a@b.c', role: 'operador', created_at: '2026-10-20' }]);
    await request(handler).get('/?route=auth/me').set('Authorization', token);
    expect(rolMock).not.toHaveBeenCalled();
  });
});

describe('/api/usuarios: el personal del balneario', () => {
  const ENCARGADO = { role: 'admin', establishment_id: 7 };
  const EMPLEADO = { id: 8, email: 'caja@balneario.test', role: 'operador', created_at: '2026-10-20T13:00:00.000Z', encargado: false };

  it('lista al personal, el encargado primero', async () => {
    responde([ENCARGADO]);
    responde([{ id: 2, email: 'admin@balneario.test', role: 'admin', created_at: '2026-10-20T12:00:00.000Z', encargado: true }, EMPLEADO]);
    const res = await request(handler).get('/?route=usuarios').set('Authorization', token);
    expect(res.status).toBe(200);
    expect(res.body.usuarios).toEqual([
      { id: 2, email: 'admin@balneario.test', rol: 'admin', encargado: true, creado: '2026-10-20T12:00:00.000Z' },
      { id: 8, email: 'caja@balneario.test', rol: 'operador', encargado: false, creado: '2026-10-20T13:00:00.000Z' }
    ]);
    expect(sqlDe(/WHERE u.establishment_id = \$1/)[1]).toEqual([7]);
  });

  it('da de alta a un empleado con clave generada, en su balneario', async () => {
    responde([ENCARGADO]);
    responde([{ n: 2 }]);
    responde([]);
    responde([{ id: 9, email: 'pileta@balneario.test', role: 'pileta', created_at: '2026-10-20T14:00:00.000Z' }]);
    const res = await request(handler).post('/?route=usuarios').set('Authorization', token).send({ email: ' Pileta@Balneario.test ', rol: 'pileta' });
    expect(res.status).toBe(201);
    expect(res.body.usuario).toMatchObject({ id: 9, rol: 'pileta', encargado: false });
    expect(res.body.clave).toMatch(FORMATO_CLAVE);
    const [, [email, hash, rol, est]] = sqlDe(/INSERT INTO users/);
    expect([email, rol, est]).toEqual(['pileta@balneario.test', 'pileta', 7]);
    expect(await bcrypt.compare(res.body.clave, hash)).toBe(true);
    // El conteo y el alta van bajo el bloqueo del balneario.
    expect(txMock.mock.calls.find(([sql]) => /pg_advisory_xact_lock/.test(sql))[1]).toEqual(['usuarios:7']);
  });

  it('no deja crear otro encargado ni un rol inventado', async () => {
    for (const rol of ['admin', 'soporte', 'jefe']) {
      responde([ENCARGADO]);
      const res = await request(handler).post('/?route=usuarios').set('Authorization', token).send({ email: 'x@balneario.test', rol });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('rol_invalido');
    }
  });

  it('un email que ya existe, o pasar el tope, no se crea', async () => {
    responde([ENCARGADO]);
    responde([{ n: 2 }]);
    responde([{ id: 4 }]);
    expect((await request(handler).post('/?route=usuarios').set('Authorization', token).send({ email: 'a@b.com', rol: 'operador' })).status).toBe(409);
    responde([ENCARGADO]);
    responde([{ n: 30 }]);
    const res = await request(handler).post('/?route=usuarios').set('Authorization', token).send({ email: 'a@b.com', rol: 'operador' });
    expect(res.body.error).toBe('demasiados_usuarios');
  });

  it('cambia el rol, genera una clave nueva y quita a un empleado', async () => {
    responde([ENCARGADO]);
    responde([EMPLEADO]);
    responde([{ ...EMPLEADO, role: 'pileta' }]);
    const cambio = await request(handler).patch('/?route=usuarios/8').set('Authorization', token).send({ rol: 'pileta' });
    expect(cambio.body.usuario.rol).toBe('pileta');

    responde([ENCARGADO]);
    responde([EMPLEADO]);
    responde([]);
    const clave = await request(handler).post('/?route=usuarios/8/clave').set('Authorization', token);
    expect(clave.body.clave).toMatch(FORMATO_CLAVE);

    responde([ENCARGADO]);
    responde([EMPLEADO]);
    responde([]);
    const baja = await request(handler).delete('/?route=usuarios/8').set('Authorization', token);
    expect(baja.status).toBe(200);
    expect(sqlDe(/DELETE FROM users/)[1]).toEqual([8, 7]);
  });

  it('al encargado no se lo toca, y un usuario de otro balneario no aparece', async () => {
    responde([ENCARGADO]);
    responde([{ id: 2, email: 'admin@balneario.test', role: 'admin', created_at: '2026', encargado: true }]);
    expect((await request(handler).delete('/?route=usuarios/2').set('Authorization', token)).body.error).toBe('es_el_encargado');

    responde([ENCARGADO]);
    responde([]);
    expect((await request(handler).post('/?route=usuarios/99/clave').set('Authorization', token)).status).toBe(404);
  });

  it('un empleado no llega: lo frena el control de roles', async () => {
    comoRol('operador');
    const res = await request(handler).get('/?route=usuarios').set('Authorization', token);
    expect(res.status).toBe(403);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('y si llegara, el servicio lo frena igual', async () => {
    responde([{ role: 'operador', establishment_id: 7 }]);
    const res = await request(handler).post('/?route=usuarios').set('Authorization', token).send({ email: 'x@y.com', rol: 'operador' });
    expect(res.status).toBe(403);
  });
});
