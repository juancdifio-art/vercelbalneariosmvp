import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '../apiConfig';
import { deudasPorCliente, hoyISO } from '../lib/reservas';

const API_BASE_URL = getApiBaseUrl();

/**
 * Deuda vencida de cada cliente (lo impago de reservas ya terminadas), como
 * un Map por clientId. La usan el buscador del alta de reservas, para avisar
 * antes de elegir al cliente, y la seccion Clientes, para filtrar.
 *
 * Pide todas las reservas por su cuenta en vez de usar la lista que ya tiene
 * la app: esa lista depende de la seccion (en Carpas trae solo carpas y solo
 * la ventana visible) y dejaria afuera justo las estadias ya terminadas.
 *
 * Mientras carga, o si el pedido falla, devuelve un Map vacio: no hay aviso,
 * pero nada se rompe.
 */
export default function useDeudasClientes() {
  const [deudas, setDeudas] = useState(() => new Map());

  useEffect(() => {
    const token = sessionStorage.getItem('authToken');
    if (!token) return undefined;

    let cancelado = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/reservation-groups`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelado) setDeudas(deudasPorCliente(data.reservationGroups || [], hoyISO()));
      } catch (err) {
        console.error('Error loading client debts', err);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  return deudas;
}
