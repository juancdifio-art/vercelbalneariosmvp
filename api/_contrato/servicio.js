// Contrato imprimible: el titulo y las condiciones generales del balneario, que
// salen impresos en el contrato de cada carpa o sombrilla. El PDF lo arma el
// navegador; aca solo se guarda el texto. No importa pg: recibe `query`, asi lo
// comparten api/index.js y backend/src/index.js.

const MAX_TITULO = 120;
// Alcanza para un contrato largo (el de Zeus tiene unos 5.000 caracteres).
const MAX_CONDICIONES = 20000;

// Postgres rechaza el byte 0 en un texto.
const sinNulos = (v) => String(v ?? '').replace(/\u0000/g, '');

const ok = (body, status = 200) => ({ status, body });
const falla = (status, error) => ({ status, body: { error } });

const mapContrato = (r) => ({ titulo: r.contrato_titulo || '', condiciones: r.contrato_condiciones || '' });

// Las condiciones conservan sus saltos de linea: solo se recortan los bordes.
function validarContrato(body) {
  const titulo = sinNulos(body?.titulo).trim();
  if (titulo.length > MAX_TITULO) return { error: 'titulo_largo' };
  const condiciones = sinNulos(body?.condiciones).replace(/\r\n/g, '\n').replace(/^\s*\n|\s+$/g, '');
  if (condiciones.length > MAX_CONDICIONES) return { error: 'condiciones_largas' };
  return { titulo: titulo || null, condiciones: condiciones || null };
}

/**
 * Rutas bajo /api/contrato, siempre del establecimiento de quien pide:
 *   GET   -> { contrato: { titulo, condiciones } }
 *   PUT   { titulo, condiciones } -> { contrato }
 * Devuelve { status, body }; cada API solo lo traduce.
 */
async function rutearContrato(query, estId, { method, partes, body }) {
  if (partes.length > 0) return falla(404, 'not_found');

  if (method === 'GET') {
    const r = await query('SELECT contrato_titulo, contrato_condiciones FROM establishments WHERE id = $1', [estId]);
    return ok({ contrato: mapContrato(r.rows[0] || {}) });
  }

  if (method === 'PUT') {
    const datos = validarContrato(body);
    if (datos.error) return falla(400, datos.error);
    const r = await query(
      'UPDATE establishments SET contrato_titulo = $1, contrato_condiciones = $2 WHERE id = $3 RETURNING contrato_titulo, contrato_condiciones',
      [datos.titulo, datos.condiciones, estId]
    );
    return ok({ contrato: mapContrato(r.rows[0] || {}) });
  }

  return falla(405, 'method_not_allowed');
}

module.exports = { rutearContrato, validarContrato, MAX_TITULO, MAX_CONDICIONES };
