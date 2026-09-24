import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '../apiConfig';

const API_BASE_URL = getApiBaseUrl();

/**
 * Pide al servidor el precio de una unidad para [desde, hasta].
 *
 * Igual que useUnidadesOcupadas: no se cachea (una tarifa puede cambiar
 * mientras tanto) y se pide solo cuando estan unidad y las dos fechas.
 * Si falla, el modal deja cargar el precio a mano; el servidor igual
 * recalcula al guardar.
 */
export default function useCotizacion(serviceType, resourceNumber, desde, hasta, activo = true) {
  const [estado, setEstado] = useState({ clave: '', cotizacion: null, fallo: false });

  const numero = Number(resourceNumber);
  const hay = Boolean(activo && serviceType && numero > 0 && desde && hasta);
  const [a, b] = hay && desde > hasta ? [hasta, desde] : [desde, hasta];
  const clave = hay ? `${serviceType}|${numero}|${a}|${b}` : '';

  useEffect(() => {
    if (!clave) return undefined;
    const token = sessionStorage.getItem('authToken');
    let cancelado = false;

    (async () => {
      try {
        const params = new URLSearchParams({ serviceType, resourceNumber: String(numero), startDate: a, endDate: b });
        const res = await fetch(`${API_BASE_URL}/api/tarifas/cotizar?${params}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        if (!data || !data.cotizacion) throw new Error('respuesta sin cotizacion');
        if (!cancelado) setEstado({ clave, cotizacion: data.cotizacion, fallo: false });
      } catch (err) {
        console.error('Error cotizando', err);
        if (!cancelado) setEstado({ clave, cotizacion: null, fallo: true });
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [clave, serviceType, numero, a, b]);

  if (!clave) return { clave: '', cotizacion: null, verificando: false, fallo: false };
  const alDia = estado.clave === clave;
  return { clave, cotizacion: alDia ? estado.cotizacion : null, verificando: !alDia, fallo: alDia && estado.fallo };
}
