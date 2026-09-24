/**
 * Sesion vencida.
 *
 * El token dura una hora y no se renueva. Antes, al vencer, cada pedido a la
 * API volvia 401 y la pantalla quedaba cargada pero vacia, con errores en la
 * consola, hasta que el encargado recargaba. Ahora cualquier 401 por token
 * invalido avisa con un evento y useAuth cierra la sesion con un mensaje.
 *
 * Solo cuentan invalid_token y missing_token: otros 401 (contrasena actual
 * incorrecta, credenciales de login) son errores del formulario, no de sesion.
 */

export const EVENTO_SESION_VENCIDA = 'sesion-vencida';

const ERRORES_DE_SESION = new Set(['invalid_token', 'missing_token']);

export function envolverFetch(fetchOriginal) {
  return async (...args) => {
    const res = await fetchOriginal(...args);
    if (res.status === 401) {
      try {
        // Se lee una copia: el que hizo el pedido sigue pudiendo leer el cuerpo.
        const data = await res.clone().json();
        if (data && ERRORES_DE_SESION.has(data.error)) {
          window.dispatchEvent(new Event(EVENTO_SESION_VENCIDA));
        }
      } catch (err) {
        // 401 sin JSON: no es de la API, se ignora.
      }
    }
    return res;
  };
}

/** Instala el detector sobre window.fetch una sola vez. */
export function instalarDetectorDeSesion() {
  if (typeof window === 'undefined' || window.__detectorDeSesion) return;
  window.fetch = envolverFetch(window.fetch.bind(window));
  window.__detectorDeSesion = true;
}

/** Momento de vencimiento del token (ms desde epoch), o null si no se puede leer. */
export function expiracionDelToken(token) {
  try {
    const payload = String(token).split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch (err) {
    return null;
  }
}
