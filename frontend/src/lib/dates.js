/**
 * Punto unico de formateo de fechas del frontend.
 *
 * date-fns formatea en ingles si no se le pasa un locale, y la app es en
 * castellano. Importar `format` desde aca en vez de desde 'date-fns'
 * directamente garantiza que ninguna pantalla se escape al ingles.
 */
import { format as dateFnsFormat } from 'date-fns';
import { es } from 'date-fns/locale';

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Domingo primero, para indexar directo con Date.getDay().
const WEEKDAY_INITIALS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

/**
 * Normaliza a Date. Los strings 'YYYY-MM-DD' se interpretan en hora local:
 * new Date('2026-09-10') los toma como UTC y en Argentina (UTC-3) caeria
 * en el dia anterior.
 */
export function toDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && ISO_DATE_ONLY.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }
  return null;
}

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

/** Igual que date-fns/format pero siempre en castellano. */
export function format(value, pattern, options = {}) {
  const date = toDate(value);
  if (!isValidDate(date)) return '';
  return dateFnsFormat(date, pattern, { locale: es, ...options });
}

/**
 * Inicial del dia de la semana para las cabeceras de las grillas: L M M J V S D.
 * No se deriva de format(date, 'EEE')[0] porque en castellano eso da
 * minuscula y 'mie'/'mar' colisionan igual: la tabla explicita es la
 * convencion que se usa en los calendarios locales.
 */
export function weekdayInitial(value) {
  const date = toDate(value);
  if (!isValidDate(date)) return '';
  return WEEKDAY_INITIALS[date.getDay()];
}
