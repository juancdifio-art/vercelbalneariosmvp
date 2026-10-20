// Contrato imprimible: el titulo, las condiciones generales y los datos del
// contrato (horarios, fechas, cantidades) del balneario, que salen impresos en
// el contrato de cada carpa o sombrilla. En el texto, un dato se nombra entre
// llaves ({Horario de la pileta}) y al imprimir sale su valor. El PDF y ese
// reemplazo los hace el navegador; aca solo se guarda. No importa pg: recibe
// `query`, asi lo comparten api/index.js y backend/src/index.js.

const MAX_TITULO = 120;
// Alcanza para un contrato largo (el de Zeus tiene unos 5.000 caracteres).
const MAX_CONDICIONES = 20000;
const MAX_DATOS = 50;
const MAX_NOMBRE_DATO = 60;
const MAX_VALOR_DATO = 200;

// Postgres rechaza el byte 0 en un texto.
const sinNulos = (v) => String(v ?? '').replace(/\u0000/g, '');

const ok = (body, status = 200) => ({ status, body });
const falla = (status, error) => ({ status, body: { error } });

const mapContrato = (r) => ({
  titulo: r.contrato_titulo || '',
  condiciones: r.contrato_condiciones || '',
  datos: Array.isArray(r.contrato_datos) ? r.contrato_datos : []
});

// Dos datos no pueden llamarse igual: se comparan sin mayusculas ni espacios de mas.
const claveDato = (nombre) => nombre.toLowerCase().replace(/\s+/g, ' ');

function validarDatos(lista) {
  if (lista == null) return { datos: [] };
  if (!Array.isArray(lista)) return { error: 'datos_invalidos' };
  // Las filas sin nombre ni valor son renglones que se dejaron vacios.
  const filas = lista
    .map((d) => ({ nombre: sinNulos(d?.nombre).trim().replace(/\s+/g, ' '), valor: sinNulos(d?.valor).trim() }))
    .filter((d) => d.nombre || d.valor);
  if (filas.length > MAX_DATOS) return { error: 'demasiados_datos' };
  const vistos = new Set();
  for (const d of filas) {
    if (!d.nombre) return { error: 'dato_sin_nombre' };
    if (d.nombre.length > MAX_NOMBRE_DATO || /[{}]/.test(d.nombre)) return { error: 'nombre_dato_invalido' };
    if (d.valor.length > MAX_VALOR_DATO) return { error: 'valor_dato_largo' };
    if (vistos.has(claveDato(d.nombre))) return { error: 'dato_repetido' };
    vistos.add(claveDato(d.nombre));
  }
  return { datos: filas };
}

// Las condiciones conservan sus saltos de linea: solo se recortan los bordes.
function validarContrato(body) {
  const titulo = sinNulos(body?.titulo).trim();
  if (titulo.length > MAX_TITULO) return { error: 'titulo_largo' };
  const condiciones = sinNulos(body?.condiciones).replace(/\r\n/g, '\n').replace(/^\s*\n|\s+$/g, '');
  if (condiciones.length > MAX_CONDICIONES) return { error: 'condiciones_largas' };
  const { datos, error } = validarDatos(body?.datos);
  if (error) return { error };
  return { titulo: titulo || null, condiciones: condiciones || null, datos };
}

/**
 * Rutas bajo /api/contrato, siempre del establecimiento de quien pide:
 *   GET   -> { contrato: { titulo, condiciones, datos } }
 *   PUT   { titulo, condiciones, datos } -> { contrato }
 * Devuelve { status, body }; cada API solo lo traduce.
 */
async function rutearContrato(query, estId, { method, partes, body }) {
  if (partes.length > 0) return falla(404, 'not_found');

  if (method === 'GET') {
    const r = await query('SELECT contrato_titulo, contrato_condiciones, contrato_datos FROM establishments WHERE id = $1', [estId]);
    return ok({ contrato: mapContrato(r.rows[0] || {}) });
  }

  if (method === 'PUT') {
    const datos = validarContrato(body);
    if (datos.error) return falla(400, datos.error);
    const r = await query(
      'UPDATE establishments SET contrato_titulo = $1, contrato_condiciones = $2, contrato_datos = $3::jsonb WHERE id = $4 RETURNING contrato_titulo, contrato_condiciones, contrato_datos',
      [datos.titulo, datos.condiciones, JSON.stringify(datos.datos), estId]
    );
    return ok({ contrato: mapContrato(r.rows[0] || {}) });
  }

  return falla(405, 'method_not_allowed');
}

module.exports = { rutearContrato, validarContrato, MAX_TITULO, MAX_CONDICIONES, MAX_DATOS };
