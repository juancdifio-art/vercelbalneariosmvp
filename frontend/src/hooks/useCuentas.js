import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '../apiConfig';

const API_BASE_URL = getApiBaseUrl();

const ERRORES = {
  email_requerido: 'Escribí el email de la cuenta.',
  email_invalido: 'El email no es válido.',
  email_taken: 'Ya hay una cuenta con ese email.',
  nombre_requerido: 'Escribí el nombre del balneario.',
  nombre_largo: 'El nombre del balneario es muy largo.',
  modelo_no_encontrado: 'El balneario elegido para copiar ya no existe.',
  es_tu_cuenta: 'Tu propia clave se cambia desde el Panel de usuario.',
  otro_administrador: 'No se puede cambiar la clave de otro administrador.',
  cuenta_no_encontrada: 'Esa cuenta ya no existe.',
  solo_administrador: 'Tu cuenta no administra cuentas.'
};

/** Pedido a /api/cuentas[/<ruta>]. Un error trae el mensaje para mostrar. */
export async function pedirCuentas(ruta = '', { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE_URL}/api/cuentas${ruta ? `/${ruta}` : ''}`, {
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
    throw new Error(ERRORES[data?.error] || 'No se pudo completar. Probá de nuevo.');
  }
  return data;
}

/**
 * Si la cuenta es administrador general: null mientras se pregunta, despues
 * true o false. Si el pedido falla queda en false, y la app sigue como una
 * cuenta de balneario comun. La API vuelve a leer el permiso en cada pedido.
 */
export function useAccesoCuentas(activo) {
  const [administra, setAdministra] = useState(null);

  useEffect(() => {
    if (!activo) {
      setAdministra(null);
      return undefined;
    }
    let vigente = true;
    pedirCuentas('acceso')
      .then((d) => vigente && setAdministra(d?.administra === true))
      .catch(() => vigente && setAdministra(false));
    return () => {
      vigente = false;
    };
  }, [activo]);

  return administra;
}
