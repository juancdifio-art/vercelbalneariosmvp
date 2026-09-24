import { getApiBaseUrl } from '../apiConfig';

const MENSAJES = {
  periodo_superpuesto: 'Ya hay un período con la misma prioridad en esas fechas. Subile la prioridad al más específico.',
  tarifa_duplicada: 'Ya hay un precio para ese período en esa fila.',
  rango_superpuesto: 'Ese rango de días se pisa con otra tarifa por estadía del mismo alcance.',
  unidad_en_otro_sector: 'Alguna de las unidades ya está en otro sector.',
  sector_duplicado: 'Ya hay un sector con ese nombre.',
  nombre_requerido: 'Poné un nombre.',
  fecha_invalida: 'Esa fecha no existe.',
  tarifa_invalida: 'Revisá los datos de la tarifa.',
  alcance_invalido: 'Elegí a qué unidades aplica.',
  precio_invalido: 'El precio tiene que ser un número mayor o igual a cero.',
  sector_invalido: 'Ese sector no existe.',
  periodo_invalido: 'Ese período no existe.'
};

export function mensajeError(error) {
  return MENSAJES[error?.codigo] || 'No se pudo guardar. Probá de nuevo.';
}

export async function pedirTarifas(ruta, { method = 'GET', body } = {}) {
  const token = sessionStorage.getItem('authToken');
  const res = await fetch(`${getApiBaseUrl()}/api/${ruta}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || `status_${res.status}`);
    error.codigo = data.error;
    throw error;
  }
  return data;
}
