// Administracion de cuentas: el administrador general (users.administra_cuentas)
// ve todas las cuentas de la app, crea la de un balneario nuevo y le genera una
// clave nueva a quien la olvido. No importa pg ni bcrypt: recibe `query`,
// `transaccion` y `hashear` de cada API, asi lo comparten api/index.js y
// backend/src/index.js. El permiso se lee de la base en cada pedido, como el de
// soporte: el token no lo trae, y quitarlo corta el acceso en el acto.

const crypto = require('crypto');

const MAX_ID = 2147483647; // INTEGER de Postgres
const MAX_EMAIL = 255;
const MAX_NOMBRE = 255;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sin los caracteres que se confunden al dictar o copiar a mano (0/O, 1/l/I).
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

// Lo que se copia del balneario modelo: toda su configuracion menos el nombre,
// el dueno y las fechas.
const COLUMNAS_CONFIG = [
  'has_parking', 'has_carpas', 'has_sombrillas', 'has_pileta',
  'parking_capacity', 'carpas_capacity', 'sombrillas_capacity', 'pool_max_occupancy',
  'pases_pileta_por_carpa', 'pases_pileta_por_sombrilla', 'max_personas_por_unidad'
];

// Postgres rechaza el byte 0 en un texto: se quita antes de validar.
const limpio = (v) => String(v ?? '').replace(/\u0000/g, '').trim();

const ok = (body, status = 200) => ({ status, body });
const falla = (status, error) => ({ status, body: { error } });

const idValido = (n) => Number.isInteger(n) && n > 0 && n <= MAX_ID;

/** 12 caracteres en grupos de 4 ("Kp7m-x4Qz-9tRw"): unos 70 bits, y se puede dictar. */
function generarClave() {
  let clave = '';
  for (let i = 0; i < 12; i += 1) {
    if (i > 0 && i % 4 === 0) clave += '-';
    clave += ALFABETO[crypto.randomInt(ALFABETO.length)];
  }
  return clave;
}

const mapCuenta = (r) => ({
  id: r.id,
  email: r.email,
  rol: r.role,
  administra: r.administra_cuentas === true,
  creada: r.created_at,
  balneario: r.establishment_id ? { id: r.establishment_id, nombre: r.establishment_name } : null,
  reservas: r.reservas ?? 0
});

// El email se guarda en minusculas. El balneario modelo y su nombre van juntos:
// sin modelo no se crea balneario y el cliente lo configura al entrar.
function validarAlta(body) {
  const email = limpio(body?.email).toLowerCase();
  if (!email) return { error: 'email_requerido' };
  if (email.length > MAX_EMAIL || !EMAIL.test(email)) return { error: 'email_invalido' };
  const copiarDe = body?.copiarDe == null || body.copiarDe === '' ? null : Number(body.copiarDe);
  if (copiarDe !== null && !idValido(copiarDe)) return { error: 'id_invalido' };
  const nombre = limpio(body?.nombre);
  if (copiarDe !== null && !nombre) return { error: 'nombre_requerido' };
  if (nombre.length > MAX_NOMBRE) return { error: 'nombre_largo' };
  return { email, copiarDe, nombre: copiarDe !== null ? nombre : null };
}

async function listar(query) {
  const r = await query(
    `SELECT u.id, u.email, u.role, u.administra_cuentas, u.created_at,
            e.id AS establishment_id, e.name AS establishment_name,
            (SELECT COUNT(*)::int FROM reservation_groups rg WHERE rg.establishment_id = e.id) AS reservas
       FROM users u
       LEFT JOIN establishments e ON e.user_id = u.id
      ORDER BY u.created_at DESC NULLS LAST, u.id DESC`
  );
  return r.rows.map(mapCuenta);
}

// Balneario nuevo con la configuracion, los periodos, los sectores y las
// tarifas del modelo. Sin clientes ni reservas. Devuelve null si el modelo no
// existe. Corre dentro de la transaccion del alta.
async function crearBalnearioCopiado(q, origenId, userId, nombre) {
  const cols = COLUMNAS_CONFIG.join(', ');
  const est = await q(
    `INSERT INTO establishments (user_id, name, ${cols})
     SELECT $1, $2, ${cols} FROM establishments WHERE id = $3
     RETURNING id, name`,
    [userId, nombre, origenId]
  );
  if (!est.rows.length) return null;
  const destino = est.rows[0].id;

  // Las tarifas nombran su periodo y su sector por id: se anota que id nuevo
  // le toco a cada uno y las tarifas se copian todas juntas con ese cruce.
  const periodos = { viejos: [], nuevos: [] };
  const origenPeriodos = await q(
    'SELECT id, nombre, mes_inicio, dia_inicio, mes_fin, dia_fin, prioridad FROM periodos_tarifarios WHERE establishment_id = $1 ORDER BY id',
    [origenId]
  );
  for (const p of origenPeriodos.rows) {
    const n = await q(
      'INSERT INTO periodos_tarifarios (establishment_id, nombre, mes_inicio, dia_inicio, mes_fin, dia_fin, prioridad) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [destino, p.nombre, p.mes_inicio, p.dia_inicio, p.mes_fin, p.dia_fin, p.prioridad]
    );
    periodos.viejos.push(p.id);
    periodos.nuevos.push(n.rows[0].id);
  }

  const sectores = { viejos: [], nuevos: [] };
  const origenSectores = await q(
    'SELECT id, service_type, nombre, color FROM sectores WHERE establishment_id = $1 ORDER BY id',
    [origenId]
  );
  for (const s of origenSectores.rows) {
    const n = await q(
      'INSERT INTO sectores (establishment_id, service_type, nombre, color) VALUES ($1, $2, $3, $4) RETURNING id',
      [destino, s.service_type, s.nombre, s.color]
    );
    await q(
      'INSERT INTO sector_unidades (sector_id, establishment_id, service_type, resource_number) SELECT $1, $2, service_type, resource_number FROM sector_unidades WHERE sector_id = $3',
      [n.rows[0].id, destino, s.id]
    );
    sectores.viejos.push(s.id);
    sectores.nuevos.push(n.rows[0].id);
  }

  await q(
    `INSERT INTO tarifas (establishment_id, service_type, alcance, sector_id, resource_number, clase, periodo_id, nombre, dias_min, dias_max, modo, precio)
     SELECT $2, t.service_type, t.alcance, s.nuevo, t.resource_number, t.clase, p.nuevo, t.nombre, t.dias_min, t.dias_max, t.modo, t.precio
       FROM tarifas t
       LEFT JOIN unnest($3::int[], $4::int[]) AS s(viejo, nuevo) ON s.viejo = t.sector_id
       LEFT JOIN unnest($5::int[], $6::int[]) AS p(viejo, nuevo) ON p.viejo = t.periodo_id
      WHERE t.establishment_id = $1
      ORDER BY t.id`,
    [origenId, destino, sectores.viejos, sectores.nuevos, periodos.viejos, periodos.nuevos]
  );

  return est.rows[0];
}

async function crear(transaccion, hashear, adminId, body) {
  const datos = validarAlta(body);
  if (datos.error) return falla(400, datos.error);

  const clave = generarClave();
  // bcrypt tarda: se hashea antes de abrir la transaccion.
  const hash = await hashear(clave);

  let r;
  try {
    r = await transaccion(async (q) => {
      const ya = await q('SELECT id FROM users WHERE lower(email) = $1', [datos.email]);
      if (ya.rows.length) return falla(409, 'email_taken');
      const u = (await q(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, role, administra_cuentas, created_at',
        [datos.email, hash]
      )).rows[0];
      let est = null;
      if (datos.copiarDe !== null) {
        est = await crearBalnearioCopiado(q, datos.copiarDe, u.id, datos.nombre);
        if (!est) return falla(404, 'modelo_no_encontrado');
      }
      const cuenta = mapCuenta({ ...u, establishment_id: est?.id, establishment_name: est?.name, reservas: 0 });
      return ok({ cuenta, clave }, 201);
    });
  } catch (error) {
    // Dos altas con el mismo email a la vez: la segunda choca con el UNIQUE.
    if (error?.code === '23505') return falla(409, 'email_taken');
    throw error;
  }

  if (r.status === 201) {
    console.info(JSON.stringify({ evento: 'cuenta_creada', por: adminId, cuenta: r.body.cuenta.id, modelo: datos.copiarDe }));
  }
  return r;
}

// La clave propia se cambia desde el Panel de usuario, con la actual. La de
// otro administrador general tampoco: quien tome una cuenta de administrador
// no tiene que poder quedarse con las demas.
async function nuevaClave(query, hashear, adminId, idTexto) {
  const id = Number(idTexto);
  if (!idValido(id)) return falla(400, 'id_invalido');
  if (id === Number(adminId)) return falla(400, 'es_tu_cuenta');

  const cuenta = await query('SELECT id, email, administra_cuentas FROM users WHERE id = $1', [id]);
  if (!cuenta.rows.length) return falla(404, 'cuenta_no_encontrada');
  if (cuenta.rows[0].administra_cuentas === true) return falla(403, 'otro_administrador');

  const clave = generarClave();
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [await hashear(clave), id]);
  console.info(JSON.stringify({ evento: 'clave_regenerada', por: adminId, cuenta: id }));
  return ok({ cuenta: { id, email: cuenta.rows[0].email }, clave });
}

/**
 * Rutas bajo /api/cuentas:
 *   GET  acceso           todos: { administra } (si el menu suma Cuentas)
 *   GET  (raiz)           administrador: todas las cuentas
 *   POST (raiz)           administrador: { email, copiarDe?, nombre? } -> { cuenta, clave }
 *   POST :id/clave        administrador: clave nueva -> { cuenta, clave }
 * La clave se devuelve una sola vez: en la base queda solo el hash.
 * Devuelve { status, body }; cada API solo lo traduce.
 */
async function rutearCuentas(query, userId, { method, partes, body, transaccion, hashear }) {
  const yo = (await query('SELECT administra_cuentas FROM users WHERE id = $1', [userId])).rows[0];
  if (!yo) return falla(401, 'user_not_found');
  const administra = yo.administra_cuentas === true;
  const [recurso = '', accion, sobra] = partes;
  if (sobra !== undefined) return falla(404, 'not_found');

  if (recurso === 'acceso' && !accion && method === 'GET') return ok({ administra });

  if (!administra) return falla(403, 'solo_administrador');

  if (!recurso && method === 'GET') return ok({ cuentas: await listar(query) });
  if (!recurso && method === 'POST') return crear(transaccion, hashear, userId, body);
  if (recurso && accion === 'clave' && method === 'POST') return nuevaClave(query, hashear, userId, recurso);

  return falla(404, 'not_found');
}

module.exports = { rutearCuentas, validarAlta, generarClave, ALFABETO };
