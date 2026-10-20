import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { queryMock } from './test/pg-mock.js';
import { validarContrato, MAX_CONDICIONES } from './_contrato/servicio.js';

// Contrato imprimible en el router serverless. La primera consulta de cada
// pedido es el establecimiento de quien pide.
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgres://test';

const handler = (await import('./index.js')).default;
const token = `Bearer ${jwt.sign({ userId: 2, email: 'a@b.c' }, 'test-secret', { expiresIn: '1h' })}`;

const miBalneario = () => queryMock.mockResolvedValueOnce({ rows: [{ id: 7 }] });

beforeEach(() => {
  queryMock.mockReset();
});

describe('/api/contrato', () => {
  it('sin token responde 401', async () => {
    expect((await request(handler).get('/?route=contrato')).status).toBe(401);
  });

  it('sin balneario responde 404', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const res = await request(handler).get('/?route=contrato').set('Authorization', token);
    expect(res.status).toBe(404);
  });

  it('lee el del propio balneario, vacio si nunca se cargo', async () => {
    miBalneario();
    queryMock.mockResolvedValueOnce({ rows: [{ contrato_titulo: null, contrato_condiciones: null }] });

    const res = await request(handler).get('/?route=contrato').set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.contrato).toEqual({ titulo: '', condiciones: '' });
    expect(queryMock.mock.calls[0][1]).toEqual([2]);
    expect(queryMock.mock.calls[1][1]).toEqual([7]);
  });

  it('guarda titulo y condiciones solo en el propio balneario', async () => {
    miBalneario();
    queryMock.mockResolvedValueOnce({ rows: [{ contrato_titulo: 'Contratacion 2026-2027', contrato_condiciones: '1 - Uno\n\n2 - Dos' }] });

    const res = await request(handler).put('/?route=contrato').set('Authorization', token)
      .send({ titulo: '  Contratacion 2026-2027 ', condiciones: '\n\n1 - Uno\r\n\r\n2 - Dos  \n' });

    expect(res.status).toBe(200);
    expect(res.body.contrato).toEqual({ titulo: 'Contratacion 2026-2027', condiciones: '1 - Uno\n\n2 - Dos' });
    const [sql, params] = queryMock.mock.calls[1];
    expect(sql).toMatch(/UPDATE establishments SET contrato_titulo = \$1, contrato_condiciones = \$2 WHERE id = \$3/);
    expect(params).toEqual(['Contratacion 2026-2027', '1 - Uno\n\n2 - Dos', 7]);
  });

  it('rechaza un texto demasiado largo sin escribir', async () => {
    miBalneario();
    const res = await request(handler).put('/?route=contrato').set('Authorization', token)
      .send({ condiciones: 'x'.repeat(MAX_CONDICIONES + 1) });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('condiciones_largas');
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('otro metodo o un segmento de mas no se aceptan', async () => {
    miBalneario();
    expect((await request(handler).delete('/?route=contrato').set('Authorization', token)).status).toBe(405);
    miBalneario();
    expect((await request(handler).get('/?route=contrato/8').set('Authorization', token)).status).toBe(404);
  });
});

describe('validarContrato', () => {
  it('vacio se guarda como null', () => {
    expect(validarContrato({ titulo: '  ', condiciones: '\n \n' })).toEqual({ titulo: null, condiciones: null });
  });

  it('quita el byte nulo y conserva la sangria de las lineas', () => {
    expect(validarContrato({ condiciones: 'Uno\u0000\n  - sangria' }).condiciones).toBe('Uno\n  - sangria');
  });

  it('un titulo de mas de 120 caracteres no va', () => {
    expect(validarContrato({ titulo: 'x'.repeat(121) }).error).toBe('titulo_largo');
  });
});
