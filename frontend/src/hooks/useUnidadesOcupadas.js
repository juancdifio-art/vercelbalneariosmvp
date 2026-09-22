import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '../apiConfig';
import { unidadesOcupadas } from '../lib/reservas';

const API_BASE_URL = getApiBaseUrl();

const VACIO = new Set();

/**
 * Que unidades de un servicio estan ocupadas en algun dia de [desde, hasta],
 * preguntandole al servidor.
 *
 * Los modales de alta usaban la lista de reservas que ya tiene la app, pero
 * esa lista depende de la seccion: en Carpas trae solo carpas y solo los 30
 * dias de la grilla. Asi, al incluir estacionamiento ninguna plaza figuraba
 * ocupada, y en una estadia de 200 dias una carpa tomada despues del dia 30
 * aparecia libre.
 *
 * La disponibilidad se pide fresca y no se cachea: si otro operador reserva
 * mientras tanto, una copia vieja la mostraria libre. Se pide solo cuando
 * estan las dos fechas, no en cada tecla.
 *
 * Devuelve:
 *  - ocupadas: Set de numeros de unidad
 *  - verificando: true mientras espera la respuesta
 *  - fallo: true si no se pudo consultar. En ese caso no se bloquea nada: el
 *    servidor igual rechaza una reserva superpuesta al guardarla.
 */
export default function useUnidadesOcupadas(serviceType, desde, hasta, activo = true) {
  const [estado, setEstado] = useState({ clave: '', ocupadas: VACIO, fallo: false });

  const hayRango = Boolean(activo && serviceType && desde && hasta);
  const [a, b] = hayRango && desde > hasta ? [hasta, desde] : [desde, hasta];
  const clave = hayRango ? `${serviceType}|${a}|${b}` : '';

  useEffect(() => {
    if (!clave) return undefined;

    const token = sessionStorage.getItem('authToken');
    let cancelado = false;

    (async () => {
      try {
        const params = new URLSearchParams({ service: serviceType, status: 'active', from: a, to: b });
        const res = await fetch(`${API_BASE_URL}/api/reservation-groups?${params}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        // Se vuelve a filtrar aca: si un backend ignorara algun parametro, la
        // respuesta traeria de mas y se marcarian unidades libres como ocupadas.
        const ocupadas = unidadesOcupadas(data.reservationGroups || [], serviceType, a, b);
        if (!cancelado) setEstado({ clave, ocupadas, fallo: false });
      } catch (err) {
        console.error('Error checking availability', err);
        if (!cancelado) setEstado({ clave, ocupadas: VACIO, fallo: true });
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [clave, serviceType, a, b]);

  if (!clave) return { ocupadas: VACIO, verificando: false, fallo: false };

  // Mientras la respuesta no corresponde a las fechas actuales, se esta verificando.
  const alDia = estado.clave === clave;
  return {
    ocupadas: alDia ? estado.ocupadas : VACIO,
    verificando: !alDia,
    fallo: alDia && estado.fallo
  };
}
