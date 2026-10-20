// Usuarios del balneario: el encargado (rol 'admin') suma a su personal, le
// cambia el rol, le genera una clave nueva o lo quita. El personal entra al
// mismo balneario con lo que su rol le permite (ver _permisos/permisos.js).
// No importa pg ni bcrypt: recibe `query`, `transaccion` y `hashear` de cada
// API, asi lo comparten api/index.js y backend/src/index.js.

const { generarClave } = require('../_cuentas/servicio');

const MAX_ID = 2147483647; // INTEGER de Postgres
const MAX_EMAIL = 255;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// El encargado suma empleados o personal de pileta; encargado hay uno solo.
const ROLES_PERSONAL = ['operador', 'pileta'];
// Tope por balneario: frena un alta en loop sin molestar a nadie real.
const MAX_USUARIOS = 30;

const ok = (body, status = 200) => ({ status, body });
const falla = (status, error) => ({ status, body: { error } });
const idValido = (n) => Number.isInteger(n) && n > 0 && n <= MAX_ID;
const limpio = (v) => String(v ?? '').replace(/\u0000/g, '').trim();

const mapUsuario = (r) => ({
  id: r.id,
  email: r.email,
  rol: r.role,
  encargado: r.encargado === true,
  creado: r.created_at
});

async function listar(query, estId) {
  const r = await query(
    `SELECT u.id, u.email, u.role, u.created_at, (e.user_id = u.id) AS encargado
       FROM users u JOIN establishments e ON e.id = u.establishment_id
      WHERE u.establishment_id = $1
      ORDER BY (e.user_id = u.id) DESC, u.created_at, u.id`,
    [estId]
  );
  return r.rows.map(mapUsuario);
}

async function crear(transaccion, hashear, estId, adminId, body) {
  const email = limpio(body?.email).toLowerCase();
  if (!email) return falla(400, 'email_requerido');
  if (email.length > MAX_EMAIL || !EMAIL.test(email)) return falla(400, 'email_invalido');
  const rol = limpio(body?.rol);
  if (!ROLES_PERSONAL.includes(rol)) return falla(400, 'rol_invalido');

  const clave = generarClave();
  // bcrypt tarda: se hashea antes de abrir la transaccion.
  const hash = await hashear(clave);
  let r;
  try {
    r = await transaccion(async (q) => {
      // El conteo y el alta van bajo el mismo bloqueo del balneario.
      await q('SELECT pg_advisory_xact_lock(hashtext($1))', [`usuarios:${estId}`]);
      const cuantos = (await q('SELECT COUNT(*)::int AS n FROM users WHERE establishment_id = $1', [estId])).rows[0].n;
      if (cuantos >= MAX_USUARIOS) return falla(400, 'demasiados_usuarios');
      const ya = await q('SELECT id FROM users WHERE lower(email) = $1', [email]);
      if (ya.rows.length) return falla(409, 'email_taken');
      const u = (await q(
        'INSERT INTO users (email, password_hash, role, establishment_id) VALUES ($1, $2, $3, $4) RETURNING id, email, role, created_at',
        [email, hash, rol, estId]
      )).rows[0];
      return ok({ usuario: mapUsuario(u), clave }, 201);
    });
  } catch (error) {
    // Dos altas con el mismo email a la vez: la segunda choca con el UNIQUE.
    if (error?.code === '23505') return falla(409, 'email_taken');
    throw error;
  }
  if (r.status === 201) {
    console.info(JSON.stringify({ evento: 'usuario_creado', por: adminId, establecimiento: estId, usuario: r.body.usuario.id, rol }));
  }
  return r;
}

/**
 * Rutas bajo /api/usuarios, siempre del balneario del encargado que pide:
 *   GET    (raiz)        el personal del balneario, el encargado primero
 *   POST   (raiz)        { email, rol: 'operador' | 'pileta' } -> { usuario, clave }
 *   PATCH  :id           { rol } -> { usuario }
 *   POST   :id/clave     clave nueva -> { usuario, clave }
 *   DELETE :id           quita al usuario
 * Al encargado no se lo toca desde aca: su clave se cambia en Panel de usuario.
 * Devuelve { status, body }; cada API solo lo traduce.
 */
async function rutearUsuarios(query, userId, { method, partes, body, transaccion, hashear }) {
  const yo = (await query('SELECT role, establishment_id FROM users WHERE id = $1', [userId])).rows[0];
  if (!yo) return falla(401, 'user_not_found');
  if (!yo.establishment_id) return falla(404, 'establishment_not_found');
  // El control de roles de la API ya lo frena; se repite porque aca se crean claves.
  if (yo.role !== 'admin') return falla(403, 'sin_permiso');
  const estId = yo.establishment_id;

  const [idTexto, accion, sobra] = partes;
  if (sobra !== undefined) return falla(404, 'not_found');

  if (!idTexto) {
    if (method === 'GET') return ok({ usuarios: await listar(query, estId) });
    if (method === 'POST') return crear(transaccion, hashear, estId, userId, body);
    return falla(405, 'method_not_allowed');
  }

  const id = Number(idTexto);
  if (!idValido(id)) return falla(400, 'id_invalido');
  const otro = (await query(
    `SELECT u.id, u.email, u.role, u.created_at, (e.user_id = u.id) AS encargado
       FROM users u JOIN establishments e ON e.id = u.establishment_id
      WHERE u.id = $1 AND u.establishment_id = $2`,
    [id, estId]
  )).rows[0];
  if (!otro) return falla(404, 'usuario_no_encontrado');
  if (otro.encargado || otro.role === 'admin') return falla(403, 'es_el_encargado');

  if (accion === 'clave' && method === 'POST') {
    const clave = generarClave();
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [await hashear(clave), id]);
    console.info(JSON.stringify({ evento: 'clave_regenerada', por: userId, usuario: id }));
    return ok({ usuario: mapUsuario(otro), clave });
  }

  if (accion) return falla(404, 'not_found');

  if (method === 'PATCH') {
    const rol = limpio(body?.rol);
    if (!ROLES_PERSONAL.includes(rol)) return falla(400, 'rol_invalido');
    const r = await query('UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, role, created_at', [rol, id]);
    return ok({ usuario: mapUsuario(r.rows[0]) });
  }

  if (method === 'DELETE') {
    await query('DELETE FROM users WHERE id = $1 AND establishment_id = $2', [id, estId]);
    console.info(JSON.stringify({ evento: 'usuario_quitado', por: userId, usuario: id }));
    return ok({ ok: true });
  }

  return falla(405, 'method_not_allowed');
}

module.exports = { rutearUsuarios, ROLES_PERSONAL, MAX_USUARIOS };
