import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import servicio from './_cuentas/servicio.js';
import { esFalla } from './_incluidos/transaccion.js';

// Prueba el SQL de _cuentas contra una base real (la local). No corre con
// `npm test`: hace falta DB_INTEGRACION=1 y las variables DB_* del backend.
//   cd api && DB_INTEGRACION=1 npx vitest run cuentas-integracion.test.js
// Todo pasa dentro de una transaccion que se deshace al final, incluida la
// columna administra_cuentas si la base todavia no la tiene.

const activo = process.env.DB_INTEGRACION === '1';
const require = createRequire(import.meta.url);

describe.skipIf(!activo)('alta de cuenta con modelo contra la base', () => {
  let pool;
  let client;
  let query;
  let admin;
  let modelo;
  // El alta corre en un savepoint: la transaccion de afuera es la del test.
  const transaccion = async (fn) => {
    await query('SAVEPOINT alta');
    const r = await fn(query);
    await query(esFalla(r) ? 'ROLLBACK TO SAVEPOINT alta' : 'RELEASE SAVEPOINT alta');
    return r;
  };
  const rutear = (method, partes, body) =>
    servicio.rutearCuentas(query, admin.id, { method, partes, body, transaccion, hashear: async (c) => `hash:${c}` });

  beforeAll(async () => {
    require('../backend/node_modules/dotenv').config({ path: '../backend/.env' });
    const { Pool } = require('../backend/node_modules/pg');
    pool = new Pool({
      host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD
    });
    client = await pool.connect();
    query = (sql, params) => client.query(sql, params);
    await query('BEGIN');
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS administra_cuentas BOOLEAN NOT NULL DEFAULT FALSE');

    admin = (await query("INSERT INTO users (email, password_hash, administra_cuentas) VALUES ('admin-integracion@test.local', 'x', TRUE) RETURNING id")).rows[0];
    modelo = (await query(
      "INSERT INTO establishments (user_id, name, has_carpas, has_pileta, carpas_capacity, pool_max_occupancy, pases_pileta_por_carpa) VALUES ($1, 'Modelo', true, true, 117, 150, 3) RETURNING *",
      [admin.id]
    )).rows[0];
    const alta = (await query(
      "INSERT INTO periodos_tarifarios (establishment_id, nombre, mes_inicio, dia_inicio, mes_fin, dia_fin, prioridad) VALUES ($1, 'Alta', 1, 1, 1, 31, 2) RETURNING id",
      [modelo.id]
    )).rows[0];
    const sector = (await query(
      "INSERT INTO sectores (establishment_id, service_type, nombre) VALUES ($1, 'carpa', 'Primera fila') RETURNING id",
      [modelo.id]
    )).rows[0];
    await query(
      "INSERT INTO sector_unidades (sector_id, establishment_id, service_type, resource_number) VALUES ($1, $2, 'carpa', 1), ($1, $2, 'carpa', 2)",
      [sector.id, modelo.id]
    );
    await query(
      `INSERT INTO tarifas (establishment_id, service_type, alcance, sector_id, resource_number, clase, periodo_id, nombre, dias_min, dias_max, modo, precio) VALUES
        ($1, 'carpa', 'tipo', NULL, NULL, 'fecha', $2, NULL, NULL, NULL, NULL, 50000),
        ($1, 'carpa', 'sector', $3, NULL, 'fecha', $2, NULL, NULL, NULL, NULL, 65000),
        ($1, 'carpa', 'tipo', NULL, NULL, 'estadia', NULL, 'Quincena', 15, 15, 'cerrado', 600000)`,
      [modelo.id, alta.id, sector.id]
    );
    await query(
      "INSERT INTO reservation_groups (establishment_id, service_type, resource_number, start_date, end_date, customer_name) VALUES ($1, 'carpa', 1, '2027-01-10', '2027-01-20', 'No se copia')",
      [modelo.id]
    );
  });

  afterAll(async () => {
    if (client) {
      await client.query('ROLLBACK');
      client.release();
    }
    if (pool) await pool.end();
  });

  it('copia configuracion, periodos, sectores con sus unidades y tarifas, sin reservas', async () => {
    const r = await rutear('POST', [], { email: 'Nuevo-Integracion@Test.local', copiarDe: modelo.id, nombre: 'Copia' });
    expect(r.status).toBe(201);
    const nuevo = r.body.cuenta.balneario.id;

    const est = (await query('SELECT * FROM establishments WHERE id = $1', [nuevo])).rows[0];
    expect(est).toMatchObject({ name: 'Copia', has_carpas: true, has_pileta: true, carpas_capacity: 117, pool_max_occupancy: 150, pases_pileta_por_carpa: 3 });
    expect((await query('SELECT email, password_hash FROM users WHERE id = $1', [est.user_id])).rows[0])
      .toEqual({ email: 'nuevo-integracion@test.local', password_hash: `hash:${r.body.clave}` });

    const periodos = (await query('SELECT id, nombre FROM periodos_tarifarios WHERE establishment_id = $1', [nuevo])).rows;
    const sectores = (await query('SELECT id, nombre FROM sectores WHERE establishment_id = $1', [nuevo])).rows;
    expect(periodos.map((p) => p.nombre)).toEqual(['Alta']);
    expect(sectores.map((s) => s.nombre)).toEqual(['Primera fila']);
    const unidades = (await query('SELECT sector_id, resource_number FROM sector_unidades WHERE establishment_id = $1 ORDER BY resource_number', [nuevo])).rows;
    expect(unidades).toEqual([{ sector_id: sectores[0].id, resource_number: 1 }, { sector_id: sectores[0].id, resource_number: 2 }]);

    // Cada tarifa apunta al periodo y al sector del balneario nuevo, no a los del modelo.
    const tarifas = (await query('SELECT alcance, clase, sector_id, periodo_id, precio FROM tarifas WHERE establishment_id = $1 ORDER BY id', [nuevo])).rows;
    expect(tarifas).toEqual([
      { alcance: 'tipo', clase: 'fecha', sector_id: null, periodo_id: periodos[0].id, precio: '50000.00' },
      { alcance: 'sector', clase: 'fecha', sector_id: sectores[0].id, periodo_id: periodos[0].id, precio: '65000.00' },
      { alcance: 'tipo', clase: 'estadia', sector_id: null, periodo_id: null, precio: '600000.00' }
    ]);

    expect((await query('SELECT COUNT(*)::int AS n FROM reservation_groups WHERE establishment_id = $1', [nuevo])).rows[0].n).toBe(0);
  });

  it('el listado trae la cuenta nueva y el modelo con su reserva', async () => {
    const r = await rutear('GET', [], {});
    expect(r.status).toBe(200);
    const modeloEnLista = r.body.cuentas.find((c) => c.balneario?.id === modelo.id);
    expect(modeloEnLista).toMatchObject({ email: 'admin-integracion@test.local', administra: true, reservas: 1 });
    expect(r.body.cuentas.some((c) => c.email === 'nuevo-integracion@test.local')).toBe(true);
  });

  it('el mismo email con otras mayusculas no se puede crear de nuevo', async () => {
    const r = await rutear('POST', [], { email: 'NUEVO-integracion@test.local' });
    expect(r.status).toBe(409);
  });

  it('la clave nueva queda guardada', async () => {
    const id = (await query("SELECT id FROM users WHERE email = 'nuevo-integracion@test.local'")).rows[0].id;
    const r = await rutear('POST', [String(id), 'clave'], {});
    expect(r.status).toBe(200);
    expect((await query('SELECT password_hash FROM users WHERE id = $1', [id])).rows[0].password_hash).toBe(`hash:${r.body.clave}`);
  });
});
