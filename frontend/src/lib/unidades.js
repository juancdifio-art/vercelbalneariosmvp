/**
 * Que numeros de unidad existen para cada servicio.
 *
 * Sin plano, las unidades son 1..capacidad configurada. Con el plano de Zeus
 * activo, carpas y sombrillas salen del plano: la numeracion de carpas tiene
 * huecos (117 carpas numeradas hasta la 134), asi que 1..capacidad no sirve.
 * El estacionamiento no esta en el plano y sigue por capacidad.
 */
import { PLANO_ACTIVO, NUMEROS_CARPAS, NUMEROS_SOMBRILLAS } from '../config/planoZeus';

const CAMPO_CAPACIDAD = {
  carpa: 'carpasCapacity',
  sombrilla: 'sombrillasCapacity',
  parking: 'parkingCapacity'
};

function numerosDelPlano(serviceType) {
  if (serviceType === 'carpa') return NUMEROS_CARPAS;
  if (serviceType === 'sombrilla') return NUMEROS_SOMBRILLAS;
  return null;
}

export function numerosDeUnidades(establishment, serviceType, conPlano = PLANO_ACTIVO) {
  const delPlano = conPlano ? numerosDelPlano(serviceType) : null;
  if (delPlano) return delPlano;

  const campo = CAMPO_CAPACIDAD[serviceType];
  const capacidad = Number.parseInt(establishment?.[campo] ?? '0', 10) || 0;
  return Array.from({ length: Math.max(0, capacidad) }, (_, i) => i + 1);
}

/** Cantidad de unidades que fija el plano, o null si el servicio no esta en el plano. */
export function capacidadDelPlano(serviceType, conPlano = PLANO_ACTIVO) {
  const delPlano = conPlano ? numerosDelPlano(serviceType) : null;
  return delPlano ? delPlano.length : null;
}
