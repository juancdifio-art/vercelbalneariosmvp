// Calculo de precios por tarifa. Puro: no consulta la base.
// Lo usan api/index.js (Vercel) y backend/src/index.js (local), via servicio.js.

const MAX_DIAS = 400;
const DIA_MS = 86400000;
const ORDEN_ALCANCE = { unidad: 0, sector: 1, tipo: 2 };

function errorCon(codigo) {
  const e = new Error(codigo);
  e.codigo = codigo;
  return e;
}

// Las fechas llegan como texto YYYY-MM-DD y se parten a mano: new Date('YYYY-MM-DD')
// las interpreta en UTC y en Argentina corre la estadia un dia.
function aNumeroDia(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  if (!m) throw errorCon('fecha_invalida');
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const n = Date.UTC(anio, mes - 1, dia) / DIA_MS;
  if (desdeNumeroDia(n) !== iso) throw errorCon('fecha_invalida'); // 31/04, 30/02
  return n;
}

function desdeNumeroDia(n) {
  const d = new Date(n * DIA_MS);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

function diasEntre(desde, hasta) {
  const a = aNumeroDia(desde);
  const b = aNumeroDia(hasta);
  if (b < a) throw errorCon('rango_invalido');
  if (b - a + 1 > MAX_DIAS) throw errorCon('rango_demasiado_largo');
  const fechas = [];
  for (let n = a; n <= b; n += 1) fechas.push(desdeNumeroDia(n));
  return fechas;
}

function diasInclusivos(desde, hasta) {
  return aNumeroDia(hasta) - aNumeroDia(desde) + 1;
}

function anterior(iso) {
  return desdeNumeroDia(aNumeroDia(iso) - 1);
}

function contiene(periodo, mes, dia) {
  const x = mes * 100 + dia;
  const i = periodo.mesInicio * 100 + periodo.diaInicio;
  const f = periodo.mesFin * 100 + periodo.diaFin;
  return i <= f ? x >= i && x <= f : x >= i || x <= f;
}

function periodoVigente(periodos, iso) {
  const mes = Number(String(iso).slice(5, 7));
  const dia = Number(String(iso).slice(8, 10));
  let mejor = null;
  for (const p of periodos) {
    if (!contiene(p, mes, dia)) continue;
    // A igual prioridad (la API no lo deja cargar) desempata el id, para que sea estable.
    if (!mejor || p.prioridad > mejor.prioridad || (p.prioridad === mejor.prioridad && p.id < mejor.id)) mejor = p;
  }
  return mejor;
}

function redondear(n) {
  return Math.round(n * 100) / 100;
}

function aplicaA(t, serviceType, resourceNumber, sectorId) {
  if (t.serviceType !== serviceType) return false;
  if (t.alcance === 'tipo') return true;
  if (t.alcance === 'sector') return sectorId != null && t.sectorId === sectorId;
  if (t.alcance === 'unidad') return t.resourceNumber === resourceNumber;
  return false;
}

function masEspecifica(lista) {
  let mejor = null;
  for (const t of lista) {
    if (!mejor || ORDEN_ALCANCE[t.alcance] < ORDEN_ALCANCE[mejor.alcance]) mejor = t;
  }
  return mejor;
}

function cotizar({ tarifas, periodos, sectorId = null, serviceType, resourceNumber, desde, hasta }) {
  const fechas = diasEntre(desde, hasta);
  const dias = fechas.length;
  const propias = tarifas.filter((t) => aplicaA(t, serviceType, Number(resourceNumber), sectorId));

  // Paso 1: tarifa por estadia. Si hay, reemplaza a las de fecha para toda la reserva.
  const periodoEntrada = periodoVigente(periodos, desde);
  const estadia = masEspecifica(propias.filter((t) =>
    t.clase === 'estadia' &&
    dias >= t.diasMin &&
    (t.diasMax == null || dias <= t.diasMax) &&
    (t.periodoId == null || (periodoEntrada && periodoEntrada.id === t.periodoId))
  ));
  if (estadia) {
    const total = estadia.modo === 'cerrado' ? estadia.precio : redondear(estadia.precio * dias);
    return {
      dias,
      total,
      completo: true,
      diasSinTarifa: [],
      desglose: { clase: 'estadia', tarifaId: estadia.id, nombre: estadia.nombre, modo: estadia.modo, dias, precio: estadia.precio, total }
    };
  }

  // Paso 2: dia por dia, con el periodo vigente de cada dia.
  const porFecha = propias.filter((t) => t.clase === 'fecha');
  const tramos = [];
  const diasSinTarifa = [];
  for (const f of fechas) {
    const p = periodoVigente(periodos, f);
    const t = p ? masEspecifica(porFecha.filter((x) => x.periodoId === p.id)) : null;
    if (!t) {
      diasSinTarifa.push(f);
      continue;
    }
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && ultimo.periodoId === p.id && ultimo.precioDia === t.precio && ultimo.hasta === anterior(f)) {
      ultimo.hasta = f;
      ultimo.dias += 1;
      ultimo.subtotal = redondear(ultimo.subtotal + t.precio);
    } else {
      tramos.push({ desde: f, hasta: f, periodoId: p.id, periodo: p.nombre, dias: 1, precioDia: t.precio, subtotal: t.precio });
    }
  }
  const total = redondear(tramos.reduce((s, t) => s + t.subtotal, 0));
  return {
    dias,
    total,
    completo: diasSinTarifa.length === 0,
    diasSinTarifa,
    desglose: { clase: 'fecha', tramos, diasSinTarifa }
  };
}

// Los 366 dias de un anio bisiesto con el periodo que rige cada uno. La pantalla
// de periodos lo pinta para mostrar huecos y superposiciones.
function calendarioAnual(periodos) {
  return diasEntre('2024-01-01', '2024-12-31').map((f) => {
    const p = periodoVigente(periodos, f);
    return { mes: Number(f.slice(5, 7)), dia: Number(f.slice(8, 10)), periodoId: p ? p.id : null };
  });
}

module.exports = { diasEntre, diasInclusivos, periodoVigente, contiene, cotizar, calendarioAnual };
