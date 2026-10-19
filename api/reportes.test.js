import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { queryMock } from './test/pg-mock.js';

// Reporte de pagos (_handlers/reports/payments.js, el que usa produccion).
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgres://test';

const handler = (await import('./index.js')).default;
const token = `Bearer ${jwt.sign({ userId: 2, email: 'a@b.c' }, 'test-secret', { expiresIn: '1h' })}`;

const pago = (extra) => ({
  id: 1, amount: '45000.00', payment_date: '2027-01-02', method: null, payment_method: 'cash', notes: null, client_id: null,
  reservation_group_id: 10, service_type: 'carpa', resource_number: 14, customer_name: 'Ana', client_full_name: null, ...extra
});

beforeEach(() => {
  queryMock.mockReset();
});

describe('reporte de pagos en produccion', () => {
  it('lee el medio de pago de payment_method, donde lo guarda produccion', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    // La consulta ya devuelve el medio resuelto con COALESCE.
    queryMock.mockResolvedValueOnce({ rows: [pago({ method: 'cash' })] });

    const res = await request(handler).get('/?route=reports/payments&from=2027-01-02&to=2027-01-02').set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.payments[0].method).toBe('cash');
    const [sql] = queryMock.mock.calls[1];
    expect(sql).toContain('COALESCE(p.payment_method, p.method) AS method');
  });

  it('el filtro por medio de pago busca en payment_method y en method', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    queryMock.mockResolvedValueOnce({ rows: [] });

    await request(handler).get('/?route=reports/payments&from=2027-01-02&to=2027-01-02&method=cash').set('Authorization', token);

    const [sql, params] = queryMock.mock.calls[1];
    expect(sql).toMatch(/AND COALESCE\(p\.payment_method, p\.method\) = \$4/);
    expect(params).toEqual([1, '2027-01-02', '2027-01-02', 'cash']);
  });
});
