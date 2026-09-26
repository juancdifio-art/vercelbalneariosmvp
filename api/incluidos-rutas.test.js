import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { queryMock, txMock } from './test/pg-mock.js';

// Servicios incluidos en el router serverless. Ver test/pg-mock.js: BEGIN,
// COMMIT, ROLLBACK y los bloqueos van a txMock; queryMock recibe solo las
// consultas de datos, en orden.
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgres://test';

const handler = (await import('./index.js')).default;
const token = `Bearer ${jwt.sign({ userId: 2, email: 'a@b.c' }, 'test-secret', { expiresIn: '1h' })}`;

const EST = { id: 1, has_pileta: true, has_parking: true, parking_capacity: 10, pases_pileta_por_carpa: 4, pases_pileta_por_sombrilla: 0, max_personas_por_unidad: 6 };
const CARPA = { id: 60, establishment_id: 1, service_type: 'carpa', resource_number: 12, start_date: '2026-01-10', end_date: '2026-01-20', client_id: 7, status: 'active', customer_name: 'Lucia' };
const alta = { serviceType: 'carpa', resourceNumber: 12, startDate: '2026-01-10', endDate: '2026-01-20', customerName: 'Lucia', clientId: 7, adultsCount: 2, childrenCount: 1 };

const sinTarifas = () => {
  queryMock.mockResolvedValueOnce({ rows: [] });
  queryMock.mockResolvedValueOnce({ rows: [] });
  queryMock.mockResolvedValueOnce({ rows: [] });
};
const txSql = () => txMock.mock.calls.map(([sql]) => sql).filter((s) => /^(BEGIN|COMMIT|ROLLBACK)$/.test(s));

beforeEach(() => {
  queryMock.mockReset();
  txMock.mockClear();
});

describe('POST reservation-groups con incluidos', () => {
  it('sin cliente responde client_required sin tocar la base', async () => {
    const res = await request(handler).post('/?route=reservation-groups').set('Authorization', token)
      .send({ ...alta, clientId: null, incluidos: { pileta: true } });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('client_required');
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('con mas personas que el tope responde too_many_people', async () => {
    queryMock.mockResolvedValueOnce({ rows: [EST] });

    const res = await request(handler).post('/?route=reservation-groups').set('Authorization', token)
      .send({ ...alta, adultsCount: 5, childrenCount: 2 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('too_many_people');
  });

  it('crea la carpa, el pase incluido y la cochera en una transaccion', async () => {
    queryMock.mockResolvedValueOnce({ rows: [EST] });
    queryMock.mockResolvedValueOnce({ rows: [] }); // sin solapamiento de la carpa
    sinTarifas();
    queryMock.mockResolvedValueOnce({ rows: [CARPA] }); // INSERT carpa
    queryMock.mockResolvedValueOnce({ rows: [{ id: 501, service_type: 'pileta' }] }); // INSERT pase
    queryMock.mockResolvedValueOnce({ rows: [] }); // titular: sin ficha completa
    queryMock.mockResolvedValueOnce({ rows: [] }); // plaza 5 libre
    sinTarifas();
    queryMock.mockResolvedValueOnce({ rows: [{ id: 502, service_type: 'parking', resource_number: 5, total_price: '700000' }] });

    const res = await request(handler).post('/?route=reservation-groups').set('Authorization', token)
      .send({ ...alta, incluidos: { pileta: true, cocheras: [{ plaza: 5, vehiclePlate: 'ab123cd', precio: { cobrado: 700000 } }] } });

    expect(res.status).toBe(201);
    expect(res.body.group.id).toBe(60);
    expect(res.body.incluidos).toEqual({
      pileta: { id: 501, asignados: 0 },
      cocheras: [{ id: 502, plaza: 5, vehiclePlate: 'AB123CD', totalPrice: '700000' }]
    });
    expect(txSql()).toEqual(['BEGIN', 'COMMIT']);
  });

  it('si la cochera choca no guarda nada y dice que plaza', async () => {
    queryMock.mockResolvedValueOnce({ rows: [EST] });
    queryMock.mockResolvedValueOnce({ rows: [] });
    sinTarifas();
    queryMock.mockResolvedValueOnce({ rows: [CARPA] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 9 }] }); // plaza 5 ocupada

    const res = await request(handler).post('/?route=reservation-groups').set('Authorization', token)
      .send({ ...alta, incluidos: { cocheras: [{ plaza: 5, vehiclePlate: 'AB123CD' }] } });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('resource_conflict');
    expect(res.body.message).toContain('5');
    expect(txSql()).toEqual(['BEGIN', 'ROLLBACK']);
  });

  it('pileta en una sombrilla que no da pases responde pileta_no_incluible', async () => {
    queryMock.mockResolvedValueOnce({ rows: [EST] });

    const res = await request(handler).post('/?route=reservation-groups').set('Authorization', token)
      .send({ ...alta, serviceType: 'sombrilla', incluidos: { pileta: true } });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('pileta_no_incluible');
  });

  it('un pase pago queda asociado a la carpa como adicional', async () => {
    queryMock.mockResolvedValueOnce({ rows: [EST] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 60, service_type: 'carpa', client_id: 7 }] }); // carpa asociable
    queryMock.mockResolvedValueOnce({ rows: [{ id: 503, service_type: 'pileta', incluida_en_reserva_id: 60, vinculo: 'adicional' }] });

    const res = await request(handler).post('/?route=reservation-groups').set('Authorization', token)
      .send({ serviceType: 'pileta', resourceNumber: 1, startDate: '2026-01-10', endDate: '2026-01-20', customerName: 'Lucia', clientId: 7, adultsCount: 1, poolAdultPricePerDay: 5000, incluidaEnReservaId: 60 });

    expect(res.status).toBe(201);
    const insert = queryMock.mock.calls.find(([sql]) => /INSERT INTO reservation_groups/.test(sql));
    expect(insert[1]).toEqual(expect.arrayContaining([60, 'adicional']));
    expect(res.body.group).toMatchObject({ incluidaEnReservaId: 60, vinculo: 'adicional' });
  });

  it('un pase pago asociado a una carpa que no existe responde 404', async () => {
    queryMock.mockResolvedValueOnce({ rows: [EST] });
    queryMock.mockResolvedValueOnce({ rows: [] });

    const res = await request(handler).post('/?route=reservation-groups').set('Authorization', token)
      .send({ serviceType: 'pileta', resourceNumber: 1, startDate: '2026-01-10', endDate: '2026-01-20', customerName: 'Lucia', incluidaEnReservaId: 999 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('carpa_not_found');
  });
});

describe('PATCH reservation-groups con incluidos', () => {
  it('cancelar la carpa cancela sus incluidos y avisa los pases pagos', async () => {
    queryMock.mockResolvedValueOnce({ rows: [EST] });
    queryMock.mockResolvedValueOnce({ rows: [CARPA] });
    queryMock.mockResolvedValueOnce({ rows: [{ ...CARPA, status: 'cancelled' }] }); // UPDATE carpa
    queryMock.mockResolvedValueOnce({ rows: [] }); // UPDATE incluidos
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] }); // adicionales

    const res = await request(handler).patch('/?route=reservation-groups/60').set('Authorization', token).send({ status: 'cancelled' });

    expect(res.status).toBe(200);
    expect(res.body.reservationGroup).toMatchObject({ id: 60, status: 'cancelled', serviceType: 'carpa' });
    expect(res.body.adicionalesAsociados).toBe(1);
    const cancelacion = queryMock.mock.calls.find(([sql]) => /incluida_en_reserva_id = \$1 AND vinculo = 'incluido'/.test(sql));
    expect(cancelacion[1]).toEqual([60]);
  });

  it('el pase incluido no se edita directo', async () => {
    queryMock.mockResolvedValueOnce({ rows: [EST] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 501, service_type: 'pileta', vinculo: 'incluido', incluida_en_reserva_id: 60 }] });

    const res = await request(handler).patch('/?route=reservation-groups/501').set('Authorization', token).send({ adultsCount: 3 });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('servicio_incluido_no_editable');
  });

  it('la cochera incluida no cambia de fechas por su cuenta', async () => {
    queryMock.mockResolvedValueOnce({ rows: [EST] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 502, service_type: 'parking', vinculo: 'incluido', incluida_en_reserva_id: 60, start_date: '2026-01-10', end_date: '2026-01-20' }] });

    const res = await request(handler).patch('/?route=reservation-groups/502').set('Authorization', token).send({ endDate: '2026-01-25' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('servicio_incluido_no_editable');
  });

  it('subir las personas de la carpa por encima del tope responde too_many_people', async () => {
    queryMock.mockResolvedValueOnce({ rows: [EST] });
    queryMock.mockResolvedValueOnce({ rows: [{ ...CARPA, adults_count: 4, children_count: 2 }] });

    const res = await request(handler).patch('/?route=reservation-groups/60').set('Authorization', token).send({ childrenCount: 3 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('too_many_people');
  });

  it('agregar una cochera a una carpa existente', async () => {
    queryMock.mockResolvedValueOnce({ rows: [EST] });
    queryMock.mockResolvedValueOnce({ rows: [CARPA] });
    queryMock.mockResolvedValueOnce({ rows: [CARPA] }); // UPDATE carpa (sin cambios de precio)
    queryMock.mockResolvedValueOnce({ rows: [] }); // plaza 7 libre
    sinTarifas();
    queryMock.mockResolvedValueOnce({ rows: [{ id: 504, service_type: 'parking', resource_number: 7 }] });

    const res = await request(handler).patch('/?route=reservation-groups/60').set('Authorization', token)
      .send({ incluidos: { cocherasNuevas: [{ plaza: 7, vehiclePlate: 'AA111AA' }] } });

    expect(res.status).toBe(200);
    expect(res.body.incluidos.cocheras[0]).toMatchObject({ id: 504, plaza: 7 });
  });
});

describe('GET reservation-groups', () => {
  it('devuelve el vinculo y el resumen de incluidos', async () => {
    queryMock.mockResolvedValueOnce({ rows: [EST] });
    queryMock.mockResolvedValueOnce({ rows: [{
      id: 60, service_type: 'carpa', resource_number: 12, start_date: '2026-01-10', end_date: '2026-01-20', paid_amount: 0,
      vinculadas: [{ id: 501, serviceType: 'pileta', vinculo: 'incluido', personas: 2 }]
    }] });

    const res = await request(handler).get('/?route=reservation-groups').set('Authorization', token);

    expect(res.body.reservationGroups[0].incluidos.pileta).toEqual({ id: 501, asignados: 2 });
    const select = String(queryMock.mock.calls[1][0]);
    expect(select).toContain('AS vinculadas');
    expect(select).toContain('LEFT JOIN reservation_groups padre');
  });
});

describe('pase-personas', () => {
  it('PUT asigna personas al pase dentro de una transaccion', async () => {
    queryMock.mockResolvedValueOnce({ rows: [EST] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 501, service_type: 'pileta', vinculo: 'incluido', incluida_en_reserva_id: 60, status: 'active' }] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 60, client_id: 7, service_type: 'carpa' }] });
    queryMock.mockResolvedValueOnce({ rows: [] }); // FOR UPDATE
    queryMock.mockResolvedValueOnce({ rows: [{ id: 11, full_name: 'Ana', document_number: '1', age: 30 }] });
    queryMock.mockResolvedValueOnce({ rows: [] }); // nadie con otro pase
    queryMock.mockResolvedValueOnce({ rows: [] }); // DELETE
    queryMock.mockResolvedValueOnce({ rows: [] }); // soltar pases cancelados
    queryMock.mockResolvedValueOnce({ rows: [] }); // INSERT persona
    queryMock.mockResolvedValueOnce({ rows: [{ guest_id: 11, full_name: 'Ana', document_number: '1', age: 30 }] });
    queryMock.mockResolvedValueOnce({ rows: [] }); // UPDATE conteo

    const res = await request(handler).put('/?route=reservation-groups/501/pase-personas').set('Authorization', token).send({ guestIds: [11] });

    expect(res.status).toBe(200);
    expect(res.body.personas[0]).toMatchObject({ guestId: 11, fullName: 'Ana', edad: 30 });
    expect(txSql()).toEqual(['BEGIN', 'COMMIT']);
  });
});

describe('ajustes del establecimiento', () => {
  it('GET devuelve pases por unidad y tope de personas', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ...EST, name: 'Zeus' }] });

    const res = await request(handler).get('/?route=establishment/me').set('Authorization', token);

    expect(res.body.establishment).toMatchObject({ pasesPiletaPorCarpa: 4, pasesPiletaPorSombrilla: 0, maxPersonasPorUnidad: 6 });
  });

  it('POST guarda los ajustes y conserva los que no vienen', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    queryMock.mockResolvedValueOnce({ rows: [{ ...EST, name: 'Zeus', pases_pileta_por_carpa: 5 }] });

    const res = await request(handler).post('/?route=establishment').set('Authorization', token)
      .send({ name: 'Zeus', hasPileta: true, pasesPiletaPorCarpa: 5 });

    expect(res.status).toBe(200);
    const update = queryMock.mock.calls[1];
    expect(update[0]).toContain('COALESCE');
    expect(update[1]).toEqual(expect.arrayContaining([5, null]));
    expect(res.body.establishment.pasesPiletaPorCarpa).toBe(5);
  });
});

describe('personas de la reserva', () => {
  it('no deja cargar mas personas que el tope', async () => {
    queryMock.mockResolvedValueOnce({ rows: [EST] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 60, service_type: 'carpa', personas: 6 }] });

    const res = await request(handler).post('/?route=reservation-groups/60/guests').set('Authorization', token).send({ fullName: 'Septimo' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('too_many_people');
  });

  it('al agregar una persona completa le asigna pase si la carpa tiene pileta incluida', async () => {
    queryMock.mockResolvedValueOnce({ rows: [EST] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 60, service_type: 'carpa', personas: 2, pase_incluido_id: 501 }] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 11, full_name: 'Ana', document_number: '1', age: 30 }] }); // INSERT guest
    queryMock.mockResolvedValueOnce({ rows: [{ id: 501, service_type: 'carpa' }] }); // pase FOR UPDATE
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] }); // asignados
    queryMock.mockResolvedValueOnce({ rows: [{ id: 11, full_name: 'Ana', document_number: '1', age: 30 }] }); // guest sin pase
    queryMock.mockResolvedValueOnce({ rows: [] }); // soltar cancelados
    queryMock.mockResolvedValueOnce({ rows: [] }); // INSERT persona
    queryMock.mockResolvedValueOnce({ rows: [] }); // personas del pase
    queryMock.mockResolvedValueOnce({ rows: [] }); // UPDATE conteo

    const res = await request(handler).post('/?route=reservation-groups/60/guests').set('Authorization', token)
      .send({ fullName: 'Ana', documentNumber: '1', age: 30 });

    expect(res.status).toBe(201);
    expect(queryMock.mock.calls.some(([sql]) => /INSERT INTO pase_pileta_personas/.test(sql))).toBe(true);
  });
});

describe('POST de carpa con personas cargadas en el alta', () => {
  it('guarda los acompanantes en la reserva y los pases elegidos, en la misma transaccion', async () => {
    queryMock.mockResolvedValueOnce({ rows: [EST] });
    queryMock.mockResolvedValueOnce({ rows: [] }); // sin solapamiento
    sinTarifas();
    queryMock.mockResolvedValueOnce({ rows: [CARPA] }); // INSERT carpa
    queryMock.mockResolvedValueOnce({ rows: [] }); // UPDATE ficha del titular
    queryMock.mockResolvedValueOnce({ rows: [{ id: 900 }] }); // INSERT acompanante
    queryMock.mockResolvedValueOnce({ rows: [{ id: 7, full_name: 'Lucia', document_number: '30111222', birth_date: '1990-05-01' }] }); // titular
    queryMock.mockResolvedValueOnce({ rows: [{ id: 501, service_type: 'pileta' }] }); // INSERT pase
    queryMock.mockResolvedValueOnce({ rows: [] }); // persona titular
    queryMock.mockResolvedValueOnce({ rows: [] }); // persona acompanante
    queryMock.mockResolvedValueOnce({ rows: [{ client_id: 7, full_name: 'Lucia', birth_date: '1990-05-01' }, { guest_id: 900, full_name: 'Ana', age: 40 }] });
    queryMock.mockResolvedValueOnce({ rows: [] }); // UPDATE conteo

    const res = await request(handler).post('/?route=reservation-groups').set('Authorization', token).send({
      ...alta,
      incluidos: { pileta: true },
      titular: { documentNumber: '30111222', birthDate: '1990-05-01', pileta: true },
      personas: [{ fullName: 'Ana', documentNumber: '1', age: 40, pileta: true }]
    });

    expect(res.status).toBe(201);
    expect(res.body.incluidos.pileta).toEqual({ id: 501, asignados: 2 });
    const guest = queryMock.mock.calls.find(([sql]) => /INSERT INTO reservation_guests/.test(sql));
    expect(guest[1]).toEqual([1, 60, 'Ana', '1', 40, null]);
    expect(txSql()).toEqual(['BEGIN', 'COMMIT']);
  });

  it('mas personas cargadas que el tope es too_many_people', async () => {
    queryMock.mockResolvedValueOnce({ rows: [EST] });
    const personas = [1, 2, 3, 4, 5, 6].map((i) => ({ fullName: `P${i}` }));

    const res = await request(handler).post('/?route=reservation-groups').set('Authorization', token)
      .send({ ...alta, adultsCount: 2, childrenCount: 0, personas });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('too_many_people');
  });
});
