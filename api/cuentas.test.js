import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { queryMock, txMock } from './test/pg-mock.js';
import { validarAlta, generarClave, ALFABETO } from './_cuentas/servicio.js';

// Administrador general en el router serverless. La primera consulta de cada
// pedido es si quien lo hace administra cuentas, leido de la base.
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgres://test';

const handler = (await import('./index.js')).default;
const token = `Bearer ${jwt.sign({ userId: 2, email: 'a@b.c' }, 'test-secret', { expiresIn: '1h' })}`;

const ADMINISTRADOR = { administra_cuentas: true };
const ENCARGADO = { administra_cuentas: false };
const soy = (yo) => queryMock.mockResolvedValueOnce({ rows: [yo] });
const sqlDe = (patron) => queryMock.mock.calls.find(([sql]) => patron.test(sql));
const responde = (rows) => queryMock.mockResolvedValueOnce({ rows });

// BEGIN, COMMIT y ROLLBACK van a txMock (ver test/pg-mock.js).
const controles = () => txMock.mock.calls.map(([sql]) => String(sql).trim());

const FORMATO_CLAVE = new RegExp(`^[${ALFABETO}]{4}-[${ALFABETO}]{4}-[${ALFABETO}]{4}$`);

const usuarioNuevo = (extra = {}) => ({
  id: 30, email: 'nuevo@balneario.com', role: 'admin', administra_cuentas: false, created_at: '2026-10-20T12:00:00.000Z', ...extra
});

beforeEach(() => {
  queryMock.mockReset();
  txMock.mockClear();
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

describe('acceso a /api/cuentas', () => {
  it('sin token responde 401', async () => {
    const res = await request(handler).get('/?route=cuentas');
    expect(res.status).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('acceso le dice a cualquier cuenta si administra', async () => {
    soy(ENCARGADO);
    const res = await request(handler).get('/?route=cuentas/acceso').set('Authorization', token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ administra: false });

    soy(ADMINISTRADOR);
    const res2 = await request(handler).get('/?route=cuentas/acceso').set('Authorization', token);
    expect(res2.body).toEqual({ administra: true });
  });

  it('una cuenta de balneario no lista, no crea ni cambia claves', async () => {
    soy(ENCARGADO);
    expect((await request(handler).get('/?route=cuentas').set('Authorization', token)).status).toBe(403);
    soy(ENCARGADO);
    expect((await request(handler).post('/?route=cuentas').set('Authorization', token).send({ email: 'x@y.com' })).status).toBe(403);
    soy(ENCARGADO);
    const res = await request(handler).post('/?route=cuentas/5/clave').set('Authorization', token);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('solo_administrador');
    // Solo se consulto el permiso: nada se escribio.
    expect(queryMock).toHaveBeenCalledTimes(3);
  });

  it('el permiso sale de la base y no del token', async () => {
    soy(ENCARGADO);
    await request(handler).get('/?route=cuentas').set('Authorization', token);
    expect(queryMock.mock.calls[0][0]).toMatch(/SELECT administra_cuentas FROM users WHERE id = \$1/);
    expect(queryMock.mock.calls[0][1]).toEqual([2]);
  });

  it('una cuenta borrada responde 401', async () => {
    responde([]);
    const res = await request(handler).get('/?route=cuentas/acceso').set('Authorization', token);
    expect(res.status).toBe(401);
  });
});

describe('listado de cuentas', () => {
  it('trae cada cuenta con su balneario y sus reservas', async () => {
    soy(ADMINISTRADOR);
    responde([
      { id: 30, email: 'nuevo@balneario.com', role: 'admin', administra_cuentas: false, created_at: '2026-10-20T12:00:00.000Z', establishment_id: null, establishment_name: null, encargado: null, reservas: 0 },
      { id: 2, email: 'admin@balneario.com', role: 'admin', administra_cuentas: true, created_at: '2025-11-23T10:00:00.000Z', establishment_id: 1, establishment_name: 'Zeus', encargado: true, reservas: 271 },
      { id: 8, email: 'empleado@balneario.test', role: 'operador', administra_cuentas: false, created_at: '2026-10-20T13:00:00.000Z', establishment_id: 1, establishment_name: 'Zeus', encargado: false, reservas: 271 }
    ]);

    const res = await request(handler).get('/?route=cuentas').set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.cuentas).toEqual([
      { id: 30, email: 'nuevo@balneario.com', rol: 'admin', administra: false, creada: '2026-10-20T12:00:00.000Z', balneario: null, encargado: false, reservas: 0 },
      { id: 2, email: 'admin@balneario.com', rol: 'admin', administra: true, creada: '2025-11-23T10:00:00.000Z', balneario: { id: 1, nombre: 'Zeus' }, encargado: true, reservas: 271 },
      // El personal del balneario figura con su rol, sin ser el encargado.
      { id: 8, email: 'empleado@balneario.test', rol: 'operador', administra: false, creada: '2026-10-20T13:00:00.000Z', balneario: { id: 1, nombre: 'Zeus' }, encargado: false, reservas: 271 }
    ]);
    // Nunca sale el hash de la clave.
    expect(sqlDe(/FROM users u/)[0]).not.toMatch(/password_hash/);
  });
});

describe('alta de una cuenta', () => {
  it('sin modelo crea solo el usuario, con el email en minusculas y una clave generada', async () => {
    soy(ADMINISTRADOR);
    responde([]); // el email no existe
    responde([usuarioNuevo()]);

    const res = await request(handler).post('/?route=cuentas').set('Authorization', token)
      .send({ email: '  Nuevo@Balneario.COM ' });

    expect(res.status).toBe(201);
    expect(res.body.cuenta).toMatchObject({ id: 30, email: 'nuevo@balneario.com', balneario: null, reservas: 0 });
    expect(res.body.clave).toMatch(FORMATO_CLAVE);
    expect(sqlDe(/lower\(email\) = \$1/)[1]).toEqual(['nuevo@balneario.com']);
    const [, [email, hash]] = sqlDe(/INSERT INTO users/);
    expect(email).toBe('nuevo@balneario.com');
    // En la base queda el hash, que corresponde a la clave devuelta.
    expect(hash).not.toBe(res.body.clave);
    expect(await bcrypt.compare(res.body.clave, hash)).toBe(true);
    expect(sqlDe(/INSERT INTO establishments/)).toBeUndefined();
    expect(controles()).toEqual(['BEGIN', 'COMMIT']);
  });

  it('con modelo copia la configuracion, los periodos, los sectores y las tarifas', async () => {
    soy(ADMINISTRADOR);
    responde([]);
    responde([usuarioNuevo()]);
    responde([{ id: 40, name: 'Balneario Nuevo' }]); // INSERT establishments ... SELECT
    responde([
      { id: 7, nombre: 'Alta', mes_inicio: 1, dia_inicio: 1, mes_fin: 1, dia_fin: 31, prioridad: 2 },
      { id: 8, nombre: 'Temporada', mes_inicio: 12, dia_inicio: 15, mes_fin: 3, dia_fin: 15, prioridad: 1 }
    ]);
    responde([{ id: 70 }]);
    responde([{ id: 71 }]);
    responde([{ id: 3, service_type: 'carpa', nombre: 'Primera fila', color: '#0EA5E9' }]);
    responde([{ id: 50 }]); // INSERT sectores
    responde([]); // INSERT sector_unidades
    responde([]); // INSERT tarifas

    const res = await request(handler).post('/?route=cuentas').set('Authorization', token)
      .send({ email: 'nuevo@balneario.com', copiarDe: 1, nombre: '  Balneario Nuevo ' });

    expect(res.status).toBe(201);
    expect(res.body.cuenta.balneario).toEqual({ id: 40, nombre: 'Balneario Nuevo' });

    const [sqlEst, paramsEst] = sqlDe(/INSERT INTO establishments/);
    expect(paramsEst).toEqual([30, 'Balneario Nuevo', 1]);
    expect(sqlEst).toMatch(/has_carpas/);
    expect(sqlEst).toMatch(/pases_pileta_por_carpa/);
    // El plano dibujado y el contrato vienen con la configuracion.
    expect(sqlEst).toMatch(/plano/);
    expect(sqlEst).toMatch(/contrato_condiciones/);
    expect(sqlEst).toMatch(/contrato_datos/);

    const periodos = queryMock.mock.calls.filter(([sql]) => /INSERT INTO periodos_tarifarios/.test(sql));
    expect(periodos.map(([, p]) => p)).toEqual([[40, 'Alta', 1, 1, 1, 31, 2], [40, 'Temporada', 12, 15, 3, 15, 1]]);
    expect(sqlDe(/INSERT INTO sectores/)[1]).toEqual([40, 'carpa', 'Primera fila', '#0EA5E9']);
    expect(sqlDe(/INSERT INTO sector_unidades/)[1]).toEqual([50, 40, 3]);
    // Las tarifas se copian con el id nuevo de cada sector y de cada periodo.
    expect(sqlDe(/INSERT INTO tarifas/)[1]).toEqual([1, 40, [3], [50], [7, 8], [70, 71]]);

    // Nada de clientes ni de reservas.
    expect(sqlDe(/clients|reservation_groups/)).toBeUndefined();
    expect(controles()).toEqual(['BEGIN', 'COMMIT']);
  });

  it('un email que ya existe responde 409 y no deja nada', async () => {
    soy(ADMINISTRADOR);
    responde([{ id: 2 }]);

    const res = await request(handler).post('/?route=cuentas').set('Authorization', token)
      .send({ email: 'admin@balneario.com' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('email_taken');
    expect(sqlDe(/INSERT INTO users/)).toBeUndefined();
    expect(controles()).toEqual(['BEGIN', 'ROLLBACK']);
  });

  it('dos altas con el mismo email a la vez: la que choca con el UNIQUE responde 409', async () => {
    soy(ADMINISTRADOR);
    responde([]);
    queryMock.mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' }));

    const res = await request(handler).post('/?route=cuentas').set('Authorization', token)
      .send({ email: 'nuevo@balneario.com' });

    expect(res.status).toBe(409);
    expect(controles()).toEqual(['BEGIN', 'ROLLBACK']);
  });

  it('un modelo que no existe vuelve atras tambien el usuario', async () => {
    soy(ADMINISTRADOR);
    responde([]);
    responde([usuarioNuevo()]);
    responde([]); // INSERT ... SELECT sin filas: el modelo no existe

    const res = await request(handler).post('/?route=cuentas').set('Authorization', token)
      .send({ email: 'nuevo@balneario.com', copiarDe: 999, nombre: 'Nuevo' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('modelo_no_encontrado');
    expect(controles()).toEqual(['BEGIN', 'ROLLBACK']);
  });

  it('valida antes de tocar la base', async () => {
    for (const [body, error] of [
      [{}, 'email_requerido'],
      [{ email: 'sin-arroba' }, 'email_invalido'],
      [{ email: 'a@b.com', copiarDe: 1 }, 'nombre_requerido'],
      [{ email: 'a@b.com', copiarDe: 'uno', nombre: 'X' }, 'id_invalido']
    ]) {
      soy(ADMINISTRADOR);
      const res = await request(handler).post('/?route=cuentas').set('Authorization', token).send(body);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe(error);
    }
    expect(queryMock).toHaveBeenCalledTimes(4); // solo el permiso de cada pedido
    expect(txMock).not.toHaveBeenCalled();
  });
});

describe('clave nueva para una cuenta', () => {
  it('genera una clave, guarda su hash y la devuelve una vez', async () => {
    soy(ADMINISTRADOR);
    responde([{ id: 30, email: 'nuevo@balneario.com', administra_cuentas: false }]);
    responde([]); // UPDATE

    const res = await request(handler).post('/?route=cuentas/30/clave').set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.cuenta).toEqual({ id: 30, email: 'nuevo@balneario.com' });
    expect(res.body.clave).toMatch(FORMATO_CLAVE);
    const [, [hash, id]] = sqlDe(/UPDATE users SET password_hash/);
    expect(id).toBe(30);
    expect(await bcrypt.compare(res.body.clave, hash)).toBe(true);
  });

  it('la propia no: se cambia desde el Panel de usuario', async () => {
    soy(ADMINISTRADOR);
    const res = await request(handler).post('/?route=cuentas/2/clave').set('Authorization', token);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('es_tu_cuenta');
    expect(sqlDe(/UPDATE users/)).toBeUndefined();
  });

  it('la de otro administrador general no', async () => {
    soy(ADMINISTRADOR);
    responde([{ id: 9, email: 'otro@admin.com', administra_cuentas: true }]);
    const res = await request(handler).post('/?route=cuentas/9/clave').set('Authorization', token);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('otro_administrador');
    expect(sqlDe(/UPDATE users/)).toBeUndefined();
  });

  it('una cuenta que no existe responde 404', async () => {
    soy(ADMINISTRADOR);
    responde([]);
    const res = await request(handler).post('/?route=cuentas/77/clave').set('Authorization', token);
    expect(res.status).toBe(404);
  });

  it('un id que no es numero responde 400', async () => {
    soy(ADMINISTRADOR);
    const res = await request(handler).post('/?route=cuentas/abc/clave').set('Authorization', token);
    expect(res.status).toBe(400);
  });
});

describe('reglas sueltas', () => {
  it('sin modelo el nombre no se usa', () => {
    expect(validarAlta({ email: 'a@b.com', nombre: 'Ignorado' })).toEqual({ email: 'a@b.com', copiarDe: null, nombre: null });
  });

  it('quita el byte nulo del nombre', () => {
    expect(validarAlta({ email: 'a@b.com', copiarDe: 1, nombre: 'Ze\u0000us' }).nombre).toBe('Zeus');
  });

  it('cada clave es distinta y no usa caracteres confusos', () => {
    const claves = new Set(Array.from({ length: 50 }, generarClave));
    expect(claves.size).toBe(50);
    for (const c of claves) expect(c).not.toMatch(/[0O1lI]/);
  });
});
