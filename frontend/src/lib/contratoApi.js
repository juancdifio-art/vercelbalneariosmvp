// Pedidos del contrato imprimible: leer y guardar las condiciones del
// balneario, y juntar todo lo que lleva el contrato de una reserva.
import { getApiBaseUrl } from '../apiConfig';
import { armarContrato } from './contrato';
import { generarContratoPdf } from '../utils/generateContrato';

const ERRORES = {
  titulo_largo: 'El título es muy largo: máximo 120 caracteres.',
  condiciones_largas: 'Las condiciones son muy largas: máximo 20.000 caracteres.',
  dato_repetido: 'Hay dos datos con el mismo nombre.',
  dato_sin_nombre: 'Hay un dato con valor pero sin nombre.',
  nombre_dato_invalido: 'El nombre de un dato no puede llevar llaves ni pasar de 60 caracteres.',
  valor_dato_largo: 'El valor de un dato es muy largo: máximo 200 caracteres.',
  demasiados_datos: 'Son demasiados datos: máximo 50.',
  datos_invalidos: 'Revisá los datos del contrato.'
};

async function pedir(ruta, { method = 'GET', body } = {}) {
  const res = await fetch(`${getApiBaseUrl()}/api/${ruta}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('authToken')}` },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(ERRORES[data?.error] || 'No se pudo completar. Probá de nuevo.');
  return data;
}

export async function leerContrato() {
  return (await pedir('contrato')).contrato;
}

export async function guardarContrato({ titulo, condiciones, datos }) {
  return (await pedir('contrato', { method: 'PUT', body: { titulo, condiciones, datos } })).contrato;
}

// Las personas y los sectores completan el contrato, pero sin ellos igual se
// imprime: quedan las filas con puntos para llenar a mano.
async function opcional(ruta, clave) {
  try {
    return (await pedir(ruta))[clave] || [];
  } catch {
    return [];
  }
}

/**
 * Descarga el contrato de una carpa o sombrilla. `vinculadas` son las reservas
 * de la cuenta (de ahi salen las cocheras incluidas) y `pagos`, los de la carpa.
 */
export async function descargarContrato({ reserva, establecimiento, titular, vinculadas = [], pagos = [], total = null }) {
  const [contrato, personas, sectores] = await Promise.all([
    leerContrato(),
    opcional(`reservation-groups/${reserva.id}/guests`, 'guests'),
    opcional('tarifas/sectores', 'sectores')
  ]);
  const cocheras = vinculadas.filter((g) => g.serviceType === 'parking' && g.vinculo === 'incluido');
  const datos = armarContrato({
    establecimiento,
    contrato,
    reserva,
    titular,
    personas,
    cocheras,
    sectores,
    pagos,
    total,
    maxPersonas: Number(establecimiento?.maxPersonasPorUnidad) || 6
  });
  return generarContratoPdf(datos);
}
