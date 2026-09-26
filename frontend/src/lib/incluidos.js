// Servicios incluidos en una carpa o sombrilla: pileta (pases con nombre) y
// cocheras. El servidor valida todo de nuevo; esto arma lo que se le manda y
// traduce lo que responde.
// Spec: docs/superpowers/specs/2026-09-26-servicios-incluidos-design.md

import { edadDe } from './personas';
import { PRECIO_VACIO, aNumero, faltaMotivoAjuste } from './tarifas';
import { normalizarPatente } from './patente';

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

const montoPago = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number.parseFloat(String(v).replace(',', '.'));
  return Number.isNaN(n) ? 0 : n;
};

/**
 * Estado de las cocheras del formulario frente a la disponibilidad real.
 *
 * Una cochera sin plaza elegida toma la primera libre que no haya elegido
 * otra cochera del mismo formulario: es la que se cotiza y la que se manda,
 * asi lo cotizado es lo que se guarda. El servidor la vuelve a confirmar.
 */
export function analizarCocheras({ cocheras, ocupadas, capacidad, verificando }) {
  const lista = Array.isArray(cocheras) ? cocheras : [];
  const elegidas = lista.map((c) => entero(c.plaza)).filter((n) => n && n > 0);
  const tomadas = new Set(elegidas);

  const efectivas = lista.map((c) => {
    const plaza = entero(c.plaza);
    if (plaza && plaza > 0) return plaza;
    if (verificando) return null;
    for (let n = 1; n <= capacidad; n += 1) {
      if (!ocupadas.has(n) && !tomadas.has(n)) {
        tomadas.add(n);
        return n;
      }
    }
    return null;
  });

  const mensajes = lista.map((c, i) => {
    if (entero(c.plaza) || verificando) return null;
    return efectivas[i] ? `Se asigna la plaza ${efectivas[i]}.` : 'No hay plazas libres en esas fechas.';
  });

  const conflicto = lista.map((c) => {
    const plaza = entero(c.plaza);
    return Boolean(plaza && ocupadas.has(plaza));
  });
  const pagoExcede = lista.map((c) => {
    const total = aNumero(c.precio?.cobrado);
    return total !== null && montoPago(c.pagoMonto) > total;
  });
  const pagoSinMetodo = lista.map((c) => montoPago(c.pagoMonto) > 0 && !c.pagoMetodo);
  const faltaPatente = lista.some((c) => !normalizarPatente(c.vehiclePlate));
  const faltaMotivo = lista.some((c) => faltaMotivoAjuste(c.precio ?? PRECIO_VACIO));
  const cotizando = lista.some((c) => Boolean(c.precio?.cotizando));
  const sinPlaza = !verificando && efectivas.some((p) => p === null);
  const total = lista.reduce((suma, c) => suma + (aNumero(c.precio?.cobrado) ?? 0), 0);

  const bloquea = lista.length > 0 && (
    verificando || sinPlaza || faltaPatente || faltaMotivo || cotizando ||
    conflicto.some(Boolean) || pagoExcede.some(Boolean) || pagoSinMetodo.some(Boolean)
  );

  return { efectivas, mensajes, conflicto, pagoExcede, pagoSinMetodo, faltaPatente, faltaMotivo, cotizando, sinPlaza, total, bloquea };
}

/**
 * Lo que va en `incluidos` al editar una carpa o sombrilla: pileta
 * agregada o quitada, cocheras canceladas y cocheras nuevas (con la plaza que
 * se cotizo). undefined si no cambio nada.
 */
export function cambiosIncluidos(modal, plazasCocheras = []) {
  if (!modal) return undefined;
  const cambios = {};
  const teniaPileta = Boolean(modal.incluidos?.pileta);
  if (modal.tempIncluyePileta !== undefined && Boolean(modal.tempIncluyePileta) !== teniaPileta) {
    cambios.pileta = Boolean(modal.tempIncluyePileta);
  }
  const canceladas = Array.isArray(modal.tempCocherasCanceladas) ? modal.tempCocherasCanceladas : [];
  if (canceladas.length) cambios.cocherasCanceladas = canceladas;
  const nuevas = Array.isArray(modal.cocheras) ? modal.cocheras : [];
  if (nuevas.length) {
    cambios.cocherasNuevas = armarIncluidos({ cocheras: nuevas }).cocheras.map((c, i) => ({
      ...c,
      plaza: plazasCocheras[i] ?? c.plaza,
      vehiclePlate: normalizarPatente(c.vehiclePlate)
    }));
  }
  return Object.keys(cambios).length ? cambios : undefined;
}

/**
 * Las filas de personas del alta de una carpa o sombrilla: el titular primero
 * (con los datos de la ficha del cliente, que se pueden completar ahi) y una
 * por acompanante segun adultos + menores, sin pasar el tope.
 *
 * Con pileta, cada fila dice si tiene pase. Por defecto lo tienen los primeros
 * con nombre, DNI y edad, hasta la cantidad de pases; lo que el operador marco
 * o desmarco a mano (`pileta` en el dato guardado) manda sobre eso.
 */
export function filasDePersonas({
  adultsCount, childrenCount, cliente, customerName = '', titularDatos, acompanantes = [],
  max = MAX_PERSONAS_POR_DEFECTO, pases = 0, incluyePileta = false
}) {
  const total = Math.min((entero(adultsCount) || 0) + (entero(childrenCount) || 0), max);
  if (total <= 0) return [];

  const t = titularDatos || {};
  const titular = cliente
    ? {
      esTitular: true,
      fullName: cliente.fullName || '',
      documentNumber: t.documentNumber ?? cliente.documentNumber ?? '',
      birthDate: t.birthDate ?? (cliente.birthDate ? String(cliente.birthDate).slice(0, 10) : ''),
      piletaElegida: t.pileta
    }
    : { esTitular: true, fullName: customerName || '', documentNumber: '', birthDate: '', sinFicha: true, piletaElegida: false };

  const filas = [titular];
  for (let i = 0; i < total - 1; i += 1) {
    const a = acompanantes[i] || {};
    filas.push({
      esTitular: false,
      indice: i,
      fullName: a.fullName || '',
      documentNumber: a.documentNumber || '',
      age: a.age ?? '',
      piletaElegida: a.pileta
    });
  }

  let usados = 0;
  return filas.map((f) => {
    const completa = !f.sinFicha && personaCompletaParaPase(f);
    let pileta = false;
    if (incluyePileta && completa) {
      const quiere = f.piletaElegida === undefined ? true : Boolean(f.piletaElegida);
      if (quiere && usados < pases) {
        pileta = true;
        usados += 1;
      }
    }
    return { ...f, completa, pileta };
  });
}

/** Lo que se manda al crear: datos del titular (van a su ficha) y acompanantes de esta reserva. */
export function armarPersonasAlta(filas) {
  const lista = Array.isArray(filas) ? filas : [];
  const out = {
    personas: lista
      .filter((f) => !f.esTitular && String(f.fullName ?? '').trim() !== '')
      .map((f) => ({ fullName: f.fullName, documentNumber: f.documentNumber, age: f.age, pileta: f.pileta }))
  };
  const titular = lista.find((f) => f.esTitular && !f.sinFicha);
  if (titular) out.titular = { documentNumber: titular.documentNumber, birthDate: titular.birthDate, pileta: titular.pileta };
  return out;
}
