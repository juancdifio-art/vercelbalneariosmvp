import { describe, it, expect } from 'vitest';
import { format, weekdayInitial } from './dates';

// 2026-09-10 es jueves; la semana del 6 al 12 cubre los 7 dias.
const SUNDAY = new Date(2026, 8, 6);
const MONDAY = new Date(2026, 8, 7);
const TUESDAY = new Date(2026, 8, 8);
const WEDNESDAY = new Date(2026, 8, 9);
const THURSDAY = new Date(2026, 8, 10);
const FRIDAY = new Date(2026, 8, 11);
const SATURDAY = new Date(2026, 8, 12);

describe('weekdayInitial', () => {
  it('devuelve las iniciales en castellano L M M J V S D', () => {
    expect(weekdayInitial(MONDAY)).toBe('L');
    expect(weekdayInitial(TUESDAY)).toBe('M');
    expect(weekdayInitial(WEDNESDAY)).toBe('M');
    expect(weekdayInitial(THURSDAY)).toBe('J');
    expect(weekdayInitial(FRIDAY)).toBe('V');
    expect(weekdayInitial(SATURDAY)).toBe('S');
    expect(weekdayInitial(SUNDAY)).toBe('D');
  });

  it('nunca devuelve iniciales en ingles', () => {
    const week = [SUNDAY, MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY];
    const initials = week.map(weekdayInitial);
    expect(initials).toEqual(['D', 'L', 'M', 'M', 'J', 'V', 'S']);
    // 'W' (Wednesday) y 'T' (Tuesday/Thursday) son marcadores del bug en ingles
    expect(initials).not.toContain('W');
  });

  it('acepta un string ISO ademas de un Date', () => {
    expect(weekdayInitial('2026-09-10')).toBe('J');
  });

  it('devuelve string vacio ante una fecha invalida', () => {
    expect(weekdayInitial(null)).toBe('');
    expect(weekdayInitial('no-es-fecha')).toBe('');
  });
});

describe('format', () => {
  it('mantiene el formato numerico dd/MM/yyyy', () => {
    expect(format(THURSDAY, 'dd/MM/yyyy')).toBe('10/09/2026');
  });

  it('escribe el dia de la semana en castellano', () => {
    expect(format(THURSDAY, 'EEEE')).toBe('jueves');
  });

  it('escribe el mes en castellano', () => {
    expect(format(THURSDAY, 'MMMM')).toBe('septiembre');
  });
});
