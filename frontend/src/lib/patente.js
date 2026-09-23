/**
 * Patente del vehiculo. Obligatoria en toda reserva de estacionamiento.
 *
 * Se guarda normalizada (AB123CD) para que buscar y comparar no dependa de
 * como la tipeo cada uno, y se muestra con espacios (AB 123 CD). El servidor
 * normaliza igual por su cuenta.
 */
export function normalizarPatente(valor) {
  return String(valor ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Mercosur: AB 123 CD. Vieja: ABC 123. Cualquier otra (extranjera, moto)
// se muestra tal cual.
export function formatearPatente(valor) {
  const p = normalizarPatente(valor);
  if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(p)) return `${p.slice(0, 2)} ${p.slice(2, 5)} ${p.slice(5)}`;
  if (/^[A-Z]{3}\d{3}$/.test(p)) return `${p.slice(0, 3)} ${p.slice(3)}`;
  return p;
}
