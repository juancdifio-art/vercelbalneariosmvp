import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { queryMock } from './test/pg-mock.js';

// Etapa 2: los datos de cada persona que ocupa una reserva.
// El router de produccion resuelve las rutas de tres segmentos con
// segments[3], igual que /api/reservation-groups/:id/payments.

process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgres://test';

const handler = (await import('./index.js')).default;

function tokenPara(userId, email = 'admin@balneario.com') {
  return jwt.sign({ userId, email }, 'test-secret', { expiresIn: '1h' });
}

// Las dos consultas que hace cada endpoint antes de tocar la tabla:
// el establecimiento del usuario y que la reserva sea de ese establecimiento.
function establecimientoYReserva() {
  queryMock.mockResolvedValueOnce({ rows: [{ id: 7 }] });
  queryMock.mockResolvedValueOnce({ rows: [{ id: 2500 }] });
}

beforeEach(() => {
  queryMock.mockReset();
});

describe('GET /api/reservation-groups/:id/guests', () => {
  it('rechaza el pedido sin token', async () => {
    const res = await request(handler).get('/?route=reservation-groups/2500/guests');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('missing_token');
  });

  it('devuelve 404 si la reserva no es del establecimiento del usuario', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 7 }] });
    queryMock.mockResolvedValueOnce({ rows: [] });

    const res = await request(handler)
      .get('/?route=reservation-groups/2500/guests')
      .set('Authorization', `Bearer ${tokenPara(2)}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('lista las personas de la reserva', async () => {
    establecimientoYReserva();
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 11,
          full_name: 'Valentina Rios',
          document_number: '40123456',
          age: 34,
          birth_date: null,
          created_at: '2026-09-22T10:00:00.000Z'
        },
        {
          id: 12,
          full_name: 'Mateo Rios',
          document_number: null,
          age: null,
          birth_date: '2018-03-04',
          created_at: '2026-09-22T10:01:00.000Z'
        }
      ]
    });

    const res = await request(handler)
      .get('/?route=reservation-groups/2500/guests')
      .set('Authorization', `Bearer ${tokenPara(2)}`);

    expect(res.status).toBe(200);
    expect(res.body.guests).toHaveLength(2);
    expect(res.body.guests[0]).toEqual({
      id: 11,
      fullName: 'Valentina Rios',
      documentNumber: '40123456',
      age: 34,
      birthDate: null,
      createdAt: '2026-09-22T10:00:00.000Z'
    });
    expect(res.body.guests[1].birthDate).toBe('2018-03-04');
  });
});

describe('POST /api/reservation-groups/:id/guests', () => {
  it('rechaza si falta el nombre', async () => {
    establecimientoYReserva();

    const res = await request(handler)
      .post('/?route=reservation-groups/2500/guests')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ documentNumber: '40123456' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('missing_fields');
  });

  it('rechaza un nombre vacio', async () => {
    establecimientoYReserva();

    const res = await request(handler)
      .post('/?route=reservation-groups/2500/guests')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ fullName: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('missing_fields');
  });

  it('agrega una persona con solo el nombre', async () => {
    establecimientoYReserva();
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 13,
          full_name: 'Sofia Paz',
          document_number: null,
          age: null,
          birth_date: null,
          created_at: '2026-09-22T11:00:00.000Z'
        }
      ]
    });

    const res = await request(handler)
      .post('/?route=reservation-groups/2500/guests')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ fullName: 'Sofia Paz' });

    expect(res.status).toBe(201);
    expect(res.body.guest).toEqual({
      id: 13,
      fullName: 'Sofia Paz',
      documentNumber: null,
      age: null,
      birthDate: null,
      createdAt: '2026-09-22T11:00:00.000Z'
    });
  });

  it('guarda documento, edad y fecha de nacimiento cuando vienen', async () => {
    establecimientoYReserva();
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 14,
          full_name: 'Mateo Rios',
          document_number: '52111222',
          age: 8,
          birth_date: '2018-03-04',
          created_at: '2026-09-22T11:05:00.000Z'
        }
      ]
    });

    const res = await request(handler)
      .post('/?route=reservation-groups/2500/guests')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ fullName: 'Mateo Rios', documentNumber: '52111222', age: 8, birthDate: '2018-03-04' });

    expect(res.status).toBe(201);
    const parametros = queryMock.mock.calls.at(-1)[1];
    expect(parametros).toEqual([7, 2500, 'Mateo Rios', '52111222', 8, '2018-03-04']);
  });
});

describe('PATCH /api/reservation-guests/:guestId', () => {
  it('rechaza el pedido sin token', async () => {
    const res = await request(handler)
      .patch('/?route=reservation-guests/14')
      .send({ fullName: 'Otro' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('missing_token');
  });

  it('devuelve 404 si la persona no es del establecimiento del usuario', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 7 }] });
    queryMock.mockResolvedValueOnce({ rows: [] });

    const res = await request(handler)
      .patch('/?route=reservation-guests/14')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ fullName: 'Otro' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('edita solo los campos que se mandan', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 7 }] });
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 14,
          full_name: 'Mateo Rios',
          document_number: '52111222',
          age: 8,
          birth_date: '2018-03-04'
        }
      ]
    });
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 14,
          full_name: 'Mateo Rios',
          document_number: '52111222',
          age: 9,
          birth_date: '2018-03-04',
          created_at: '2026-09-22T11:05:00.000Z'
        }
      ]
    });

    const res = await request(handler)
      .patch('/?route=reservation-guests/14')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ age: 9 });

    expect(res.status).toBe(200);
    expect(res.body.guest.age).toBe(9);
    // El nombre no se manda: tiene que quedar el que ya estaba.
    expect(res.body.guest.fullName).toBe('Mateo Rios');
    const parametros = queryMock.mock.calls.at(-1)[1];
    expect(parametros).toEqual(['Mateo Rios', '52111222', 9, '2018-03-04', 14]);
  });
});

describe('DELETE /api/reservation-guests/:guestId', () => {
  it('borra la persona', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 7 }] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 14 }] });
    queryMock.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(handler)
      .delete('/?route=reservation-guests/14')
      .set('Authorization', `Bearer ${tokenPara(2)}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('devuelve 404 si la persona no existe para ese establecimiento', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 7 }] });
    queryMock.mockResolvedValueOnce({ rows: [] });

    const res = await request(handler)
      .delete('/?route=reservation-guests/14')
      .set('Authorization', `Bearer ${tokenPara(2)}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});
