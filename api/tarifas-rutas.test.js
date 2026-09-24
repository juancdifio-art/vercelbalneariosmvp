import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { queryMock } from './test/pg-mock.js';

process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgres://test';

const handler = (await import('./index.js')).default;
const token = () => jwt.sign({ userId: 2, email: 'admin@balneario.com' }, 'test-secret', { expiresIn: '1h' });

beforeEach(() => {
  queryMock.mockReset();
});

describe('/api/tarifas', () => {
  it('pide token', async () => {
    const res = await request(handler).get('/?route=tarifas');
    expect(res.status).toBe(401);
  });

  it('cotiza una unidad con los parametros del query', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 7 }] }); // establecimiento
    queryMock.mockResolvedValueOnce({ rows: [{ id: 10, service_type: 'carpa', alcance: 'tipo', clase: 'fecha', periodo_id: 1, precio: '10000.00' }] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1, nombre: 'Todo el año', mes_inicio: 1, dia_inicio: 1, mes_fin: 12, dia_fin: 31, prioridad: 1 }] });
    queryMock.mockResolvedValueOnce({ rows: [] });

    const res = await request(handler)
      .get('/?route=tarifas/cotizar&serviceType=carpa&resourceNumber=58&startDate=2026-01-10&endDate=2026-01-12')
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(200);
    expect(res.body.cotizacion.total).toBe(30000);
    expect(queryMock.mock.calls[1][1]).toEqual([7, 'carpa']);
  });

  it('crea un periodo con el body', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 7 }] });
    queryMock.mockResolvedValueOnce({ rows: [] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 3, nombre: 'Alta', mes_inicio: 12, dia_inicio: 15, mes_fin: 3, dia_fin: 15, prioridad: 1 }] });

    const res = await request(handler)
      .post('/?route=tarifas/periodos')
      .set('Authorization', `Bearer ${token()}`)
      .send({ nombre: 'Alta', mesInicio: 12, diaInicio: 15, mesFin: 3, diaFin: 15, prioridad: 1 });

    expect(res.status).toBe(201);
    expect(res.body.periodo.nombre).toBe('Alta');
  });

  it('borra una tarifa por id', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 7 }] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 12 }] });

    const res = await request(handler).delete('/?route=tarifas/12').set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(200);
    expect(String(queryMock.mock.calls[1][0])).toContain('DELETE FROM tarifas');
    expect(queryMock.mock.calls[1][1]).toEqual([12, 7]);
  });

  it('un error de base responde 500 y queda en el log', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    queryMock.mockResolvedValueOnce({ rows: [{ id: 7 }] });
    queryMock.mockRejectedValueOnce(new Error('connection refused'));

    const res = await request(handler).get('/?route=tarifas').set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('server_error');
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
