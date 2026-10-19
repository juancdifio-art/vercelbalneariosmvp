// Reglas puras de los servicios incluidos en una carpa o sombrilla (pileta y
// cocheras). No tocan la base: las usan servicio.js y las dos APIs.
// Spec: docs/superpowers/specs/2026-09-26-servicios-incluidos-design.md

const { fechaISO } = require('../_tarifas/servicio');

const EDAD_ADULTO = 18;
const PASES_POR_DEFECTO = { carpa: 4, sombrilla: 0 };
const MAX_PERSONAS_POR_DEFECTO = 6;
const UNIDADES_DE_SOMBRA = ['carpa', 'sombrilla'];

const texto = (v) => String(v ?? '').trim();
const entero = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
};
const numero = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

function normalizarPatente(valor) {
  return String(valor ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Si hay fecha de nacimiento la edad sale de ahi; si no, vale la cargada a mano.
function edadDe({ age, birthDate } = {}, hoy = new Date()) {
  if (birthDate) {
    const [y, m, d] = fechaISO(birthDate).split('-').map(Number);
    if (y && m && d) {
      let edad = hoy.getFullYear() - y;
      const cumplio = hoy.getMonth() + 1 > m || (hoy.getMonth() + 1 === m && hoy.getDate() >= d);
      if (!cumplio) edad -= 1;
      return edad >= 0 ? edad : null;
    }
  }
  const n = entero(age);
  return n !== null && n >= 0 ? n : null;
}

const esMenor = (edad) => edad !== null && edad !== undefined && edad < EDAD_ADULTO;

// Para tener pase hacen falta nombre, DNI y edad: es lo que va a buscar
// el control de acceso a la pileta.
function personaCompleta(p = {}, hoy = new Date()) {
  return texto(p.fullName) !== '' && texto(p.documentNumber) !== '' && edadDe(p, hoy) !== null;
}

function contarPorEdad(personas, hoy = new Date()) {
  let children = 0;
  for (const p of personas) if (esMenor(edadDe(p, hoy))) children += 1;
  return { adults: personas.length - children, children };
}

function pasesIncluidos(est, serviceType) {
  const columna = { carpa: 'pases_pileta_por_carpa', sombrilla: 'pases_pileta_por_sombrilla' }[serviceType];
  if (!columna) return 0;
  return entero(est?.[columna]) ?? PASES_POR_DEFECTO[serviceType];
}

const maxPersonas = (est) => entero(est?.max_personas_por_unidad) ?? MAX_PERSONAS_POR_DEFECTO;

// El contrato admite 6 personas por unidad de sombra: se bloquea, no se avisa.
function validarTope(est, adults, children) {
  const total = (entero(adults) || 0) + (entero(children) || 0);
  return total > maxPersonas(est) ? 'too_many_people' : null;
}

// Lo que manda el navegador en `incluidos`, validado y normalizado.
function normalizarPedido(incluidos, est, serviceType) {
  const vacio = { pileta: false, cocheras: [] };
  if (!incluidos) return vacio;
  const pileta = Boolean(incluidos.pileta);
  const lista = Array.isArray(incluidos.cocheras) ? incluidos.cocheras : [];
  if (!pileta && lista.length === 0) return vacio;

  if (!UNIDADES_DE_SOMBRA.includes(serviceType)) return { error: 'incluidos_invalidos' };
  if (pileta && (!est?.has_pileta || pasesIncluidos(est, serviceType) <= 0)) return { error: 'pileta_no_incluible' };
  if (lista.length && !est?.has_parking) return { error: 'parking_no_incluible' };

  const cocheras = [];
  const plazas = new Set();
  for (const c of lista) {
    const vehiclePlate = normalizarPatente(c?.vehiclePlate);
    if (!vehiclePlate) return { error: 'vehicle_plate_required' };
    const plaza = entero(c?.plaza);
    const plazaValida = plaza !== null && plaza > 0 ? plaza : null;
    if (plazaValida !== null) {
      if (plazas.has(plazaValida)) return { error: 'plaza_repetida' };
      plazas.add(plazaValida);
    }
    const precio = c?.precio || {};
    cocheras.push({
      plaza: plazaValida,
      vehiclePlate,
      totalPrice: numero(precio.cobrado ?? c?.totalPrice),
      motivoAjuste: precio.motivoAjuste ?? precio.motivo ?? c?.motivoAjuste ?? null
    });
  }
  return { pileta, cocheras };
}

// Personas cargadas en el alta de la carpa: acompanantes (solo el nombre es
// obligatorio; una fila sin nombre no se guarda) y los datos del titular, que
// van a la ficha del cliente. `pileta` dice a quien le toca un pase incluido.
// null si no vino nada: el alta sigue como antes.
function normalizarPersonas(personas, titular) {
  if (personas === undefined && titular === undefined) return null;
  const textoONull = (v) => (texto(v) === '' ? null : texto(v));
  const lista = (Array.isArray(personas) ? personas : [])
    .filter((p) => texto(p?.fullName) !== '')
    .map((p) => {
      const edad = entero(p.age);
      return {
        fullName: texto(p.fullName),
        documentNumber: textoONull(p.documentNumber),
        age: edad !== null && edad >= 0 ? edad : null,
        birthDate: textoONull(p.birthDate),
        pileta: Boolean(p.pileta),
        // Un pase incluido o uno pago, nunca los dos: gana el incluido.
        pasePago: Boolean(p.pasePago) && !p.pileta
      };
    });
  return {
    personas: lista,
    titular: titular
      ? {
        documentNumber: textoONull(titular.documentNumber),
        birthDate: textoONull(titular.birthDate),
        pileta: Boolean(titular.pileta),
        pasePago: Boolean(titular.pasePago) && !titular.pileta
      }
      : null
  };
}

// Precio por dia del pase de pileta pago que se vende en el alta.
function normalizarPasePago(pasePago) {
  if (!pasePago) return null;
  const precioAdulto = numero(pasePago.precioAdultoPorDia) ?? 0;
  const precioMenor = numero(pasePago.precioMenorPorDia) ?? 0;
  if (![precioAdulto, precioMenor].every((n) => Number.isFinite(n) && n >= 0)) return { error: 'precio_invalido' };
  return { precioAdulto, precioMenor };
}

// El pago de la cuenta: un monto y un medio. Sin monto no hay pago.
function normalizarPago(pago) {
  if (!pago || pago.monto === undefined || pago.monto === null || pago.monto === '') return null;
  const monto = Number(String(pago.monto).replace(',', '.'));
  if (!Number.isFinite(monto) || monto < 0) return { error: 'pago_invalido' };
  if (monto === 0) return null;
  const metodo = texto(pago.metodo);
  if (!metodo) return { error: 'payment_method_required' };
  return { monto, metodo };
}

const centavos = (n) => Math.round(Number(n) * 100);

// Un pago de la cuenta se imputa en orden (la carpa, las cocheras, la pileta
// paga) hasta cubrir el saldo de cada reserva. No se puede pagar de mas.
function repartirPago(monto, items) {
  let resto = centavos(monto);
  const totalSaldo = items.reduce((suma, it) => suma + Math.max(0, centavos(it.saldo)), 0);
  if (resto > totalSaldo) return { error: 'pago_excede_total' };
  const partes = [];
  for (const it of items) {
    if (resto <= 0) break;
    const saldo = Math.max(0, centavos(it.saldo));
    if (saldo === 0) continue;
    const parte = Math.min(saldo, resto);
    partes.push({ id: it.id, monto: parte / 100 });
    resto -= parte;
  }
  return partes;
}

const hayIncluidos = (pedido) => Boolean(pedido && (pedido.pileta || pedido.cocheras.length));

// Un incluido se maneja desde su carpa. La cochera deja cambiar plaza y
// patente; el pase incluido no se edita (sus personas van por pase-personas).
function validarEdicionIncluido(current, body) {
  if (current?.vinculo !== 'incluido') return null;
  if (current.service_type === 'pileta') return 'servicio_incluido_no_editable';
  const fechaDistinta = (nueva, actual) => nueva !== undefined && nueva !== null && nueva !== fechaISO(actual);
  // Mandar el mismo valor que ya tiene no cuenta como cambio.
  const estadoNuevo = body.status !== undefined && body.status !== null && body.status !== current.status;
  const clienteNuevo = body.clientId !== undefined && (entero(body.clientId) ?? null) !== (current.client_id ?? null);
  if (
    estadoNuevo ||
    clienteNuevo ||
    fechaDistinta(body.startDate, current.start_date) ||
    fechaDistinta(body.endDate, current.end_date)
  ) {
    return 'servicio_incluido_no_editable';
  }
  return null;
}

module.exports = {
  EDAD_ADULTO,
  UNIDADES_DE_SOMBRA,
  normalizarPatente,
  edadDe,
  esMenor,
  personaCompleta,
  contarPorEdad,
  pasesIncluidos,
  maxPersonas,
  validarTope,
  normalizarPedido,
  normalizarPersonas,
  normalizarPasePago,
  normalizarPago,
  repartirPago,
  hayIncluidos,
  validarEdicionIncluido
};
