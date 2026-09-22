/**
 * Formato de moneda argentino: $9.937.874 o $126.000,00.
 *
 * Los modales de reserva tienen cada uno su propia copia de formatCurrency;
 * este es el lugar comun para lo que se escriba de aca en adelante.
 *
 * El dashboard usa 0 decimales porque muestra montos grandes y resumidos; los
 * comprobantes y los modales, donde importa el centavo, usan 2.
 */
export function formatPesos(valor, decimales = 2) {
  const n = Number.parseFloat(valor);
  const seguro = Number.isFinite(n) ? n : 0;
  return (
    '$' +
    seguro.toLocaleString('es-AR', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales
    })
  );
}
