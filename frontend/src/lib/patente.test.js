import { describe, it, expect } from 'vitest';
import { normalizarPatente, formatearPatente } from './patente';

describe('normalizarPatente', () => {
  it('pasa a mayusculas y saca espacios, guiones y puntos', () => {
    expect(normalizarPatente(' ab 123-cd ')).toBe('AB123CD');
    expect(normalizarPatente('abc.123')).toBe('ABC123');
    expect(normalizarPatente(null)).toBe('');
  });
});

describe('formatearPatente', () => {
  it('muestra los formatos argentinos con espacios', () => {
    expect(formatearPatente('AB123CD')).toBe('AB 123 CD');
    expect(formatearPatente('ABC123')).toBe('ABC 123');
    expect(formatearPatente('ab 123 cd')).toBe('AB 123 CD');
  });

  it('una patente de otro formato queda como vino, normalizada', () => {
    expect(formatearPatente('FX1234')).toBe('FX1234');
    expect(formatearPatente('')).toBe('');
  });
});
