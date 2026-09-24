// Tarifas contra la base. No importa pg: recibe la funcion query, asi lo
// comparten api/index.js (un pool por consulta) y backend/src/index.js (pool fijo).
// Cada funcion de ABM devuelve { status, body }; cada API solo la traduce.
// Los errores de base se propagan: el llamador los loguea y responde 500.

const { cotizar, diasInclusivos, calendarioAnual } = require('./calculo');
const {
  SERVICIOS_CON_TARIFA, validarPeriodo, periodosSeSuperponen, validarSector, validarTarifa, conflictoTarifa
} = require('./validaciones');

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const ok = (body, status = 200) => ({ status, body });
const falla = (status, error) => ({ status, body: { error } });
const redondear = (n) => Math.round(n * 100) / 100;

// pg devuelve DATE como Date a medianoche local.
function fechaISO(valor) {
  if (valor instanceof Date) {
    const mm = String(valor.getMonth() + 1).padStart(2, '0');
    const dd = String(valor.getDate()).padStart(2, '0');
    return `${valor.getFullYear()}-${mm}-${dd}`;
  }
  return String(valor).slice(0, 10);
}

// Solo los campos que vinieron en el body: para mezclar en un PATCH.
function definidos(obj, body) {
  const out = {};
  for (const k of Object.keys(obj)) if (body[k] !== undefined) out[k] = obj[k];
  return out;
}

const mapPeriodo = (r) => ({
  id: r.id, nombre: r.nombre, mesInicio: r.mes_inicio, diaInicio: r.dia_inicio,
  mesFin: r.mes_fin, diaFin: r.dia_fin, prioridad: r.prioridad
});

const mapTarifa = (r) => ({
  id: r.id, serviceType: r.service_type, alcance: r.alcance, sectorId: r.sector_id ?? null,
  resourceNumber: r.resource_number ?? null, clase: r.clase, periodoId: r.periodo_id ?? null,
  nombre: r.nombre ?? null, diasMin: r.dias_min ?? null, diasMax: r.dias_max ?? null,
  modo: r.modo ?? null, precio: Number(r.precio)
});

const mapSector = (r) => ({
  id: r.id, serviceType: r.service_type, nombre: r.nombre, color: r.color,
  unidades: (r.unidades || []).map(Number)
});

const periodoDesdeBody = (b) => ({
  nombre: String(b.nombre ?? '').trim(), mesInicio: num(b.mesInicio), diaInicio: num(b.diaInicio),
  mesFin: num(b.mesFin), diaFin: num(b.diaFin), prioridad: num(b.prioridad) ?? 1
});

const tarifaDesdeBody = (b) => ({
  serviceType: b.serviceType, alcance: b.alcance, sectorId: num(b.sectorId), resourceNumber: num(b.resourceNumber),
  clase: b.clase, periodoId: num(b.periodoId), nombre: b.nombre ? String(b.nombre).trim() : null,
  diasMin: num(b.diasMin), diasMax: num(b.diasMax), modo: b.modo || null, precio: num(b.precio)
});

const unidadesDesdeBody = (lista) =>
  [...new Set((lista || []).map(Number))].filter((n) => Number.isInteger(n) && n > 0).sort((a, b) => a - b);

// ---------- Cotizacion y precio de una reserva ----------

async function cotizarUnidad(query, estId, { serviceType, resourceNumber, desde, hasta }) {
  const tarifas = (await query('SELECT * FROM tarifas WHERE establishment_id = $1 AND service_type = $2 ORDER BY id', [estId, serviceType])).rows.map(mapTarifa);
  const periodos = (await query('SELECT * FROM periodos_tarifarios WHERE establishment_id = $1', [estId])).rows.map(mapPeriodo);
  const sector = await query(
    'SELECT sector_id FROM sector_unidades WHERE establishment_id = $1 AND service_type = $2 AND resource_number = $3',
    [estId, serviceType, Number(resourceNumber)]
  );
  const sectorId = sector.rows.length ? sector.rows[0].sector_id : null;
  return cotizar({ tarifas, periodos, sectorId, serviceType, resourceNumber: Number(resourceNumber), desde, hasta });
}

// Sin ninguna tarifa aplicable no vale la pena guardar la lista de dias faltantes.
function desgloseParaGuardar(c) {
  if (c.completo) return c.desglose;
  return c.desglose.clase === 'fecha' && c.desglose.tramos.length ? c.desglose : null;
}

// Cotiza y traduce los errores de fecha/rango del calculo a { error }: la API
// responde 400. Los errores de base (sin .codigo) siguen su camino hacia el 500.
async function cotizarOError(query, estId, params) {
  try {
    return { c: await cotizarUnidad(query, estId, params) };
  } catch (e) {
    if (e.codigo) return { error: e.codigo };
    throw e;
  }
}

function resolverCobro({ precioTarifa, cobrado, motivo }) {
  if (cobrado != null && (!Number.isFinite(cobrado) || cobrado < 0)) return { error: 'precio_invalido' };
  const total = cobrado ?? precioTarifa;
  const motivoLimpio = String(motivo ?? '').trim() || null;
  const difiere = precioTarifa != null && total != null && redondear(total) !== redondear(precioTarifa);
  if (difiere && !motivoLimpio) return { error: 'motivo_ajuste_required' };
  return { totalPrice: total, motivoAjuste: difiere ? motivoLimpio : null };
}

const diario = (total, dias) => (total != null && dias > 0 ? Math.round(total / dias) : null);

async function precioAlCrear(query, estId, body) {
  if (body.serviceType === 'pileta') {
    return { precioTarifa: null, desglose: null, totalPrice: body.totalPrice || null, dailyPrice: body.dailyPrice || null, motivoAjuste: null };
  }
  const cot = await cotizarOError(query, estId, {
    serviceType: body.serviceType, resourceNumber: body.resourceNumber, desde: body.startDate, hasta: body.endDate
  });
  if (cot.error) return { error: cot.error };
  const { c } = cot;
  const precioTarifa = c.completo ? c.total : null;
  const r = resolverCobro({ precioTarifa, cobrado: num(body.totalPrice), motivo: body.motivoAjuste });
  if (r.error) return r;
  return { precioTarifa, desglose: desgloseParaGuardar(c), totalPrice: r.totalPrice, dailyPrice: diario(r.totalPrice, c.dias), motivoAjuste: r.motivoAjuste };
}

async function precioAlEditar(query, estId, current, body, { recalcular, desde, hasta, resourceNumber }) {
  let precioTarifa = num(current.precio_tarifa);
  let desglose = current.desglose ?? null;
  if (recalcular) {
    const cot = await cotizarOError(query, estId, { serviceType: current.service_type, resourceNumber, desde, hasta });
    if (cot.error) return { error: cot.error };
    const { c } = cot;
    precioTarifa = c.completo ? c.total : null;
    desglose = desgloseParaGuardar(c);
  }
  const enviado = num(body.totalPrice);
  // Si cambiaron las fechas y hay tarifa, el precio nuevo es el de la tarifa;
  // si no, se conserva lo que ya estaba cobrado.
  const cobrado = enviado ?? (recalcular && precioTarifa != null ? null : num(current.total_price));
  const motivo = body.motivoAjuste !== undefined ? body.motivoAjuste : current.motivo_ajuste;
  const r = resolverCobro({ precioTarifa, cobrado, motivo });
  if (r.error) return r;
  // Sin total no hay promedio que calcular (y una fila vieja puede no traer fechas).
  const dias = r.totalPrice == null ? 0 : diasInclusivos(desde, hasta);
  return { precioTarifa, desglose, totalPrice: r.totalPrice, dailyPrice: diario(r.totalPrice, dias), motivoAjuste: r.motivoAjuste };
}

async function cotizarRuta(query, estId, params) {
  const serviceType = params.serviceType;
  const resourceNumber = num(params.resourceNumber);
  let desde = params.startDate;
  let hasta = params.endDate;
  if (!SERVICIOS_CON_TARIFA.includes(serviceType) || !resourceNumber || !desde || !hasta) return falla(400, 'parametros_invalidos');
  if (desde > hasta) [desde, hasta] = [hasta, desde];
  try {
    return ok({ cotizacion: await cotizarUnidad(query, estId, { serviceType, resourceNumber, desde, hasta }) });
  } catch (e) {
    if (e.codigo) return falla(400, e.codigo);
    throw e;
  }
}

// ---------- Periodos ----------

async function periodosDe(query, estId) {
  return (await query('SELECT * FROM periodos_tarifarios WHERE establishment_id = $1 ORDER BY prioridad, mes_inicio, dia_inicio', [estId])).rows.map(mapPeriodo);
}

async function listarPeriodos(query, estId) {
  const periodos = await periodosDe(query, estId);
  return ok({ periodos, calendario: calendarioAnual(periodos) });
}

async function guardarPeriodo(query, estId, p, id = null) {
  const error = validarPeriodo(p);
  if (error) return falla(400, error);
  const otros = (await periodosDe(query, estId)).filter((e) => e.id !== id);
  if (otros.some((e) => e.prioridad === p.prioridad && periodosSeSuperponen(e, p))) return falla(409, 'periodo_superpuesto');
  const valores = [p.nombre, p.mesInicio, p.diaInicio, p.mesFin, p.diaFin, p.prioridad];
  if (id == null) {
    const r = await query(
      'INSERT INTO periodos_tarifarios (establishment_id, nombre, mes_inicio, dia_inicio, mes_fin, dia_fin, prioridad) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [estId, ...valores]
    );
    return ok({ periodo: mapPeriodo(r.rows[0]) }, 201);
  }
  const r = await query(
    'UPDATE periodos_tarifarios SET nombre = $1, mes_inicio = $2, dia_inicio = $3, mes_fin = $4, dia_fin = $5, prioridad = $6 WHERE id = $7 AND establishment_id = $8 RETURNING *',
    [...valores, id, estId]
  );
  return ok({ periodo: mapPeriodo(r.rows[0]) });
}

async function editarPeriodo(query, estId, id, body) {
  const r = await query('SELECT * FROM periodos_tarifarios WHERE id = $1 AND establishment_id = $2', [id, estId]);
  if (!r.rows.length) return falla(404, 'periodo_not_found');
  const { id: _id, ...actual } = mapPeriodo(r.rows[0]);
  return guardarPeriodo(query, estId, { ...actual, ...definidos(periodoDesdeBody(body), body) }, id);
}

async function borrar(query, sql, params, noEncontrado) {
  const r = await query(sql, params);
  return r.rows.length ? ok({ ok: true }) : falla(404, noEncontrado);
}

// ---------- Sectores ----------

async function listarSectores(query, estId) {
  const r = await query(
    `SELECT s.*, COALESCE(array_agg(su.resource_number ORDER BY su.resource_number) FILTER (WHERE su.resource_number IS NOT NULL), '{}') AS unidades
     FROM sectores s LEFT JOIN sector_unidades su ON su.sector_id = s.id
     WHERE s.establishment_id = $1
     GROUP BY s.id
     ORDER BY s.service_type, s.nombre`,
    [estId]
  );
  return ok({ sectores: r.rows.map(mapSector) });
}

// El UNIQUE de la base es el que garantiza "una unidad, un sector".
function traducirUnicidad(err) {
  if (err && err.code === '23505') {
    if (err.constraint === 'sector_unidades_unica') return falla(409, 'unidad_en_otro_sector');
    if (err.constraint === 'sectores_nombre_unico') return falla(409, 'sector_duplicado');
  }
  throw err;
}

async function crearSector(query, estId, body) {
  const s = { serviceType: body.serviceType, nombre: String(body.nombre ?? '').trim(), color: body.color || '#0EA5E9', unidades: unidadesDesdeBody(body.unidades) };
  const error = validarSector(s);
  if (error) return falla(400, error);
  try {
    // Una sola sentencia: el sector y sus unidades se crean juntos o no se crea nada.
    const r = await query(
      `WITH s AS (
         INSERT INTO sectores (establishment_id, service_type, nombre, color) VALUES ($1, $2, $3, $4) RETURNING *
       ), u AS (
         INSERT INTO sector_unidades (sector_id, establishment_id, service_type, resource_number)
         SELECT s.id, s.establishment_id, s.service_type, x FROM s, unnest($5::int[]) AS x
       )
       SELECT * FROM s`,
      [estId, s.serviceType, s.nombre, s.color, s.unidades]
    );
    return ok({ sector: mapSector({ ...r.rows[0], unidades: s.unidades }) }, 201);
  } catch (err) {
    return traducirUnicidad(err);
  }
}

async function editarSector(query, estId, id, body) {
  const r = await query('SELECT * FROM sectores WHERE id = $1 AND establishment_id = $2', [id, estId]);
  if (!r.rows.length) return falla(404, 'sector_not_found');
  const actual = r.rows[0];
  const nombre = body.nombre !== undefined ? String(body.nombre).trim() : actual.nombre;
  const color = body.color || actual.color;
  if (!nombre) return falla(400, 'nombre_requerido');
  const unidades = body.unidades !== undefined
    ? unidadesDesdeBody(body.unidades)
    : (await query('SELECT resource_number FROM sector_unidades WHERE sector_id = $1', [id])).rows.map((x) => Number(x.resource_number));
  try {
    // Borra las que salieron e inserta las que entraron: conjuntos disjuntos,
    // asi el orden de los CTE no importa. Una unidad de otro sector hace
    // fallar toda la sentencia por el UNIQUE.
    await query(
      `WITH s AS (
         UPDATE sectores SET nombre = $3, color = $4 WHERE id = $2 AND establishment_id = $1 RETURNING *
       ), borradas AS (
         DELETE FROM sector_unidades su USING s WHERE su.sector_id = s.id AND NOT (su.resource_number = ANY($5::int[]))
       ), nuevas AS (
         INSERT INTO sector_unidades (sector_id, establishment_id, service_type, resource_number)
         SELECT s.id, s.establishment_id, s.service_type, x FROM s, unnest($5::int[]) AS x
         WHERE NOT EXISTS (SELECT 1 FROM sector_unidades e WHERE e.sector_id = s.id AND e.resource_number = x)
       )
       SELECT * FROM s`,
      [estId, id, nombre, color, unidades]
    );
    return ok({ sector: mapSector({ ...actual, nombre, color, unidades }) });
  } catch (err) {
    return traducirUnicidad(err);
  }
}

// ---------- Tarifas ----------

async function listarTarifas(query, estId) {
  const r = await query('SELECT * FROM tarifas WHERE establishment_id = $1 ORDER BY service_type, clase, id', [estId]);
  return ok({ tarifas: r.rows.map(mapTarifa) });
}

async function guardarTarifa(query, estId, t, id = null) {
  const error = validarTarifa(t);
  if (error) return falla(400, error);
  if (t.alcance === 'sector') {
    const s = await query('SELECT id FROM sectores WHERE id = $1 AND establishment_id = $2 AND service_type = $3', [t.sectorId, estId, t.serviceType]);
    if (!s.rows.length) return falla(400, 'sector_invalido');
  }
  if (t.periodoId != null) {
    const p = await query('SELECT id FROM periodos_tarifarios WHERE id = $1 AND establishment_id = $2', [t.periodoId, estId]);
    if (!p.rows.length) return falla(400, 'periodo_invalido');
  }
  const existentes = (await query('SELECT * FROM tarifas WHERE establishment_id = $1 AND service_type = $2', [estId, t.serviceType])).rows.map(mapTarifa);
  const conflicto = conflictoTarifa({ ...t, id }, existentes);
  if (conflicto) return falla(409, conflicto);

  const valores = [t.serviceType, t.alcance, t.sectorId, t.resourceNumber, t.clase, t.periodoId, t.nombre, t.diasMin, t.diasMax, t.modo, t.precio];
  if (id == null) {
    const r = await query(
      `INSERT INTO tarifas (establishment_id, service_type, alcance, sector_id, resource_number, clase, periodo_id, nombre, dias_min, dias_max, modo, precio)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [estId, ...valores]
    );
    return ok({ tarifa: mapTarifa(r.rows[0]) }, 201);
  }
  const r = await query(
    `UPDATE tarifas SET service_type = $1, alcance = $2, sector_id = $3, resource_number = $4, clase = $5, periodo_id = $6,
       nombre = $7, dias_min = $8, dias_max = $9, modo = $10, precio = $11
     WHERE id = $12 AND establishment_id = $13 RETURNING *`,
    [...valores, id, estId]
  );
  return ok({ tarifa: mapTarifa(r.rows[0]) });
}

async function editarTarifa(query, estId, id, body) {
  const r = await query('SELECT * FROM tarifas WHERE id = $1 AND establishment_id = $2', [id, estId]);
  if (!r.rows.length) return falla(404, 'tarifa_not_found');
  const { id: _id, ...actual } = mapTarifa(r.rows[0]);
  return guardarTarifa(query, estId, { ...actual, ...definidos(tarifaDesdeBody(body), body) }, id);
}

// ---------- Ruteo ----------

async function rutearTarifas(query, estId, { method, partes, params, body }) {
  const [recurso = '', idTexto] = partes;
  const id = num(idTexto);

  if (recurso === 'cotizar' && method === 'GET') return cotizarRuta(query, estId, params);

  if (recurso === 'periodos') {
    if (!idTexto && method === 'GET') return listarPeriodos(query, estId);
    if (!idTexto && method === 'POST') return guardarPeriodo(query, estId, periodoDesdeBody(body));
    if (id && method === 'PATCH') return editarPeriodo(query, estId, id, body);
    if (id && method === 'DELETE') return borrar(query, 'DELETE FROM periodos_tarifarios WHERE id = $1 AND establishment_id = $2 RETURNING id', [id, estId], 'periodo_not_found');
  }

  if (recurso === 'sectores') {
    if (!idTexto && method === 'GET') return listarSectores(query, estId);
    if (!idTexto && method === 'POST') return crearSector(query, estId, body);
    if (id && method === 'PATCH') return editarSector(query, estId, id, body);
    if (id && method === 'DELETE') return borrar(query, 'DELETE FROM sectores WHERE id = $1 AND establishment_id = $2 RETURNING id', [id, estId], 'sector_not_found');
  }

  if (!recurso) {
    if (method === 'GET') return listarTarifas(query, estId);
    if (method === 'POST') return guardarTarifa(query, estId, tarifaDesdeBody(body));
  }

  const tarifaId = num(recurso);
  if (tarifaId && !idTexto) {
    if (method === 'PATCH') return editarTarifa(query, estId, tarifaId, body);
    if (method === 'DELETE') return borrar(query, 'DELETE FROM tarifas WHERE id = $1 AND establishment_id = $2 RETURNING id', [tarifaId, estId], 'tarifa_not_found');
  }

  return falla(404, 'not_found');
}

module.exports = { fechaISO, resolverCobro, cotizarUnidad, precioAlCrear, precioAlEditar, rutearTarifas };
