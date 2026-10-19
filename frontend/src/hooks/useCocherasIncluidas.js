import useUnidadesOcupadas from './useUnidadesOcupadas';
import { analizarCocheras } from '../lib/incluidos';

/**
 * Disponibilidad y validacion de las cocheras incluidas en una carpa o
 * sombrilla. La disponibilidad se pide al servidor para todo el periodo (ver
 * useUnidadesOcupadas); el analisis dice que plaza toma cada cochera y si
 * algo impide guardar.
 */
export default function useCocherasIncluidas({ establishment, cocheras, desde, hasta, activo }) {
  const lista = Array.isArray(cocheras) ? cocheras : [];
  const capacidad = establishment?.hasParking
    ? Number.parseInt(establishment?.parkingCapacity ?? '0', 10) || 0
    : 0;
  const estacionamiento = useUnidadesOcupadas('parking', desde, hasta, Boolean(activo) && lista.length > 0);
  const analisis = analizarCocheras({
    cocheras: lista,
    ocupadas: estacionamiento.ocupadas,
    capacidad,
    verificando: estacionamiento.verificando
  });
  return { capacidad, estacionamiento, analisis };
}
