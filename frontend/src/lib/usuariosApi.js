// Pedidos del personal del balneario (/api/usuarios) y cómo se nombra cada rol.
import { getApiBaseUrl } from '../apiConfig';

/** Cómo se ve cada rol en pantalla. */
export const ETIQUETA_ROL = {
  admin: 'Dueño',
  operador: 'Empleado',
  pileta: 'Pileta',
  soporte: 'Soporte'
};

/** Qué puede hacer cada rol del personal, para elegirlo con conocimiento. */
export const AYUDA_ROL = {
  operador: 'Reservas, clientes, cobros y reportes. No cambia tarifas, contrato ni usuarios.',
  pileta: 'Solo ve los pases de pileta y quién va en cada uno, para controlar la entrada. No ve cobros ni clientes.'
};

const ERRORES = {
  email_requerido: 'Escribí el email del usuario.',
  email_invalido: 'El email no es válido.',
  email_taken: 'Ya hay una cuenta con ese email.',
  rol_invalido: 'Elegí si es empleado o de pileta.',
  demasiados_usuarios: 'Llegaste al máximo de usuarios del balneario.',
  es_el_encargado: 'Al dueño no se lo cambia desde acá.',
  usuario_no_encontrado: 'Ese usuario ya no existe.',
  sin_permiso: 'Solo el dueño administra los usuarios.'
};

export async function pedirUsuarios(ruta = '', { method = 'GET', body } = {}) {
  const res = await fetch(`${getApiBaseUrl()}/api/usuarios${ruta ? `/${ruta}` : ''}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('authToken')}` },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(ERRORES[data?.error] || 'No se pudo completar. Probá de nuevo.');
  return data;
}
