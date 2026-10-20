/**
 * Que numeros de unidad existen para cada servicio.
 *
 * Sin plano, las unidades son 1..capacidad configurada. Con un plano (el del
 * establecimiento, ver config/planos.js), carpas y sombrillas salen del plano:
 * la numeracion puede tener huecos (en Zeus, 117 carpas numeradas hasta la
 * 134), asi que 1..capacidad no sirve. El estacionamiento no esta en el plano
 * y sigue por capacidad.
 */
import { planoDe } from '../config/planos';

const CAMPO_CAPACIDAD = {
  carpa: 'carpasCapacity',
  sombrilla: 'sombrillasCapacity',
  parking: 'parkingCapacity'
};

export function numerosDeUnidades(establishment, serviceType) {
  const delPlano = planoDe(establishment)?.[serviceType];
  if (delPlano) return delPlano;

  const campo = CAMPO_CAPACIDAD[serviceType];
  const capacidad = Number.parseInt(establishment?.[campo] ?? '0', 10) || 0;
  return Array.from({ length: Math.max(0, capacidad) }, (_, i) => i + 1);
}

/** Cantidad de unidades que fija el plano del establecimiento, o null si el servicio no esta en un plano. */
export function capacidadDelPlano(establishment, serviceType) {
  const delPlano = planoDe(establishment)?.[serviceType];
  return delPlano ? delPlano.length : null;
}
