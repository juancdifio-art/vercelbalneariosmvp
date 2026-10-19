import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiBaseUrl } from '../apiConfig';

const API_BASE_URL = getApiBaseUrl();

const ERRORES = {
  texto_requerido: 'Escribí un mensaje.',
  texto_largo: 'El mensaje es muy largo: máximo 2000 caracteres.',
  tipo_invalido: 'Elegí si es un error, una sugerencia o una consulta.',
  demasiados_mensajes: 'Mandaste muchos mensajes seguidos. Esperá un minuto y probá de nuevo.'
};

/** Pedido a /api/soporte/<ruta>. Un error trae el mensaje para mostrar. */
export async function pedirSoporte(ruta, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE_URL}/api/soporte/${ruta}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('authToken')}` },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error(ERRORES[data?.error] || 'No se pudo conectar con soporte. Probá de nuevo.');
  }
  return data;
}

/**
 * Contadores de soporte, preguntados cada `cadaMs`. `noLeidos`: respuestas sin
 * leer en el hilo propio. `bandeja`: mensajes de los balnearios sin leer, o
 * null si la cuenta no atiende soporte (la API solo lo manda a quien atiende).
 */
export function useNoLeidosSoporte(activo, cadaMs = 60000) {
  const [noLeidos, setNoLeidos] = useState(0);
  const [bandeja, setBandeja] = useState(null);

  const refrescar = useCallback(async () => {
    try {
      const d = await pedirSoporte('no-leidos');
      setNoLeidos(d.noLeidos || 0);
      setBandeja(typeof d.bandeja === 'number' ? d.bandeja : null);
    } catch {
      // El contador no es critico: si falla, queda el ultimo valor.
    }
  }, []);

  useEffect(() => {
    if (!activo) return undefined;
    refrescar();
    const id = setInterval(refrescar, cadaMs);
    return () => clearInterval(id);
  }, [activo, cadaMs, refrescar]);

  return { noLeidos, bandeja, refrescar };
}

/**
 * Un hilo de soporte: 'mensajes' (el del propio establecimiento) o
 * 'bandeja/<id>' (soporte). Se pide al abrir y cada `cadaMs` mientras `ruta`
 * no sea null. `alCargar` corre despues de cada lectura: la API marca leido lo
 * del otro lado al leer, asi que es el momento de actualizar los contadores.
 */
export function useHiloSoporte(ruta, { cadaMs = 15000, alCargar } = {}) {
  const [mensajes, setMensajes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const rutaVigente = useRef(ruta);
  rutaVigente.current = ruta;
  const avisar = useRef(alCargar);
  avisar.current = alCargar;

  const cargar = useCallback(async (conEspera) => {
    if (conEspera) setCargando(true);
    try {
      const d = await pedirSoporte(ruta);
      // Si mientras tanto se abrio otro hilo, esta respuesta ya no va.
      if (rutaVigente.current !== ruta) return;
      setMensajes(d.mensajes || []);
      setError('');
      avisar.current?.();
    } catch (e) {
      if (rutaVigente.current === ruta) setError(e.message);
    } finally {
      if (conEspera) setCargando(false);
    }
  }, [ruta]);

  useEffect(() => {
    setMensajes([]);
    setError('');
    if (!ruta) return undefined;
    cargar(true);
    const id = setInterval(() => cargar(false), cadaMs);
    return () => clearInterval(id);
  }, [ruta, cadaMs, cargar]);

  const enviar = async (datos) => {
    setEnviando(true);
    setError('');
    try {
      const d = await pedirSoporte(ruta, { method: 'POST', body: datos });
      setMensajes((prev) => [...prev, d.mensaje]);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setEnviando(false);
    }
  };

  return { mensajes, cargando, error, enviando, enviar };
}
