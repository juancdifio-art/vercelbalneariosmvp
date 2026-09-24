import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { queryMock } from './test/pg-mock.js';

// El pool se reemplaza por alias en vitest.config.mjs (ver test/pg-mock.js).
// queryMock intercepta cada db.query en orden.
// index.js lee JWT_SECRET al cargarse, así que hay que fijarlo antes de importarlo.
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgres://test';

const handler = (await import('./index.js')).default;

function tokenPara(userId, email = 'admin@balneario.com') {
  return jwt.sign({ userId, email }, 'test-secret', { expiresIn: '1h' });
}

beforeEach(() => {
  queryMock.mockReset();
});

// El POST de carpa, sombrilla y estacionamiento cotiza antes del INSERT:
// tarifas, periodos y sector de la unidad. Sin tarifas, el precio queda el que se mande.
function sinTarifas() {
  queryMock.mockResolvedValueOnce({ rows: [] });
  queryMock.mockResolvedValueOnce({ rows: [] });
  queryMock.mockResolvedValueOnce({ rows: [] });
}

describe('GET /api/auth/me', () => {
  it('rechaza el pedido sin token', async () => {
    const res = await request(handler).get('/?route=auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('missing_token');
  });

  it('rechaza un token invalido', async () => {
    const res = await request(handler)
      .get('/?route=auth/me')
      .set('Authorization', 'Bearer no-es-un-token');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_token');
  });

  it('devuelve el usuario con su nivel de acceso', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 2, email: 'admin@balneario.com', role: 'admin', created_at: '2025-11-23T10:00:00.000Z' }]
    });

    const res = await request(handler)
      .get('/?route=auth/me')
      .set('Authorization', `Bearer ${tokenPara(2)}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 2,
      email: 'admin@balneario.com',
      role: 'admin',
      createdAt: '2025-11-23T10:00:00.000Z'
    });
  });
});

describe('POST /api/auth/password', () => {
  it('rechaza si falta algun campo', async () => {
    const res = await request(handler)
      .post('/?route=auth/password')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ currentPassword: 'admin123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('missing_fields');
  });

  it('rechaza una contrasena nueva de menos de 8 caracteres', async () => {
    const res = await request(handler)
      .post('/?route=auth/password')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ currentPassword: 'admin123', newPassword: 'corta' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('password_too_short');
  });

  it('rechaza si la contrasena actual no coincide', async () => {
    const hash = await bcrypt.hash('admin123', 10);
    queryMock.mockResolvedValueOnce({ rows: [{ password_hash: hash }] });

    const res = await request(handler)
      .post('/?route=auth/password')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ currentPassword: 'equivocada', newPassword: 'unaClaveLarga' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_password');
  });

  it('guarda el hash nuevo con rounds 12', async () => {
    const hash = await bcrypt.hash('admin123', 10);
    queryMock.mockResolvedValueOnce({ rows: [{ password_hash: hash }] });
    queryMock.mockResolvedValueOnce({ rows: [] });

    const res = await request(handler)
      .post('/?route=auth/password')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ currentPassword: 'admin123', newPassword: 'unaClaveLarga' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    // Segunda llamada = el UPDATE. El hash viaja como primer parametro.
    const [sql, params] = queryMock.mock.calls[1];
    expect(sql).toContain('UPDATE users');
    expect(params[0]).toMatch(/^\$2[aby]\$12\$/);
    expect(await bcrypt.compare('unaClaveLarga', params[0])).toBe(true);
  });
});

describe('PATCH /api/auth/email', () => {
  it('rechaza un formato de email invalido', async () => {
    const res = await request(handler)
      .patch('/?route=auth/email')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ newEmail: 'no-es-un-mail', currentPassword: 'admin123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_email');
  });

  it('rechaza si la contrasena actual no coincide', async () => {
    const hash = await bcrypt.hash('admin123', 10);
    queryMock.mockResolvedValueOnce({ rows: [{ password_hash: hash }] });

    const res = await request(handler)
      .patch('/?route=auth/email')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ newEmail: 'nuevo@balneario.com', currentPassword: 'equivocada' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_password');
  });

  it('rechaza un email que ya pertenece a otro usuario', async () => {
    const hash = await bcrypt.hash('admin123', 10);
    queryMock.mockResolvedValueOnce({ rows: [{ password_hash: hash }] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 9 }] });

    const res = await request(handler)
      .patch('/?route=auth/email')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ newEmail: 'ocupado@balneario.com', currentPassword: 'admin123' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('email_taken');
  });

  it('normaliza el email y lo guarda', async () => {
    const hash = await bcrypt.hash('admin123', 10);
    queryMock.mockResolvedValueOnce({ rows: [{ password_hash: hash }] });
    queryMock.mockResolvedValueOnce({ rows: [] });
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 2, email: 'nuevo@balneario.com', role: 'admin', created_at: '2025-11-23T10:00:00.000Z' }]
    });

    const res = await request(handler)
      .patch('/?route=auth/email')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ newEmail: '  NUEVO@Balneario.com  ', currentPassword: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('nuevo@balneario.com');

    // Segunda llamada = el chequeo de unicidad, con el mail ya normalizado.
    expect(queryMock.mock.calls[1][1][0]).toBe('nuevo@balneario.com');
  });

  it('chequea la contrasena antes que la unicidad del email', async () => {
    const hash = await bcrypt.hash('admin123', 10);
    queryMock.mockResolvedValueOnce({ rows: [{ password_hash: hash }] });

    await request(handler)
      .patch('/?route=auth/email')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ newEmail: 'ocupado@balneario.com', currentPassword: 'equivocada' });

    // Solo la consulta del hash: nunca se pregunto si el email existe.
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});

describe('precios de pileta en /api/reservation-groups', () => {
  it('guarda los precios por adulto y por nino al crear un pase', async () => {
    // En pileta no se chequea solapamiento: despues del establecimiento va el INSERT.
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // establecimiento
    queryMock.mockResolvedValueOnce({ rows: [{ id: 99, service_type: 'pileta', adults_count: 2, children_count: 1, pool_adult_price_per_day: '6000.00', pool_child_price_per_day: '3500.00' }] });

    const res = await request(handler)
      .post('/?route=reservation-groups')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({
        serviceType: 'pileta', resourceNumber: 1,
        startDate: '2026-09-22', endDate: '2026-09-22',
        customerName: 'Prueba', adultsCount: 2, childrenCount: 1,
        poolAdultPricePerDay: 6000, poolChildPricePerDay: 3500
      });

    expect(res.status).toBe(201);
    const insert = queryMock.mock.calls.find((c) => String(c[0]).includes('INSERT INTO reservation_groups'));
    expect(String(insert[0])).toContain('pool_adult_price_per_day');
    expect(insert[1]).toContain(6000);
    expect(insert[1]).toContain(3500);
  });

  it('los devuelve al leer la reserva', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 99, service_type: 'pileta', resource_number: 1, start_date: '2026-09-22', end_date: '2026-09-22', adults_count: 2, children_count: 1, pool_adult_price_per_day: '6000.00', pool_child_price_per_day: '3500.00', paid_amount: 0 }]
    });

    const res = await request(handler)
      .get('/?route=reservation-groups')
      .set('Authorization', `Bearer ${tokenPara(2)}`);

    expect(res.status).toBe(200);
    expect(res.body.reservationGroups[0].poolAdultPricePerDay).toBe('6000.00');
    expect(res.body.reservationGroups[0].poolChildPricePerDay).toBe('3500.00');
  });

  it('los actualiza al editar el pase', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 99, service_type: 'pileta', adults_count: 2, children_count: 1, pool_adult_price_per_day: '6000.00', pool_child_price_per_day: '3500.00' }] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 99, service_type: 'pileta', adults_count: 3, children_count: 1, pool_adult_price_per_day: '7000.00', pool_child_price_per_day: '3500.00' }] });

    const res = await request(handler)
      .patch('/?route=reservation-groups/99')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ adultsCount: 3, poolAdultPricePerDay: 7000 });

    expect(res.status).toBe(200);
    const update = queryMock.mock.calls.find((c) => String(c[0]).includes('UPDATE reservation_groups'));
    expect(String(update[0])).toContain('pool_adult_price_per_day');
    expect(res.body.reservationGroup.poolAdultPricePerDay).toBe('7000.00');
  });
});

describe('patente obligatoria en estacionamiento', () => {
  it('rechaza una reserva de estacionamiento sin patente', async () => {
    const res = await request(handler)
      .post('/?route=reservation-groups')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ serviceType: 'parking', resourceNumber: 12, startDate: '2026-09-26', endDate: '2026-09-30', customerName: 'Lucia' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('vehicle_plate_required');
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('guarda la patente normalizada: mayusculas y sin espacios ni guiones', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // establecimiento
    queryMock.mockResolvedValueOnce({ rows: [] }); // sin solapamiento
    sinTarifas();
    queryMock.mockResolvedValueOnce({ rows: [{ id: 50, service_type: 'parking', resource_number: 12, vehicle_plate: 'AB123CD' }] });

    const res = await request(handler)
      .post('/?route=reservation-groups')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ serviceType: 'parking', resourceNumber: 12, startDate: '2026-09-26', endDate: '2026-09-30', customerName: 'Lucia', vehiclePlate: ' ab 123-cd ' });

    expect(res.status).toBe(201);
    const insert = queryMock.mock.calls.find((c) => String(c[0]).includes('INSERT INTO reservation_groups'));
    expect(String(insert[0])).toContain('vehicle_plate');
    expect(insert[1]).toContain('AB123CD');
    expect(res.body.group.vehiclePlate).toBe('AB123CD');
  });

  it('en carpa no la pide', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    queryMock.mockResolvedValueOnce({ rows: [] }); // sin solapamiento
    sinTarifas();
    queryMock.mockResolvedValueOnce({ rows: [{ id: 51, service_type: 'carpa' }] });

    const res = await request(handler)
      .post('/?route=reservation-groups')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ serviceType: 'carpa', resourceNumber: 58, startDate: '2026-09-26', endDate: '2026-09-30', customerName: 'Lucia' });

    expect(res.status).toBe(201);
  });

  it('la devuelve al listar', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 50, service_type: 'parking', resource_number: 12, start_date: '2026-09-26', end_date: '2026-09-30', vehicle_plate: 'AB123CD', paid_amount: 0 }] });

    const res = await request(handler).get('/?route=reservation-groups').set('Authorization', `Bearer ${tokenPara(2)}`);

    expect(res.body.reservationGroups[0].vehiclePlate).toBe('AB123CD');
    const select = String(queryMock.mock.calls[1][0]);
    expect(select).toContain('rg.vehicle_plate');
  });

  it('al editar un estacionamiento no deja borrar la patente', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 50, service_type: 'parking', vehicle_plate: 'AB123CD' }] });

    const res = await request(handler)
      .patch('/?route=reservation-groups/50')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ vehiclePlate: '  ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('vehicle_plate_required');
  });

  it('al editar actualiza la patente', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 50, service_type: 'parking', vehicle_plate: 'AB123CD' }] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 50, service_type: 'parking', vehicle_plate: 'AC456DE' }] });

    const res = await request(handler)
      .patch('/?route=reservation-groups/50')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ vehiclePlate: 'ac 456 de' });

    expect(res.status).toBe(200);
    const update = queryMock.mock.calls.find((c) => String(c[0]).includes('UPDATE reservation_groups'));
    expect(update[1]).toContain('AC456DE');
    expect(res.body.reservationGroup.vehiclePlate).toBe('AC456DE');
  });
});

describe('precio por tarifa en /api/reservation-groups', () => {
  const TARIFA = { id: 10, service_type: 'carpa', alcance: 'tipo', clase: 'fecha', periodo_id: 1, precio: '10000.00' };
  const PERIODO = { id: 1, nombre: 'Todo el año', mes_inicio: 1, dia_inicio: 1, mes_fin: 12, dia_fin: 31, prioridad: 1 };
  const alta = { serviceType: 'carpa', resourceNumber: 58, startDate: '2026-01-10', endDate: '2026-01-12', customerName: 'Lucia' };
  const insertDe = () => queryMock.mock.calls.find((c) => String(c[0]).includes('INSERT INTO reservation_groups'));
  const updateDe = () => queryMock.mock.calls.find((c) => String(c[0]).includes('UPDATE reservation_groups'));

  function conTarifa() {
    queryMock.mockResolvedValueOnce({ rows: [TARIFA] });
    queryMock.mockResolvedValueOnce({ rows: [PERIODO] });
    queryMock.mockResolvedValueOnce({ rows: [] });
  }

  it('al crear calcula el precio y guarda el snapshot', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    queryMock.mockResolvedValueOnce({ rows: [] });
    conTarifa();
    queryMock.mockResolvedValueOnce({ rows: [{ id: 60, service_type: 'carpa', precio_tarifa: '30000.00', total_price: '30000.00', desglose: { clase: 'fecha' }, motivo_ajuste: null }] });

    const res = await request(handler).post('/?route=reservation-groups').set('Authorization', `Bearer ${tokenPara(2)}`).send(alta);

    expect(res.status).toBe(201);
    const [sql, params] = insertDe();
    expect(sql).toContain('precio_tarifa');
    expect(sql).toContain('desglose');
    expect(params).toContain(30000); // total y precio de tarifa
    expect(params).toContain(10000); // daily_price
    expect(params.find((p) => typeof p === 'string' && p.includes('"tramos"'))).toBeTruthy();
    expect(res.body.group.precioTarifa).toBe('30000.00');
  });

  it('no deja cobrar distinto a la tarifa sin motivo', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    queryMock.mockResolvedValueOnce({ rows: [] });
    conTarifa();

    const res = await request(handler).post('/?route=reservation-groups').set('Authorization', `Bearer ${tokenPara(2)}`).send({ ...alta, totalPrice: '25000' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('motivo_ajuste_required');
    expect(insertDe()).toBeUndefined();
  });

  it('con motivo guarda lo cobrado y el motivo', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    queryMock.mockResolvedValueOnce({ rows: [] });
    conTarifa();
    queryMock.mockResolvedValueOnce({ rows: [{ id: 61, service_type: 'carpa' }] });

    const res = await request(handler).post('/?route=reservation-groups').set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ ...alta, totalPrice: '25000', motivoAjuste: 'cliente de años' });

    expect(res.status).toBe(201);
    const params = insertDe()[1];
    expect(params).toContain(25000);
    expect(params).toContain(30000);
    expect(params).toContain('cliente de años');
  });

  it('sin tarifas cargadas guarda el precio que manda el navegador', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    queryMock.mockResolvedValueOnce({ rows: [] });
    sinTarifas();
    queryMock.mockResolvedValueOnce({ rows: [{ id: 62, service_type: 'carpa' }] });

    const res = await request(handler).post('/?route=reservation-groups').set('Authorization', `Bearer ${tokenPara(2)}`).send({ ...alta, totalPrice: '27000' });

    expect(res.status).toBe(201);
    const params = insertDe()[1];
    expect(params).toContain(27000);
    expect(params).toContain(9000);
  });

  const guardada = {
    id: 60, service_type: 'carpa', resource_number: 58,
    start_date: new Date(2026, 0, 10), end_date: new Date(2026, 0, 12),
    precio_tarifa: '30000.00', total_price: '30000.00', daily_price: '10000.00',
    desglose: { clase: 'fecha', tramos: [] }, motivo_ajuste: null
  };

  it('al editar las fechas recalcula con las tarifas vigentes', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    queryMock.mockResolvedValueOnce({ rows: [guardada] });
    queryMock.mockResolvedValueOnce({ rows: [] }); // sin conflicto
    conTarifa();
    queryMock.mockResolvedValueOnce({ rows: [{ ...guardada, end_date: '2026-01-14' }] });

    const res = await request(handler).patch('/?route=reservation-groups/60').set('Authorization', `Bearer ${tokenPara(2)}`).send({ endDate: '2026-01-14' });

    expect(res.status).toBe(200);
    expect(updateDe()[1]).toContain(50000);
  });

  it('al editar con la salida antes que la entrada responde 400 rango_invalido', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    queryMock.mockResolvedValueOnce({ rows: [guardada] });
    queryMock.mockResolvedValueOnce({ rows: [] }); // sin conflicto
    conTarifa();

    const res = await request(handler).patch('/?route=reservation-groups/60').set('Authorization', `Bearer ${tokenPara(2)}`).send({ endDate: '2026-01-05' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('rango_invalido');
    expect(updateDe()).toBeUndefined();
  });

  it('al editar solo las notas no recalcula ni pisa el snapshot', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    queryMock.mockResolvedValueOnce({ rows: [guardada] });
    queryMock.mockResolvedValueOnce({ rows: [guardada] });

    const res = await request(handler).patch('/?route=reservation-groups/60').set('Authorization', `Bearer ${tokenPara(2)}`).send({ notes: 'llega tarde' });

    expect(res.status).toBe(200);
    expect(queryMock).toHaveBeenCalledTimes(3);
    expect(updateDe()[1]).toContain(JSON.stringify(guardada.desglose));
  });

  it('mandar la misma fecha que ya tenia no cuenta como cambio', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    queryMock.mockResolvedValueOnce({ rows: [guardada] });
    queryMock.mockResolvedValueOnce({ rows: [guardada] });

    const res = await request(handler).patch('/?route=reservation-groups/60').set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ startDate: '2026-01-10', endDate: '2026-01-12', notes: 'x' });

    expect(res.status).toBe(200);
    expect(queryMock).toHaveBeenCalledTimes(3);
  });

  it('devuelve el snapshot al listar', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 60, service_type: 'carpa', resource_number: 58, start_date: '2026-01-10', end_date: '2026-01-12', precio_tarifa: '30000.00', desglose: { clase: 'fecha', tramos: [] }, motivo_ajuste: 'x', paid_amount: 0 }] });

    const res = await request(handler).get('/?route=reservation-groups').set('Authorization', `Bearer ${tokenPara(2)}`);

    expect(res.body.reservationGroups[0]).toMatchObject({ precioTarifa: '30000.00', motivoAjuste: 'x', desglose: { clase: 'fecha', tramos: [] } });
    const select = String(queryMock.mock.calls[1][0]);
    expect(select).toContain('rg.desglose');
  });
});
