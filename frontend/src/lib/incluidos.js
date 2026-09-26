// Servicios incluidos en una carpa o sombrilla: pileta (pases con nombre) y
// cocheras. El servidor valida todo de nuevo; esto arma lo que se le manda y
// traduce lo que responde.
// Spec: docs/superpowers/specs/2026-09-26-servicios-incluidos-design.md

import { edadDe } from './personas';
import { PRECIO_VACIO } from './tarifas';

const EDAD_ADULTO = 18;
const PASES_POR_DEFECTO = { carpa: 4, sombrilla: 0 };
const MAX_PERSONAS_POR_DEFECTO = 6;

const entero = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
};

/** Una cochera nueva del formulario, con su precio y su pago inicial. */
export function cocheraVacia() {
  return { plaza: '', vehiclePlate: '', precio: { ...PRECIO_VACIO }, pagoMonto: '', pagoMetodo: '' };
}

/**
 * Lo que va en `incluidos` al crear la reserva. El pago inicial de cada
 * cochera no viaja aca: se registra despues, con el id que devuelve el servidor.
 */
export function armarIncluidos({ incluyePileta, cocheras }) {
  const lista = Array.isArray(cocheras) ? cocheras : [];
  if (!incluyePileta && lista.length === 0) return undefined;
  return {
    pileta: Boolean(incluyePileta),
    cocheras: lista.map((c) => {
      const plaza = entero(c.plaza);
      return {
        plaza: plaza && plaza > 0 ? plaza : null,
        vehiclePlate: c.vehiclePlate || '',
        precio: { cobrado: c.precio?.cobrado ?? '', motivoAjuste: c.precio?.motivo ?? '' }
      };
    })
  };
}

const OCUPADA = 'La unidad está ocupada en esas fechas.';

/** El texto para el operador de un error del servidor, o null si no es conocido. */
export function mensajeErrorIncluidos(data) {
  if (!data || !data.error) return null;
  switch (data.error) {
    case 'client_required':
      return 'Para incluir pileta o cochera, elegí un cliente o creá uno nuevo.';
    case 'too_many_people':
      return `Máximo ${data.max ?? MAX_PERSONAS_POR_DEFECTO} personas por unidad.`;
    case 'pileta_no_incluible':
      return 'Esta unidad no incluye pases de pileta.';
    case 'parking_no_incluible':
      return 'El balneario no tiene el estacionamiento habilitado.';
    case 'vehicle_plate_required':
      return 'Falta la patente del vehículo: es obligatoria para usar el estacionamiento.';
    case 'plaza_repetida':
      return 'Elegiste la misma plaza para dos cocheras.';
    case 'parking_unavailable':
      return data.message || 'No quedan cocheras libres en esas fechas.';
    case 'resource_conflict':
    case 'reservation_conflict':
    case 'no_availability':
      return data.message || OCUPADA;
    case 'servicio_incluido_no_editable':
      return 'Este servicio está incluido en una carpa: se cambia desde la reserva de la carpa.';
    case 'persona_incompleta':
      return `Falta DNI o edad de: ${(data.personas || []).join(', ')}.`;
    case 'demasiados_pases':
      return `La reserva incluye ${data.max} pases de pileta.`;
    case 'persona_con_pase':
      return 'Esa persona ya tiene otro pase de pileta.';
    case 'motivo_ajuste_required':
      return 'El total es distinto al de la tarifa: falta el motivo del ajuste.';
    case 'rango_invalido':
    case 'fecha_invalida':
      return 'Revisá las fechas: la salida no puede ser anterior a la entrada.';
    default:
      return null;
  }
}

export const esMenor = (edad) => edad !== null && edad !== undefined && edad < EDAD_ADULTO;

/** Para tener pase hacen falta nombre, DNI y edad (o fecha de nacimiento). */
export function personaCompletaParaPase(p, hoy = new Date()) {
  if (!p) return false;
  return String(p.fullName ?? '').trim() !== '' &&
    String(p.documentNumber ?? '').trim() !== '' &&
    edadDe(p, hoy) !== null;
}

export function contarPorEdad(personas, hoy = new Date()) {
  const lista = Array.isArray(personas) ? personas : [];
  const children = lista.filter((p) => esMenor(edadDe(p, hoy))).length;
  return { adults: lista.length - children, children };
}

const NOMBRE_UNIDAD = { carpa: 'Carpa', sombrilla: 'Sombrilla' };

/** "Incluido en Carpa 12" o "Pase pago · Carpa 12"; null si no esta vinculado. */
export function etiquetaVinculo(group) {
  if (!group || !group.vinculo) return null;
  const unidad = `${NOMBRE_UNIDAD[group.incluidaEnTipo] || 'Carpa'} ${group.incluidaEnNumero ?? ''}`.trim();
  return group.vinculo === 'adicional' ? `Pase pago · ${unidad}` : `Incluido en ${unidad}`;
}

export function pasesIncluidosPara(establishment, serviceType) {
  if (!establishment?.hasPileta) return 0;
  const valor = serviceType === 'carpa'
    ? establishment.pasesPiletaPorCarpa
    : serviceType === 'sombrilla'
      ? establishment.pasesPiletaPorSombrilla
      : null;
  if (!(serviceType in PASES_POR_DEFECTO)) return 0;
  return entero(valor) ?? PASES_POR_DEFECTO[serviceType];
}

export const maxPersonasPara = (establishment) => entero(establishment?.maxPersonasPorUnidad) ?? MAX_PERSONAS_POR_DEFECTO;

export function superaTope(establishment, adultsCount, childrenCount) {
  return (entero(adultsCount) || 0) + (entero(childrenCount) || 0) > maxPersonasPara(establishment);
}
