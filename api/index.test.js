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
