// Contrato de una carpa o sombrilla: arma lo que se imprime a partir de la
// reserva, el titular, las personas y las condiciones que el balneario carga en
// Panel de usuario > Contrato. Es puro: el PDF lo dibuja utils/generateContrato.js.
import { fechaCorta, etiquetaMetodo, nombreUnidad } from './formato';
import { formatPesos } from './money';
import { formatearPatente } from './patente';

export const TITULO_POR_DEFECTO = 'CONTRATACIÓN DE UNIDAD DE SOMBRA';

/**
 * Las condiciones, linea por linea. Una linea escrita entre ** y ** sale en
 * negrita; una linea vacia separa parrafos.
 */
export function lineasCondiciones(texto) {
  return String(texto || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((linea) => {
      const m = /^\s*\*\*(.+)\*\*\s*$/.exec(linea);
      return m ? { texto: m[1].trim(), negrita: true } : { texto: linea.trimEnd(), negrita: false };
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

  const nomina = personas.map((p) => ({ nombre: p.fullName || '', dni: p.documentNumber || '' }));
  const filas = Math.max(maxPersonas - 1, nomina.length, 1);
  while (nomina.length < filas) nomina.push({ nombre: '', dni: '' });

  return {
    balneario: establecimiento?.name || '',
    titulo: (contrato?.titulo || '').trim() || TITULO_POR_DEFECTO,
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
    condiciones: lineasCondiciones(contrato?.condiciones)
  };
}
