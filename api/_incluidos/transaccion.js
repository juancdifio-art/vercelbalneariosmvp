// Transaccion sobre un cliente de pg ya conectado. Cada API consigue el
// cliente a su manera (api/index.js con un pool efimero, el backend local con
// su pool fijo) y lo libera ella.
//
// fn recibe una `query(sql, params)` atada al cliente. Si devuelve un error
// ({ error } o una respuesta { status >= 400 }) se vuelve atras y se devuelve
// tal cual; si lanza, se vuelve atras y se relanza.

const esFalla = (r) => Boolean(r && (r.error || (Number.isInteger(r.status) && r.status >= 400)));

async function enTransaccion(client, fn) {
  await client.query('BEGIN');
  const query = (sql, params) => client.query(sql, params);
  try {
    const resultado = await fn(query);
    await client.query(esFalla(resultado) ? 'ROLLBACK' : 'COMMIT');
    return resultado;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // la conexion puede haberse caido: el error que importa es el original
    }
    throw error;
  }
}

module.exports = { enTransaccion, esFalla };
