// Como se muestran al encargado los datos que la API guarda en crudo.

const METODOS = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  other: 'Otro'
};

export function etiquetaMetodo(metodo) {
  if (!metodo) return 'Sin medio de pago';
  return METODOS[metodo] || metodo;
}

// '2026-10-06' (o un timestamp ISO) → '06/10/2026'. Lo que no es fecha queda igual.
export function fechaCorta(valor) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(valor || '');
}

// Timestamp ISO → '19/10/2026 14:32', en hora local (no corta el texto: a la
// noche la fecha UTC ya es la del dia siguiente).
export function fechaHora(valor) {
  const d = new Date(valor);
  if (!valor || Number.isNaN(d.getTime())) return String(valor || '');
  const dos = (n) => String(n).padStart(2, '0');
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

export function nombreUnidad(serviceType, numero) {
  if (serviceType === 'carpa') return `Carpa ${numero}`;
  if (serviceType === 'sombrilla') return `Sombrilla ${numero}`;
  if (serviceType === 'parking') return `Estacionamiento, plaza ${numero}`;
  if (serviceType === 'pileta') return 'Pileta';
  return `${serviceType || 'Servicio'} ${numero ?? ''}`.trim();
}
