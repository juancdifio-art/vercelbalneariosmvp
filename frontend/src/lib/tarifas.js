/**
 * Helpers de UI para tarifas. El calculo real lo hace el servidor
 * (api/_tarifas); aca solo se muestra y se valida lo que carga el encargado.
 */

export const PRECIO_VACIO = { precioTarifa: null, desglose: null, cobrado: '', motivo: '', editadoEn: null };

export function aNumero(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(String(valor).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function formatearPesos(n) {
  return `$${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
}

const dias = (n) => `${n} ${n === 1 ? 'día' : 'días'}`;

export function lineasDesglose(desglose) {
  if (!desglose) return [];
  if (desglose.clase === 'estadia') {
    const nombre = desglose.nombre || 'Estadía';
    return desglose.modo === 'cerrado'
      ? [`${nombre} (precio cerrado, ${dias(desglose.dias)}) = ${formatearPesos(desglose.total)}`]
      : [`${nombre}: ${dias(desglose.dias)} × ${formatearPesos(desglose.precio)} = ${formatearPesos(desglose.total)}`];
  }
  return (desglose.tramos || []).map(
    (t) => `${dias(t.dias)} ${t.periodo} × ${formatearPesos(t.precioDia)} = ${formatearPesos(t.subtotal)}`
  );
}

export function diferenciaAjuste({ precioTarifa, cobrado }) {
  const t = aNumero(precioTarifa);
  const c = aNumero(cobrado);
  if (t === null || c === null) return 0;
  return Math.round((c - t) * 100) / 100;
}

export function faltaMotivoAjuste(valor) {
  return diferenciaAjuste(valor) !== 0 && !String(valor.motivo ?? '').trim();
}

/**
 * Arma el `tempPrecio` inicial al abrir la edición de una reserva ya guardada.
 * `totalPrice` llega como string ("9999.50"); si se redondeaba a entero acá,
 * una tarifa con centavos abría con un ajuste falso (motivo obligatorio) y
 * guardar de nuevo recortaba el total.
 */
export function precioDesdeReserva(group) {
  return {
    precioTarifa: group.precioTarifa != null ? Number(group.precioTarifa) : null,
    desglose: group.desglose ?? null,
    cobrado: group.totalPrice != null && group.totalPrice !== '' ? String(Number(group.totalPrice)) : '',
    motivo: group.motivoAjuste ?? '',
    editadoEn: null
  };
}

const DIAS_POR_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function parseDiaMes(texto) {
  const m = /^\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*$/.exec(String(texto ?? ''));
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > DIAS_POR_MES[mes - 1]) return null;
  return { dia, mes };
}

export function formatearDiaMes(mes, dia) {
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
}

export function filaCoincide(tarifa, fila) {
  if (tarifa.alcance !== fila.alcance) return false;
  if (fila.alcance === 'sector') return tarifa.sectorId === fila.sectorId;
  if (fila.alcance === 'unidad') return tarifa.resourceNumber === fila.resourceNumber;
  return true;
}

/** Colores de sectores y periodos: el fuerte marca, el suave es el fondo. */
export const PALETA = [
  { fuerte: '#0EA5E9', suave: '#BAE6FD' },
  { fuerte: '#F97316', suave: '#FED7AA' },
  { fuerte: '#8B5CF6', suave: '#DDD6FE' },
  { fuerte: '#10B981', suave: '#A7F3D0' },
  { fuerte: '#EF4444', suave: '#FECACA' },
  { fuerte: '#EAB308', suave: '#FEF08A' }
];

export function colorSuave(hex) {
  return PALETA.find((c) => c.fuerte.toLowerCase() === String(hex).toLowerCase())?.suave ?? '#E2E8F0';
}
