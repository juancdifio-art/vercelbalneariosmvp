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

export function nombreUnidad(serviceType, numero) {
  if (serviceType === 'carpa') return `Carpa ${numero}`;
  if (serviceType === 'sombrilla') return `Sombrilla ${numero}`;
  if (serviceType === 'parking') return `Estacionamiento, plaza ${numero}`;
  if (serviceType === 'pileta') return 'Pileta';
  return `${serviceType || 'Servicio'} ${numero ?? ''}`.trim();
}
