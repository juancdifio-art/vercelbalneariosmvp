/**
 * Consultas sobre la lista de reservas que la app ya tiene cargada.
 *
 * Las fechas son strings yyyy-mm-dd, tal como llegan de la API. Se comparan
 * como strings (el formato ordena bien) y las cuentas de dias se hacen en UTC
 * para que un cambio de horario no corra el resultado un dia.
 */

function aUTC(iso) {
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return Date.UTC(a, m - 1, d);
}

function sumarUnDia(iso) {
  return new Date(aUTC(iso) + 86400000).toISOString().slice(0, 10);
}

function numero(valor) {
  const n = Number.parseFloat(valor);
  return Number.isFinite(n) ? n : 0;
}

/** Dias entre dos fechas contando los dos extremos: del 23 al 29 son 7. */
export function diasInclusivos(desde, hasta) {
  return Math.round((aUTC(hasta) - aUTC(desde)) / 86400000) + 1;
}

/**
 * Reservas de un cliente, por clientId y nada mas.
 *
 * Antes se sumaban tambien las que coincidian por nombre, aun parcialmente, y
 * eso mezclaba clientes: dos "Alejandro Morales" distintos veian cada uno las
 * reservas del otro, y una reserva sin nombre aparecia en todas las fichas
 * porque cualquier texto incluye al string vacio. Una reserva cargada sin
 * cliente no aparece en ninguna ficha: no hay forma de saber de quien es.
 */
export function reservasDelCliente(reservas, clientId) {
  if (clientId === null || clientId === undefined || clientId === '') return [];
  const id = Number(clientId);
  if (!Number.isFinite(id)) return [];
  return (reservas || []).filter(
    (g) => g.clientId !== null && g.clientId !== undefined && g.clientId !== '' && Number(g.clientId) === id
  );
}

/** Vigente: no cancelada y todavia no termino (en curso o por venir). */
function esVigente(reserva, hoy) {
  return reserva.status !== 'cancelled' && (reserva.endDate || '') >= hoy;
}

/** Las demas reservas vigentes del mismo cliente, por fecha de inicio. */
export function otrasReservasVigentes(reservas, reserva, hoy) {
  if (!reserva) return [];
  return reservasDelCliente(reservas, reserva.clientId)
    .filter((g) => g.id !== reserva.id && esVigente(g, hoy))
    .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
}

/** Lo que falta pagar de una reserva. */
export function saldoDe(reserva) {
  return Math.max(0, numero(reserva.totalPrice) - numero(reserva.paidAmount));
}

/** Total reservado, pagado y saldo de un conjunto de reservas, sin las canceladas. */
export function estadoDeCuenta(reservas) {
  let total = 0;
  let pagado = 0;
  for (const g of reservas || []) {
    if (g.status === 'cancelled') continue;
    total += numero(g.totalPrice);
    pagado += numero(g.paidAmount);
  }
  return { total, pagado, saldo: Math.max(0, total - pagado) };
}

/**
 * Cuantos dias seguidos, contando `fecha`, queda ocupada una unidad.
 *
 * Sale de las fechas de fin de las reservas y no de un mapa dia por dia, que
 * es lo que usaba la vista rapida: ese mapa solo se carga para los proximos 90
 * dias, asi que una estadia de temporada marcaba "Ocupada 90 dias".
 *
 * Encadena reservas pegadas de la misma unidad, porque la pregunta que
 * responde es cuando se libera. Si queda un dia libre en el medio, corta ahi.
 */
export function diasOcupadaDesde(reservas, serviceType, resourceNumber, fecha) {
  const deLaUnidad = (reservas || []).filter(
    (g) =>
      g.status !== 'cancelled' &&
      g.serviceType === serviceType &&
      Number(g.resourceNumber) === Number(resourceNumber)
  );

  const actual = deLaUnidad.find((g) => g.startDate <= fecha && g.endDate >= fecha);
  if (!actual) return 0;

  let fin = actual.endDate;
  for (;;) {
    const diaSiguiente = sumarUnDia(fin);
    const pegada = deLaUnidad.find((g) => g.startDate <= diaSiguiente && g.endDate > fin);
    if (!pegada) break;
    fin = pegada.endDate;
  }

  return diasInclusivos(fecha, fin);
}
