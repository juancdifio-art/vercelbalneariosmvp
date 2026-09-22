/**
 * Datos de demostración para el entorno local.
 *
 * Genera reservas y pagos repartidos entre los cuatro servicios y entre varias
 * fechas, para que el dashboard tenga algo que mostrar: métricas del día,
 * ocupación por servicio, últimas reservas, últimos pagos y próximos check-ins.
 *
 *   node seed-demo-data.js          agrega los datos de demo
 *   node seed-demo-data.js --reset  los borra y los vuelve a generar
 *
 * Las reservas que crea quedan marcadas con '[demo]' en notes, y es lo único
 * que borra el --reset. Las reservas cargadas a mano no se tocan.
 */

require('dotenv').config();
const { Pool } = require('pg');

// --- Guarda de seguridad -------------------------------------------------
// Produccion se conecta por DATABASE_URL (Supabase); el entorno local usa las
// variables sueltas. Si aparece DATABASE_URL, esto no es local: no seguimos.
if (process.env.DATABASE_URL) {
  console.error('ABORTADO: hay DATABASE_URL definida, que es la conexion de produccion.');
  console.error('Este script es solo para la base local.');
  process.exit(1);
}

const host = process.env.DB_HOST || 'localhost';
if (host !== 'localhost' && host !== '127.0.0.1') {
  console.error(`ABORTADO: DB_HOST es "${host}" y no apunta a localhost.`);
  process.exit(1);
}

const pool = new Pool({
  host,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

const MARCA = '[demo]';

/** Fecha desplazada en días desde hoy, en formato yyyy-mm-dd. */
function dia(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

/**
 * Las reservas se reparten a proposito:
 * - algunas activas hoy, para que la ocupacion y "Activas hoy" no den cero
 * - dos que arrancan en los proximos dias, para "Proximos check-ins"
 * - los cuatro servicios mezclados, que es lo que deja ver los colores de los
 *   iconos en los listados
 */
const RESERVAS = [
  { servicio: 'carpa',     unidad: 12,  desde: dia(-2), hasta: dia(3),  diario: 18000 },
  { servicio: 'carpa',     unidad: 27,  desde: dia(0),  hasta: dia(6),  diario: 18000 },
  { servicio: 'carpa',     unidad: 41,  desde: dia(2),  hasta: dia(9),  diario: 20000 },
  { servicio: 'sombrilla', unidad: 5,   desde: dia(-1), hasta: dia(4),  diario: 9000 },
  { servicio: 'sombrilla', unidad: 88,  desde: dia(0),  hasta: dia(2),  diario: 9000 },
  { servicio: 'sombrilla', unidad: 134, desde: dia(3),  hasta: dia(8),  diario: 9500 },
  { servicio: 'parking',   unidad: 14,  desde: dia(-3), hasta: dia(5),  diario: 4500 },
  { servicio: 'parking',   unidad: 102, desde: dia(0),  hasta: dia(1),  diario: 4500 },
  { servicio: 'pileta',    unidad: 1,   desde: dia(0),  hasta: dia(0),  adultos: 2, ninos: 1 },
  { servicio: 'pileta',    unidad: 1,   desde: dia(-1), hasta: dia(-1), adultos: 4, ninos: 0 },
  { servicio: 'pileta',    unidad: 1,   desde: dia(1),  hasta: dia(1),  adultos: 2, ninos: 3 }
];

const PRECIO_ADULTO = 6000;
const PRECIO_NINO = 3500;
const METODOS = ['cash', 'transfer', 'card'];

function noches(desde, hasta) {
  const ms = new Date(hasta + 'T00:00:00Z') - new Date(desde + 'T00:00:00Z');
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

async function main() {
  const reset = process.argv.includes('--reset');

  const est = await pool.query('SELECT id FROM establishments ORDER BY id LIMIT 1');
  if (est.rows.length === 0) {
    console.error('ABORTADO: no hay ningun establecimiento cargado.');
    process.exit(1);
  }
  const establecimientoId = est.rows[0].id;

  if (reset) {
    const borrados = await pool.query(
      `DELETE FROM reservation_groups WHERE establishment_id = $1 AND notes LIKE $2 RETURNING id`,
      [establecimientoId, `%${MARCA}%`]
    );
    // Los pagos caen solos por ON DELETE CASCADE.
    console.log(`Borradas ${borrados.rowCount} reservas de demo previas.`);
  }

  const clientes = await pool.query(
    'SELECT id, full_name, phone FROM clients WHERE establishment_id = $1 ORDER BY id LIMIT 8',
    [establecimientoId]
  );
  if (clientes.rows.length === 0) {
    console.error('ABORTADO: no hay clientes cargados para asociar a las reservas.');
    process.exit(1);
  }

  let creadas = 0;
  let pagos = 0;

  for (let i = 0; i < RESERVAS.length; i++) {
    const r = RESERVAS[i];
    const cliente = clientes.rows[i % clientes.rows.length];
    const dias = noches(r.desde, r.hasta);

    const esPileta = r.servicio === 'pileta';
    const diario = esPileta
      ? r.adultos * PRECIO_ADULTO + r.ninos * PRECIO_NINO
      : r.diario;
    const total = diario * dias;

    const ins = await pool.query(
      `INSERT INTO reservation_groups
         (establishment_id, service_type, resource_number, start_date, end_date,
          customer_name, customer_phone, daily_price, total_price, notes, status, client_id,
          pool_adults_count, pool_children_count, pool_adult_price_per_day, pool_child_price_per_day)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',$11,$12,$13,$14,$15)
       RETURNING id`,
      [
        establecimientoId,
        r.servicio,
        r.unidad,
        r.desde,
        r.hasta,
        cliente.full_name,
        cliente.phone,
        diario,
        total,
        MARCA,
        cliente.id,
        esPileta ? r.adultos : 0,
        esPileta ? r.ninos : 0,
        esPileta ? PRECIO_ADULTO : null,
        esPileta ? PRECIO_NINO : null
      ]
    );
    creadas++;

    // Dos de cada tres reservas llevan un pago; una parcial de cada tres, para
    // que los reportes de saldo pendiente tengan algo que mostrar.
    if (i % 3 !== 2) {
      const parcial = i % 3 === 1;
      await pool.query(
        `INSERT INTO reservation_payments
           (establishment_id, reservation_group_id, client_id, amount, payment_date, method, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          establecimientoId,
          ins.rows[0].id,
          cliente.id,
          parcial ? Math.round(total / 2) : total,
          i < 4 ? dia(0) : dia(-(i % 5)),
          METODOS[i % METODOS.length],
          MARCA
        ]
      );
      pagos++;
    }
  }

  console.log(`Listo: ${creadas} reservas y ${pagos} pagos de demo en "${process.env.DB_NAME}".`);

  const resumen = await pool.query(
    `SELECT service_type, COUNT(*)::int AS n
       FROM reservation_groups
      WHERE establishment_id = $1 AND notes LIKE $2
      GROUP BY service_type ORDER BY service_type`,
    [establecimientoId, `%${MARCA}%`]
  );
  console.table(resumen.rows);

  await pool.end();
}

main().catch((e) => {
  console.error('FALLO:', e.message);
  process.exit(1);
});
