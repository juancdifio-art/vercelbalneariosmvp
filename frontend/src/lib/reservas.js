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

/** Hoy en yyyy-mm-dd, en hora local: en Argentina, despues de las 21 hs UTC ya es manana. */
export function hoyISO(ahora = new Date()) {
  const m = String(ahora.getMonth() + 1).padStart(2, '0');
  const d = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${m}-${d}`;
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

/**
 * Deuda vencida: lo que quedo sin pagar de reservas que ya terminaron.
 *
 * Las reservas en curso con saldo no cuentan: es normal que se paguen durante
 * la estadia. Lo que interesa avisar es el cliente que se fue debiendo.
 */
function esDeudaVencida(reserva, hoy) {
  return reserva.status !== 'cancelled' && (reserva.endDate || '') < hoy && saldoDe(reserva) > 0.01;
}

/**
 * Deuda vencida de cada cliente que tiene alguna, en un Map por clientId.
 * Cada entrada trae el monto total y las reservas que la componen, de la mas
 * reciente a la mas vieja. Las reservas sin cliente se ignoran: no hay a quien
 * atribuirselas.
 */
export function deudasPorCliente(reservas, hoy) {
  const porCliente = new Map();
  for (const g of reservas || []) {
    if (g.clientId === null || g.clientId === undefined || g.clientId === '') continue;
    if (!esDeudaVencida(g, hoy)) continue;
    const id = Number(g.clientId);
    const actual = porCliente.get(id) || { monto: 0, reservas: [] };
    actual.monto += saldoDe(g);
    actual.reservas.push(g);
    porCliente.set(id, actual);
  }
  for (const deuda of porCliente.values()) {
    deuda.reservas.sort((a, b) => (b.endDate || '').localeCompare(a.endDate || ''));
  }
  return porCliente;
}

/**
 * Unidades de un servicio ocupadas en algun dia del periodo [desde, hasta].
 * Alcanza con que se superpongan un solo dia: una plaza tomada el ultimo dia
 * de la estadia no se puede ofrecer.
 */
export function unidadesOcupadas(reservas, serviceType, desde, hasta) {
  const ocupadas = new Set();
  if (!desde || !hasta) return ocupadas;
  const [a, b] = desde <= hasta ? [desde, hasta] : [hasta, desde];
  for (const g of reservas || []) {
    if (g.serviceType !== serviceType) continue;
    if (g.status === 'cancelled') continue;
    if (g.startDate <= b && g.endDate >= a) ocupadas.add(Number(g.resourceNumber));
  }
  return ocupadas;
}

function deLaUnidad(reservas, serviceType, resourceNumber) {
  return (reservas || []).filter(
    (g) =>
      g.status !== 'cancelled' &&
      g.serviceType === serviceType &&
      Number(g.resourceNumber) === Number(resourceNumber)
  );
}

/** La reserva que ocupa la unidad en esa fecha, o null. */
export function reservaEnFecha(reservas, serviceType, resourceNumber, fecha) {
  return (
    deLaUnidad(reservas, serviceType, resourceNumber).find(
      (g) => g.startDate <= fecha && g.endDate >= fecha
    ) || null
  );
}

/** La primera reserva de la unidad que empieza despues de esa fecha, o null. */
export function proximaReserva(reservas, serviceType, resourceNumber, fecha) {
  const futuras = deLaUnidad(reservas, serviceType, resourceNumber)
    .filter((g) => g.startDate > fecha)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  return futuras[0] || null;
}

/**
 * La plaza de estacionamiento reservada junto con una carpa o sombrilla: mismo
 * cliente (o, si no hay cliente cargado, mismo nombre) y mismas fechas. Es el
 * mismo criterio que usa el detalle de la reserva.
 */
export function estacionamientoVinculado(reservas, reserva) {
  if (!reserva) return null;
  const nombre = (reserva.customerName || '').trim().toLowerCase();
  return (
    (reservas || []).find((g) => {
      if (!g || g.serviceType !== 'parking' || g.status === 'cancelled') return false;
      if (g.startDate !== reserva.startDate || g.endDate !== reserva.endDate) return false;
      if (reserva.clientId && g.clientId) return String(g.clientId) === String(reserva.clientId);
      return Boolean(nombre) && (g.customerName || '').trim().toLowerCase() === nombre;
    }) || null
  );
}
