import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
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
