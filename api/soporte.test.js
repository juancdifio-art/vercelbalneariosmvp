import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { queryMock, txMock } from './test/pg-mock.js';

// Chat de soporte en el router serverless. La primera consulta de cada pedido
// es quien hace el pedido (rol y establecimiento), leido de la base.
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgres://test';

const handler = (await import('./index.js')).default;
const token = `Bearer ${jwt.sign({ userId: 2, email: 'a@b.c' }, 'test-secret', { expiresIn: '1h' })}`;

const ENCARGADO = { role: 'admin', atiende_soporte: false, establishment_id: 1 };
const SOPORTE = { role: 'soporte', atiende_soporte: false, establishment_id: null };
// Cuenta de balneario que ademas atiende la bandeja (la de Juan).
const ADMIN_QUE_ATIENDE = { role: 'admin', atiende_soporte: true, establishment_id: 1 };
const soy = (yo) => queryMock.mockResolvedValueOnce({ rows: [yo] });
const sqlDe = (patron) => queryMock.mock.calls.find(([sql]) => patron.test(sql));

const fila = (extra = {}) => ({
  id: 10, establishment_id: 1, user_id: 2, de_soporte: false, tipo: 'error', texto: 'No guarda la reserva',
  pantalla: 'Carpas', leido_at: null, created_at: '2026-10-19T15:00:00.000Z', ...extra
});

// BEGIN, COMMIT, ROLLBACK y el bloqueo van a txMock (ver test/pg-mock.js).
const controles = () => txMock.mock.calls.map(([sql]) => String(sql).trim());

beforeEach(() => {
  queryMock.mockReset();
  txMock.mockClear();
});

describe('el establecimiento en /api/soporte', () => {
  it('lee su hilo y marca leidas las respuestas de soporte', async () => {
    soy(ENCARGADO);
    queryMock.mockResolvedValueOnce({ rows: [] }); // UPDATE leido_at
    queryMock.mockResolvedValueOnce({ rows: [fila(), fila({ id: 11, de_soporte: true, tipo: null, pantalla: null, texto: 'Lo vemos', leido_at: '2026-10-19T16:00:00.000Z' })] });

    const res = await request(handler).get('/?route=soporte/mensajes').set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.mensajes).toHaveLength(2);
    expect(res.body.mensajes[0]).toMatchObject({ id: 10, deSoporte: false, tipo: 'error', pantalla: 'Carpas', leido: false });
    expect(res.body.mensajes[1]).toMatchObject({ id: 11, deSoporte: true, leido: true });
    expect(sqlDe(/UPDATE soporte_mensajes/)[1]).toEqual([1, true]);
  });

  it('escribe un mensaje con tipo y pantalla', async () => {
    soy(ENCARGADO);
    queryMock.mockResolvedValueOnce({ rows: [{ n: 0 }] });
    queryMock.mockResolvedValueOnce({ rows: [fila()] });

    const res = await request(handler).post('/?route=soporte/mensajes').set('Authorization', token)
      .send({ texto: '  No guarda la reserva  ', tipo: 'error', pantalla: 'Carpas' });

    expect(res.status).toBe(201);
    expect(res.body.mensaje).toMatchObject({ id: 10, texto: 'No guarda la reserva' });
    expect(sqlDe(/INSERT INTO soporte_mensajes/)[1]).toEqual([1, 2, false, 'error', 'No guarda la reserva', 'Carpas']);
    // El conteo y el INSERT van juntos, bajo el bloqueo del establecimiento.
    const tx = controles();
    expect(tx[0]).toBe('BEGIN');
    expect(tx.some((sql) => /pg_advisory_xact_lock/.test(sql))).toBe(true);
    expect(tx.at(-1)).toBe('COMMIT');
    const bloqueo = txMock.mock.calls.find(([sql]) => /pg_advisory_xact_lock/.test(sql));
    expect(bloqueo[1]).toEqual(['soporte:1:false']);
  });

  it('quita el byte nulo, que Postgres no acepta en un texto', async () => {
    soy(ENCARGADO);
    queryMock.mockResolvedValueOnce({ rows: [{ n: 0 }] });
    queryMock.mockResolvedValueOnce({ rows: [fila()] });

    const res = await request(handler).post('/?route=soporte/mensajes').set('Authorization', token)
      .send({ texto: 'hola\u0000 mundo', pantalla: 'Car\u0000pas' });

    expect(res.status).toBe(201);
    expect(sqlDe(/INSERT INTO soporte_mensajes/)[1]).toEqual([1, 2, false, null, 'hola mundo', 'Carpas']);
  });

  it('rechaza un mensaje vacio, uno muy largo o con un tipo desconocido sin escribir nada', async () => {
    for (const [body, error] of [
      [{ texto: '   ' }, 'texto_requerido'],
      [{ texto: 'x'.repeat(2001) }, 'texto_largo'],
      [{ texto: 'hola', tipo: 'queja' }, 'tipo_invalido']
    ]) {
      queryMock.mockReset();
      soy(ENCARGADO);
      const res = await request(handler).post('/?route=soporte/mensajes').set('Authorization', token).send(body);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe(error);
      expect(sqlDe(/INSERT INTO/)).toBeUndefined();
    }
  });

  it('frena mas de 10 mensajes por minuto', async () => {
    soy(ENCARGADO);
    queryMock.mockResolvedValueOnce({ rows: [{ n: 10 }] });

    const res = await request(handler).post('/?route=soporte/mensajes').set('Authorization', token).send({ texto: 'otra vez' });

    expect(res.status).toBe(429);
    expect(res.body.error).toBe('demasiados_mensajes');
    expect(sqlDe(/INSERT INTO/)).toBeUndefined();
    expect(controles().at(-1)).toBe('ROLLBACK');
  });

  it('cuenta las respuestas sin leer de su establecimiento', async () => {
    soy(ENCARGADO);
    queryMock.mockResolvedValueOnce({ rows: [{ n: 2 }] });

    const res = await request(handler).get('/?route=soporte/no-leidos').set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ noLeidos: 2 });
    expect(queryMock.mock.calls[1][1]).toEqual([1]);
  });

  it('no puede entrar a la bandeja de soporte', async () => {
    soy(ENCARGADO);

    const lista = await request(handler).get('/?route=soporte/bandeja').set('Authorization', token);
    expect(lista.status).toBe(403);
    expect(lista.body.error).toBe('solo_soporte');

    queryMock.mockReset();
    soy(ENCARGADO);
    const respuesta = await request(handler).post('/?route=soporte/bandeja/3').set('Authorization', token).send({ texto: 'me respondo solo' });
    expect(respuesta.status).toBe(403);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('sin sesion no entra', async () => {
    const res = await request(handler).get('/?route=soporte/mensajes');
    expect(res.status).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });
});

describe('soporte en /api/soporte/bandeja', () => {
  it('lista los establecimientos: primero los que esperan respuesta', async () => {
    soy(SOPORTE);
    queryMock.mockResolvedValueOnce({
      rows: [
        { id: 1, name: 'Zeus', ultimo_texto: 'Gracias', ultimo_de_soporte: false, ultimo: '2026-10-19T18:00:00.000Z', no_leidos: 0 },
        { id: 2, name: 'Poseidon', ultimo_texto: 'No anda el pago', ultimo_de_soporte: false, ultimo: '2026-10-19T12:00:00.000Z', no_leidos: 1 },
        { id: 3, name: 'Apolo', ultimo_texto: null, ultimo_de_soporte: null, ultimo: null, no_leidos: 0 }
      ]
    });

    const res = await request(handler).get('/?route=soporte/bandeja').set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.establecimientos.map((e) => e.nombre)).toEqual(['Poseidon', 'Zeus', 'Apolo']);
    expect(res.body.establecimientos[0]).toMatchObject({ id: 2, noLeidos: 1, ultimo: { texto: 'No anda el pago', deSoporte: false } });
    expect(res.body.establecimientos[2].ultimo).toBeNull();
  });

  it('abre el hilo de un establecimiento y marca leidos sus mensajes', async () => {
    soy(SOPORTE);
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    queryMock.mockResolvedValueOnce({ rows: [] });
    queryMock.mockResolvedValueOnce({ rows: [fila()] });

    const res = await request(handler).get('/?route=soporte/bandeja/1').set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.mensajes).toHaveLength(1);
    expect(sqlDe(/UPDATE soporte_mensajes/)[1]).toEqual([1, false]);
  });

  it('responde: el mensaje queda como de soporte, sin tipo ni pantalla', async () => {
    soy(SOPORTE);
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    queryMock.mockResolvedValueOnce({ rows: [{ n: 0 }] });
    queryMock.mockResolvedValueOnce({ rows: [fila({ id: 12, de_soporte: true, tipo: null, pantalla: null, texto: 'Ya quedo' })] });

    const res = await request(handler).post('/?route=soporte/bandeja/1').set('Authorization', token)
      .send({ texto: 'Ya quedo', tipo: 'error', pantalla: 'Carpas' });

    expect(res.status).toBe(201);
    expect(sqlDe(/INSERT INTO soporte_mensajes/)[1]).toEqual([1, 2, true, null, 'Ya quedo', null]);
  });

  it('un id que no es numero es 400 y uno que no existe es 404', async () => {
    soy(SOPORTE);
    const malo = await request(handler).get('/?route=soporte/bandeja/abc').set('Authorization', token);
    expect(malo.status).toBe(400);
    expect(malo.body.error).toBe('id_invalido');

    queryMock.mockReset();
    soy(SOPORTE);
    const enorme = await request(handler).get('/?route=soporte/bandeja/99999999999').set('Authorization', token);
    expect(enorme.status).toBe(400);
    expect(queryMock).toHaveBeenCalledTimes(1);

    queryMock.mockReset();
    soy(SOPORTE);
    queryMock.mockResolvedValueOnce({ rows: [] });
    const falta = await request(handler).get('/?route=soporte/bandeja/99').set('Authorization', token);
    expect(falta.status).toBe(404);
    expect(falta.body.error).toBe('establishment_not_found');
  });

  it('cuenta todos los mensajes sin leer de todos los establecimientos', async () => {
    soy(SOPORTE);
    queryMock.mockResolvedValueOnce({ rows: [{ n: 5 }] });

    const res = await request(handler).get('/?route=soporte/no-leidos').set('Authorization', token);

    expect(res.body).toEqual({ noLeidos: 0, bandeja: 5 });
    expect(queryMock.mock.calls[1][1]).toBeUndefined();
  });

  it('una cuenta de soporte sin establecimiento no tiene hilo propio', async () => {
    soy(SOPORTE);
    const res = await request(handler).get('/?route=soporte/mensajes').set('Authorization', token);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('establishment_not_found');
  });
});

describe('una cuenta de balneario que ademas atiende soporte', () => {
  it('recibe los dos contadores: el de su hilo y el de la bandeja', async () => {
    soy(ADMIN_QUE_ATIENDE);
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] });
    queryMock.mockResolvedValueOnce({ rows: [{ n: 4 }] });

    const res = await request(handler).get('/?route=soporte/no-leidos').set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ noLeidos: 1, bandeja: 4 });
  });

  it('entra a la bandeja y responde a otro balneario', async () => {
    soy(ADMIN_QUE_ATIENDE);
    queryMock.mockResolvedValueOnce({ rows: [{ id: 2, name: 'Poseidon', ultimo_texto: 'Hola', ultimo_de_soporte: false, ultimo: '2026-10-19T12:00:00.000Z', no_leidos: 1 }] });
    const lista = await request(handler).get('/?route=soporte/bandeja').set('Authorization', token);
    expect(lista.status).toBe(200);
    expect(lista.body.establecimientos[0].nombre).toBe('Poseidon');

    queryMock.mockReset();
    soy(ADMIN_QUE_ATIENDE);
    queryMock.mockResolvedValueOnce({ rows: [{ id: 2 }] });
    queryMock.mockResolvedValueOnce({ rows: [{ n: 0 }] });
    queryMock.mockResolvedValueOnce({ rows: [fila({ id: 13, establishment_id: 2, de_soporte: true, tipo: null, pantalla: null })] });
    const respuesta = await request(handler).post('/?route=soporte/bandeja/2').set('Authorization', token).send({ texto: 'Ya lo vemos' });
    expect(respuesta.status).toBe(201);
    expect(sqlDe(/INSERT INTO soporte_mensajes/)[1]).toEqual([2, 2, true, null, 'Ya lo vemos', null]);
  });
});

describe('el login devuelve el rol', () => {
  it('para que el frontend muestre la bandeja a soporte', async () => {
    const hash = await bcrypt.hash('clave123', 4);
    queryMock.mockResolvedValueOnce({ rows: [{ id: 9, email: 'soporte@infinite.test', password_hash: hash, role: 'soporte' }] });

    const res = await request(handler).post('/?route=auth/login').send({ email: 'soporte@infinite.test', password: 'clave123' });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: 9, email: 'soporte@infinite.test', role: 'soporte' });
  });
});
