import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import servicio from './_incluidos/servicio.js';

// Prueba el SQL de _incluidos contra una base real (la local). No corre con
// `npm test`: hace falta DB_INTEGRACION=1 y las variables DB_* del backend.
//   cd api && DB_INTEGRACION=1 npx vitest run incluidos-integracion.test.js
// Todo pasa dentro de una transaccion que se deshace al final.

const activo = process.env.DB_INTEGRACION === '1';
const require = createRequire(import.meta.url);

describe.skipIf(!activo)('servicios incluidos contra la base', () => {
  let pool;
  let client;
  let query;
  let est;
  let carpa;

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

    const user = (await query("INSERT INTO users (email, password_hash) VALUES ('integracion@test.local', 'x') RETURNING id")).rows[0];
    est = (await query(
      "INSERT INTO establishments (user_id, name, has_parking, has_carpas, has_pileta, parking_capacity) VALUES ($1, 'Test', true, true, true, 3) RETURNING *",
      [user.id]
    )).rows[0];
    const cli = (await query(
      "INSERT INTO clients (establishment_id, full_name, document_number, birth_date) VALUES ($1, 'Lucia Gomez', '30111222', '1990-05-01') RETURNING id",
      [est.id]
    )).rows[0];
    carpa = (await query(
      "INSERT INTO reservation_groups (establishment_id, service_type, resource_number, start_date, end_date, customer_name, client_id, adults_count, children_count) VALUES ($1, 'carpa', 12, '2026-01-10', '2026-01-20', 'Lucia', $2, 3, 2) RETURNING *",
      [est.id, cli.id]
    )).rows[0];
  });

  afterAll(async () => {
    if (client) {
      await client.query('ROLLBACK');
      client.release();
    }
    if (pool) await pool.end();
  });

  it('crea pileta y cocheras vinculadas, con el titular asignado', async () => {
    const r = await servicio.crearIncluidos(query, est, carpa, {
      pileta: true,
      cocheras: [
        { plaza: 2, vehiclePlate: 'AB123CD', totalPrice: 700000, motivoAjuste: null },
        { plaza: null, vehiclePlate: 'AC456EF', totalPrice: 600000, motivoAjuste: null }
      ]
    });

    expect(r.error).toBeUndefined();
    expect(r.pileta.asignados).toBe(1);
    expect(r.cocheras.map((c) => c.plaza)).toEqual([2, 1]);
  });

  it('una tercera cochera en la plaza 2 choca', async () => {
    const r = await servicio.crearIncluidos(query, est, carpa, {
      pileta: false, cocheras: [{ plaza: 2, vehiclePlate: 'XX999XX', totalPrice: null, motivoAjuste: null }]
    });
    expect(r).toMatchObject({ error: 'resource_conflict' });
  });

  it('asigna acompanantes y respeta el tope de 4', async () => {
    const pase = (await query("SELECT id FROM reservation_groups WHERE incluida_en_reserva_id = $1 AND service_type = 'pileta'", [carpa.id])).rows[0];
    const ids = [];
    for (const [nombre, edad] of [['Ana', 40], ['Beto', 10], ['Caro', 12], ['Dani', 15]]) {
      ids.push((await query(
        'INSERT INTO reservation_guests (establishment_id, reservation_group_id, full_name, document_number, age) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [est.id, carpa.id, nombre, `${edad}000`, edad]
      )).rows[0].id);
    }

    const demasiados = await servicio.rutearPasePersonas(query, est, pase.id, 'PUT', { guestIds: ids, incluyeTitular: true });
    expect(demasiados.body.error).toBe('demasiados_pases');

    const ok = await servicio.rutearPasePersonas(query, est, pase.id, 'PUT', { guestIds: ids.slice(0, 3), incluyeTitular: true });
    expect(ok.status).toBe(200);
    expect(ok.body.personas[0].fullName).toBe('Lucia Gomez');

    const conteo = (await query('SELECT adults_count, children_count FROM reservation_groups WHERE id = $1', [pase.id])).rows[0];
    expect(conteo).toEqual({ adults_count: 2, children_count: 2 });
  });

  it('el GET trae el resumen de la carpa y el vinculo del pase', async () => {
    const r = await query(
      `SELECT rg.id, ${servicio.SQL_COLUMNAS_VINCULO} 1 AS fin
       FROM reservation_groups rg ${servicio.SQL_JOIN_PADRE}
       WHERE rg.establishment_id = $1
       GROUP BY rg.id, ${servicio.SQL_GROUP_VINCULO} rg.resource_number`,
      [est.id]
    );
    const filas = r.rows.map((row) => ({ id: row.id, ...servicio.mapVinculo(row) }));
    const deCarpa = filas.find((f) => f.id === carpa.id);
    expect(deCarpa.incluidos.pileta.asignados).toBe(4);
    expect(deCarpa.incluidos.cocheras).toHaveLength(2);
    const pase = filas.find((f) => f.vinculo === 'incluido' && f.incluidaEnTipo === 'carpa' && f.paseNombres.length);
    expect(pase.incluidaEnNumero).toBe(12);
    expect(pase.paseNombres[0]).toBe('Lucia Gomez');
  });

  it('mover la carpa mueve los incluidos; cancelarla los cancela', async () => {
    const movida = { ...carpa, start_date: '2026-01-12', end_date: '2026-01-22' };
    const r = await servicio.sincronizarIncluidos(query, est.id, movida, { fechasCambiaron: true });
    expect(r).toEqual({ adicionalesAsociados: 0 });
    const fechas = (await query("SELECT DISTINCT start_date::text AS d FROM reservation_groups WHERE incluida_en_reserva_id = $1", [carpa.id])).rows;
    expect(fechas).toEqual([{ d: '2026-01-12' }]);

    await servicio.sincronizarIncluidos(query, est.id, movida, { cancelada: true });
    const activos = (await query("SELECT COUNT(*)::int AS n FROM reservation_groups WHERE incluida_en_reserva_id = $1 AND status = 'active'", [carpa.id])).rows[0];
    expect(activos.n).toBe(0);
  });

  it('volver a agregar la pileta reactiva el pase con sus personas', async () => {
    const r = await servicio.modificarIncluidos(query, est, carpa, { pileta: true });
    expect(r.error).toBeUndefined();
    const pase = (await query("SELECT status FROM reservation_groups WHERE incluida_en_reserva_id = $1 AND service_type = 'pileta'", [carpa.id])).rows;
    expect(pase).toEqual([{ status: 'active' }]);
  });
});
