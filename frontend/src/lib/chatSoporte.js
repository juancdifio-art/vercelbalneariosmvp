// Chat de soporte (Tawk.to): el balneario nos escribe desde la app para
// reportar errores, sugerencias o consultas, y respondemos desde el panel o la
// app de Tawk. El id ("propiedad/widget", el final de la URL del embed) sale de
// VITE_TAWK_ID; sin id no se carga nada, asi en desarrollo y en los tests no
// aparece la burbuja.

const ID_VALIDO = /^[a-z0-9]+\/[a-z0-9]+$/i;
const SCRIPT_ID = 'chat-soporte-tawk';

// Lo ultimo que quiere ver quien atiende. Si el widget todavia no cargo, se
// manda en su onLoad.
let datos = {};

/** El id si tiene la forma propiedad/widget; si no, null (y no se carga el chat). */
export function idDelChat(valor) {
  const id = String(valor ?? '').trim();
  return ID_VALIDO.test(id) ? id : null;
}

// Las funciones de Tawk_API recien existen cuando termino de cargar el script.
const listo = (api) => typeof api?.setAttributes === 'function';

function enviar(api) {
  // Tawk solo acepta textos en los atributos, y uno vacio no aporta nada.
  const limpios = Object.fromEntries(
    Object.entries(datos).filter(([, v]) => v).map(([k, v]) => [k, String(v)])
  );
  api.setAttributes(limpios, () => {});
}

/** Muestra el chat: la primera vez inyecta el script de Tawk. */
export function mostrarChat(id, nuevos, win = window) {
  const api = (win.Tawk_API = win.Tawk_API || {});
  datos = { ...datos, ...nuevos };
  if (win.document.getElementById(SCRIPT_ID)) {
    if (listo(api)) {
      api.showWidget();
      enviar(api);
    }
    return;
  }
  api.visitor = { name: datos.name, email: datos.email };
  api.onLoad = () => enviar(api);
  win.Tawk_LoadStart = new Date();
  const script = win.document.createElement('script');
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = `https://embed.tawk.to/${id}`;
  script.charset = 'UTF-8';
  script.setAttribute('crossorigin', '*');
  win.document.head.appendChild(script);
}

/** Actualiza lo que ve quien atiende (p. ej. la pantalla en la que esta el usuario). */
export function actualizarChat(nuevos, win = window) {
  datos = { ...datos, ...nuevos };
  if (listo(win.Tawk_API)) enviar(win.Tawk_API);
}

export function ocultarChat(win = window) {
  if (typeof win.Tawk_API?.hideWidget === 'function') win.Tawk_API.hideWidget();
}
