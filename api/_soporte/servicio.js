// Chat de soporte: el establecimiento nos escribe desde la app (error,
// sugerencia o consulta) y respondemos desde la bandeja de soporte. Un hilo por
// establecimiento, en la misma base. No importa pg: recibe la funcion query,
// asi lo comparten api/index.js y backend/src/index.js.
// El rol se lee de la base en cada pedido: el token no lo trae, y asi quitarle
// el rol a alguien corta su acceso en el acto.

const TIPOS = ['error', 'sugerencia', 'consulta'];
const MAX_TEXTO = 2000;
const MAX_PANTALLA = 60;
// Freno contra el envio en loop: se cuenta y se inserta bajo un bloqueo por
// establecimiento, asi pedidos en paralelo no pasan todos el conteo.
const MAX_POR_MINUTO = 10;
// El hilo devuelve los ultimos mensajes, no todos: se pide cada 15 segundos.
const MAX_HILO = 200;
const MAX_ID = 2147483647; // INTEGER de Postgres

// Postgres rechaza el byte 0 en un TEXT: se quita antes de validar.
const limpio = (v) => String(v ?? '').replace(/\u0000/g, '').trim();

const ok = (body, status = 200) => ({ status, body });
const falla = (status, error) => ({ status, body: { error } });

const mapMensaje = (r) => ({
  id: r.id,
  deSoporte: r.de_soporte,
  tipo: r.tipo ?? null,
  texto: r.texto,
  pantalla: r.pantalla ?? null,
  leido: r.leido_at != null,
  creado: r.created_at
});

// tipo y pantalla solo los manda el establecimiento.
function validarMensaje(body, { delEstablecimiento }) {
  const texto = limpio(body?.texto);
  if (!texto) return { error: 'texto_requerido' };
  if (texto.length > MAX_TEXTO) return { error: 'texto_largo' };
  if (!delEstablecimiento) return { texto, tipo: null, pantalla: null };
  const tipo = body?.tipo == null || body.tipo === '' ? null : body.tipo;
  if (tipo !== null && !TIPOS.includes(tipo)) return { error: 'tipo_invalido' };
  const pantalla = limpio(body?.pantalla).slice(0, MAX_PANTALLA) || null;
  return { texto, tipo, pantalla };
}

async function quienEs(query, userId) {
  const r = await query(
    'SELECT u.role, e.id AS establishment_id FROM users u LEFT JOIN establishments e ON e.user_id = u.id WHERE u.id = $1',
    [userId]
  );
  return r.rows[0] || null;
}

async function hilo(query, estId) {
  const r = await query(
    `SELECT * FROM (
       SELECT * FROM soporte_mensajes WHERE establishment_id = $1 ORDER BY created_at DESC, id DESC LIMIT ${MAX_HILO}
     ) ultimos ORDER BY created_at, id`,
    [estId]
  );
  return r.rows.map(mapMensaje);
}

// Quien abre el hilo lee lo que escribio el otro lado.
async function marcarLeidos(query, estId, delOtroLadoEsSoporte) {
  await query(
    'UPDATE soporte_mensajes SET leido_at = NOW() WHERE establishment_id = $1 AND de_soporte = $2 AND leido_at IS NULL',
    [estId, delOtroLadoEsSoporte]
  );
}

// `transaccion` es el conTransaccion de cada API: el conteo y el INSERT van
// juntos bajo el bloqueo (la clave no choca con la de bloquearUnidad).
async function escribir(transaccion, estId, userId, deSoporte, m) {
  return transaccion(async (q) => {
    await q('SELECT pg_advisory_xact_lock(hashtext($1))', [`soporte:${estId}:${deSoporte}`]);
    const recientes = await q(
      "SELECT COUNT(*)::int AS n FROM soporte_mensajes WHERE establishment_id = $1 AND de_soporte = $2 AND created_at > NOW() - INTERVAL '1 minute'",
      [estId, deSoporte]
    );
    if (recientes.rows[0].n >= MAX_POR_MINUTO) return falla(429, 'demasiados_mensajes');
    const r = await q(
      'INSERT INTO soporte_mensajes (establishment_id, user_id, de_soporte, tipo, texto, pantalla) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [estId, userId, deSoporte, m.tipo, m.texto, m.pantalla]
    );
    return ok({ mensaje: mapMensaje(r.rows[0]) }, 201);
  });
}

// Todos los establecimientos, con su ultimo mensaje y los no leidos: primero
// los que esperan respuesta, despues el ultimo movimiento, despues el nombre.
async function bandeja(query) {
  const r = await query(
    `SELECT e.id, e.name,
            ult.texto AS ultimo_texto, ult.de_soporte AS ultimo_de_soporte, ult.created_at AS ultimo,
            (SELECT COUNT(*)::int FROM soporte_mensajes x
              WHERE x.establishment_id = e.id AND NOT x.de_soporte AND x.leido_at IS NULL) AS no_leidos
       FROM establishments e
       LEFT JOIN LATERAL (
         SELECT texto, de_soporte, created_at FROM soporte_mensajes m
          WHERE m.establishment_id = e.id ORDER BY created_at DESC, id DESC LIMIT 1
       ) ult ON TRUE`
  );
  const fecha = (v) => (v ? new Date(v).getTime() : 0);
  return r.rows
    .map((row) => ({
      id: row.id,
      nombre: row.name,
      noLeidos: row.no_leidos,
      ultimo: row.ultimo ? { texto: row.ultimo_texto, deSoporte: row.ultimo_de_soporte, creado: row.ultimo } : null
    }))
    .sort((a, b) =>
      (b.noLeidos > 0) - (a.noLeidos > 0) ||
      fecha(b.ultimo?.creado) - fecha(a.ultimo?.creado) ||
      String(a.nombre).localeCompare(String(b.nombre))
    );
}

async function noLeidos(query, yo) {
  if (yo.role === 'soporte') {
    const r = await query('SELECT COUNT(*)::int AS n FROM soporte_mensajes WHERE NOT de_soporte AND leido_at IS NULL');
    return ok({ noLeidos: r.rows[0].n });
  }
  if (!yo.establishment_id) return falla(404, 'establishment_not_found');
  const r = await query(
    'SELECT COUNT(*)::int AS n FROM soporte_mensajes WHERE establishment_id = $1 AND de_soporte AND leido_at IS NULL',
    [yo.establishment_id]
  );
  return ok({ noLeidos: r.rows[0].n });
}

/**
 * Rutas bajo /api/soporte:
 *   GET  no-leidos           los dos roles: cuantos mensajes del otro lado esperan
 *   GET  mensajes            el establecimiento: su hilo (marca leidas las respuestas)
 *   POST mensajes            el establecimiento: { texto, tipo?, pantalla? }
 *   GET  bandeja             soporte: todos los establecimientos
 *   GET  bandeja/:estId      soporte: el hilo de uno (marca leidos sus mensajes)
 *   POST bandeja/:estId      soporte: { texto }
 * Devuelve { status, body }; cada API solo lo traduce. `transaccion` es el
 * conTransaccion de la API (los envios cuentan y escriben bajo bloqueo).
 */
async function rutearSoporte(query, userId, { method, partes, body, transaccion }) {
  const yo = await quienEs(query, userId);
  if (!yo) return falla(401, 'user_not_found');
  const [recurso = '', idTexto, sobra] = partes;
  if (sobra !== undefined) return falla(404, 'not_found');

  if (recurso === 'no-leidos' && !idTexto && method === 'GET') return noLeidos(query, yo);

  if (recurso === 'mensajes' && !idTexto) {
    const estId = yo.establishment_id;
    if (!estId) return falla(404, 'establishment_not_found');
    if (method === 'GET') {
      await marcarLeidos(query, estId, true);
      return ok({ mensajes: await hilo(query, estId) });
    }
    if (method === 'POST') {
      const m = validarMensaje(body, { delEstablecimiento: true });
      if (m.error) return falla(400, m.error);
      return escribir(transaccion, estId, userId, false, m);
    }
  }

  if (recurso === 'bandeja') {
    if (yo.role !== 'soporte') return falla(403, 'solo_soporte');
    if (!idTexto) {
      if (method === 'GET') return ok({ establecimientos: await bandeja(query) });
      return falla(404, 'not_found');
    }
    const estId = Number(idTexto);
    if (!Number.isInteger(estId) || estId <= 0 || estId > MAX_ID) return falla(400, 'id_invalido');
    const existe = await query('SELECT id FROM establishments WHERE id = $1', [estId]);
    if (!existe.rows.length) return falla(404, 'establishment_not_found');
    if (method === 'GET') {
      // Rastro de que cuenta de soporte leyo que hilo (leido_at no dice quien).
      console.info(JSON.stringify({ evento: 'soporte_lee_hilo', userId, establecimiento: estId }));
      await marcarLeidos(query, estId, false);
      return ok({ mensajes: await hilo(query, estId) });
    }
    if (method === 'POST') {
      const m = validarMensaje(body, { delEstablecimiento: false });
      if (m.error) return falla(400, m.error);
      return escribir(transaccion, estId, userId, true, m);
    }
  }

  return falla(404, 'not_found');
}

module.exports = { rutearSoporte, validarMensaje, TIPOS, MAX_TEXTO };
