// Validaciones de periodos, sectores y tarifas. Puras: devuelven un codigo de
// error (el mismo que responde la API) o null.

const { contiene } = require('./calculo');

const SERVICIOS_CON_TARIFA = ['carpa', 'sombrilla', 'parking'];
const DIAS_POR_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const esEntero = (n) => Number.isInteger(n);
const diaValido = (mes, dia) => esEntero(mes) && mes >= 1 && mes <= 12 && esEntero(dia) && dia >= 1 && dia <= DIAS_POR_MES[mes - 1];

function validarPeriodo(p) {
  if (!String(p.nombre ?? '').trim()) return 'nombre_requerido';
  if (!diaValido(p.mesInicio, p.diaInicio) || !diaValido(p.mesFin, p.diaFin)) return 'fecha_invalida';
  if (!esEntero(p.prioridad)) return 'prioridad_invalida';
  return null;
}

function periodosSeSuperponen(a, b) {
  for (let mes = 1; mes <= 12; mes += 1) {
    for (let dia = 1; dia <= DIAS_POR_MES[mes - 1]; dia += 1) {
      if (contiene(a, mes, dia) && contiene(b, mes, dia)) return true;
    }
  }
  return false;
}

function validarSector(s) {
  if (!SERVICIOS_CON_TARIFA.includes(s.serviceType)) return 'servicio_invalido';
  if (!String(s.nombre ?? '').trim()) return 'nombre_requerido';
  return null;
}

function validarTarifa(t) {
  if (!SERVICIOS_CON_TARIFA.includes(t.serviceType)) return 'servicio_invalido';

  const alcanceOk =
    (t.alcance === 'tipo' && t.sectorId == null && t.resourceNumber == null) ||
    (t.alcance === 'sector' && esEntero(t.sectorId) && t.resourceNumber == null) ||
    (t.alcance === 'unidad' && t.sectorId == null && esEntero(t.resourceNumber) && t.resourceNumber > 0);
  if (!alcanceOk) return 'alcance_invalido';

  if (t.clase === 'fecha') {
    if (!esEntero(t.periodoId) || t.diasMin != null || t.diasMax != null || t.modo != null) return 'tarifa_invalida';
  } else if (t.clase === 'estadia') {
    if (!esEntero(t.diasMin) || t.diasMin < 1) return 'tarifa_invalida';
    if (t.diasMax != null && (!esEntero(t.diasMax) || t.diasMax < t.diasMin)) return 'tarifa_invalida';
    if (!['cerrado', 'por_dia'].includes(t.modo)) return 'tarifa_invalida';
  } else {
    return 'tarifa_invalida';
  }

  if (typeof t.precio !== 'number' || !Number.isFinite(t.precio) || t.precio < 0) return 'precio_invalido';
  return null;
}

function mismoAlcance(a, b) {
  return a.serviceType === b.serviceType &&
    a.alcance === b.alcance &&
    (a.sectorId ?? null) === (b.sectorId ?? null) &&
    (a.resourceNumber ?? null) === (b.resourceNumber ?? null);
}

function conflictoTarifa(t, existentes) {
  for (const e of existentes) {
    if (t.id != null && e.id === t.id) continue;
    if (e.clase !== t.clase || !mismoAlcance(t, e)) continue;
    if ((e.periodoId ?? null) !== (t.periodoId ?? null)) continue;
    if (t.clase === 'fecha') return 'tarifa_duplicada';
    const maxT = t.diasMax ?? Infinity;
    const maxE = e.diasMax ?? Infinity;
    if (t.diasMin <= maxE && e.diasMin <= maxT) return 'rango_superpuesto';
  }
  return null;
}

module.exports = { SERVICIOS_CON_TARIFA, validarPeriodo, periodosSeSuperponen, validarSector, validarTarifa, conflictoTarifa };
