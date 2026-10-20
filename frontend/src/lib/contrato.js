// Contrato de una carpa o sombrilla: arma lo que se imprime a partir de la
// reserva, el titular, las personas y las condiciones que el balneario carga en
// Panel de usuario > Contrato. En las condiciones, {Nombre} se cambia por el
// valor de ese dato. Es puro: el PDF lo dibuja utils/generateContrato.js.
import { fechaCorta, etiquetaMetodo, nombreUnidad } from './formato';
import { formatPesos } from './money';
import { formatearPatente } from './patente';

export const TITULO_POR_DEFECTO = 'CONTRATACIÓN DE UNIDAD DE SOMBRA';

// Un dato que no tiene valor sale con puntos, para completarlo a mano.
const SIN_VALOR = '..........';

// Los nombres se comparan sin mayusculas ni espacios de mas: {horario de la
// pileta} y {Horario de la Pileta} son el mismo dato.
const claveDato = (nombre) => String(nombre ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const MARCA_DATO = /\{([^{}\n]{1,60})\}/g;

/**
 * Datos que pone el sistema: no se cargan en la tabla del contrato porque ya
 * estan en la configuracion, y si cambian ahi cambian en el contrato.
 */
export function datosDelSistema({ nombreBalneario, maxPersonas } = {}) {
  return [
    { nombre: 'Máximo de personas', valor: maxPersonas == null || maxPersonas === '' ? '' : String(maxPersonas), origen: 'Panel de usuario › Establecimiento' },
    { nombre: 'Balneario', valor: nombreBalneario || '', origen: 'Panel de usuario › Establecimiento' }
  ];
}

export const esDatoDelSistema = (nombre) => datosDelSistema().some((d) => claveDato(d.nombre) === claveDato(nombre));

/** Nombre -> valor, con los del sistema por encima de los cargados a mano. */
export function valoresDelContrato(datos, sistema) {
  const valores = new Map();
  for (const d of datos || []) {
    if (String(d?.nombre ?? '').trim()) valores.set(claveDato(d.nombre), String(d.valor ?? '').trim());
  }
  for (const d of datosDelSistema(sistema)) valores.set(claveDato(d.nombre), d.valor);
  return valores;
}

/** Cambia cada {Nombre} por su valor. Un nombre que no es un dato queda como esta. */
export function reemplazarDatos(texto, valores) {
  return String(texto ?? '').replace(MARCA_DATO, (marca, nombre) => {
    if (!valores.has(claveDato(nombre))) return marca;
    return valores.get(claveDato(nombre)) || SIN_VALOR;
  });
}

/** Los {Nombre} del texto que no son ningun dato, sin repetir. */
export function datosFaltantes(texto, valores) {
  const faltan = [];
  for (const [, nombre] of String(texto ?? '').matchAll(MARCA_DATO)) {
    if (!valores.has(claveDato(nombre)) && !faltan.some((f) => claveDato(f) === claveDato(nombre))) faltan.push(nombre.trim());
  }
  return faltan;
}

/**
 * Un renglon en trozos: el texto fijo, el valor de cada dato (`dato`, que se
 * imprime en negrita para que se distinga) y las {marcas} que no son ningun
 * dato (`faltante`, que quedan tal cual). Sin `valores` no se reemplaza nada.
 */
function partesDelRenglon(renglon, valores) {
  if (!valores) return [{ texto: renglon, dato: false, faltante: false }];
  const partes = [];
  let desde = 0;
  for (const m of renglon.matchAll(MARCA_DATO)) {
    if (m.index > desde) partes.push({ texto: renglon.slice(desde, m.index), dato: false, faltante: false });
    const clave = claveDato(m[1]);
    partes.push(valores.has(clave)
      ? { texto: valores.get(clave) || SIN_VALOR, dato: true, faltante: false }
      : { texto: m[0], dato: false, faltante: true });
    desde = m.index + m[0].length;
  }
  if (desde < renglon.length) partes.push({ texto: renglon.slice(desde), dato: false, faltante: false });
  return partes;
}

/**
 * Las condiciones, renglon por renglon. Un renglon escrito entre ** y ** sale
 * en negrita; uno vacio separa parrafos. Con `valores`, cada {Nombre} se
 * cambia por el valor de ese dato (ver partesDelRenglon).
 */
export function lineasCondiciones(texto, valores = null) {
  return String(texto || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((renglon) => {
      const m = /^\s*\*\*(.+)\*\*\s*$/.exec(renglon);
      const partes = partesDelRenglon(m ? m[1].trim() : renglon.trimEnd(), valores);
      return { texto: partes.map((p) => p.texto).join(''), negrita: Boolean(m), partes };
    });
}

function diasEntre(desde, hasta) {
  const a = Date.parse(`${String(desde).slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${String(hasta).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000) + 1;
}

// Medios de pago distintos, en el orden en que se pagaron.
function formasDePago(pagos) {
  const vistos = [];
  for (const p of pagos || []) {
    const etiqueta = etiquetaMetodo(p.method || p.paymentMethod);
    if ((p.method || p.paymentMethod) && !vistos.includes(etiqueta)) vistos.push(etiqueta);
  }
  return vistos.join(', ');
}

/**
 * @param reserva  la carpa o sombrilla, como la devuelve la API
 * @param titular  ficha del cliente ({ fullName, documentNumber, phone, addressStreet, addressCity }) o null
 * @param personas acompañantes de la reserva ({ fullName, documentNumber })
 * @param cocheras cocheras incluidas ({ resourceNumber, vehiclePlate })
 * @param sectores sectores del balneario, para decir si la cochera es descubierta
 * @param pagos    pagos de la reserva
 * @param total    importe de toda la cuenta (la carpa y lo suyo)
 * @param maxPersonas tope de personas por unidad: la nomina deja esa cantidad de filas, menos el titular
 */
export function armarContrato({
  establecimiento,
  contrato,
  reserva,
  titular = null,
  personas = [],
  cocheras = [],
  sectores = [],
  pagos = [],
  total = null,
  maxPersonas = 6
}) {
  const dias = diasEntre(reserva.startDate, reserva.endDate);
  const sectorDeCochera = (numero) =>
    sectores.find((s) => s.serviceType === 'parking' && (s.unidades || []).map(Number).includes(Number(numero)))?.nombre || null;

  const valores = valoresDelContrato(contrato?.datos, { nombreBalneario: establecimiento?.name, maxPersonas });

  const nomina = personas.map((p) => ({ nombre: p.fullName || '', dni: p.documentNumber || '' }));
  const filas = Math.max(maxPersonas - 1, nomina.length, 1);
  while (nomina.length < filas) nomina.push({ nombre: '', dni: '' });

  return {
    balneario: establecimiento?.name || '',
    titulo: reemplazarDatos((contrato?.titulo || '').trim(), valores) || TITULO_POR_DEFECTO,
    numero: reserva.id ?? null,
    titular: [
      ['Titular', titular?.fullName || reserva.customerName || ''],
      ['DNI', titular?.documentNumber || reserva.clientDocumentNumber || ''],
      ['Ciudad', titular?.addressCity || ''],
      ['Dirección', titular?.addressStreet || ''],
      ['Teléfono', titular?.phone || reserva.customerPhone || '']
    ],
    contratacion: [
      ['Unidad', nombreUnidad(reserva.serviceType, reserva.resourceNumber)],
      ['Período', reserva.startDate && reserva.endDate
        ? `Del ${fechaCorta(reserva.startDate)} al ${fechaCorta(reserva.endDate)}${dias ? ` (${dias} ${dias === 1 ? 'día' : 'días'})` : ''}`
        : ''],
      ['Importe total', total == null || total === '' ? '' : formatPesos(total, 0)],
      ['Forma de pago', formasDePago(pagos)]
    ],
    cocheras: cocheras.map((c) => {
      const sector = sectorDeCochera(c.resourceNumber);
      const patente = c.vehiclePlate ? `patente ${formatearPatente(c.vehiclePlate)}` : '';
      return [`N° ${c.resourceNumber}`, sector, patente].filter(Boolean).join(' · ');
    }),
    nomina,
    condiciones: lineasCondiciones(contrato?.condiciones, valores)
  };
}
