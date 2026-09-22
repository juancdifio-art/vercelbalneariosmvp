import { describe, it, expect } from 'vitest';
import { formatPesos } from './money';

describe('formatPesos', () => {
  it('separa los miles con punto y los decimales con coma', () => {
    expect(formatPesos(126000)).toBe('$126.000,00');
  });

  it('sin decimales para los montos resumidos del dashboard', () => {
    expect(formatPesos(9937874, 0)).toBe('$9.937.874');
  });

  it('acepta el string que devuelve la API para los NUMERIC de Postgres', () => {
    expect(formatPesos('202500.00', 0)).toBe('$202.500');
  });

  it('muestra $0 ante un valor ausente o invalido, en vez de $NaN', () => {
    expect(formatPesos(undefined, 0)).toBe('$0');
    expect(formatPesos('abc', 0)).toBe('$0');
  });
});
