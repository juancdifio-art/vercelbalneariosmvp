import { describe, it, expect } from 'vitest';
import { numerosDeUnidades, capacidadDelPlano } from './unidades';
import { NUMEROS_CARPAS, NUMEROS_SOMBRILLAS } from '../config/planoZeus';

const est = { carpasCapacity: '5', sombrillasCapacity: '3', parkingCapacity: '4' };

describe('plano de Zeus', () => {
  it('tiene 117 carpas numeradas del 1 al 134, sin repetidas', () => {
    expect(NUMEROS_CARPAS).toHaveLength(117);
    expect(new Set(NUMEROS_CARPAS).size).toBe(117);
    expect(Math.max(...NUMEROS_CARPAS)).toBe(134);
    [4, 11, 26, 27, 77, 83].forEach((n) => expect(NUMEROS_CARPAS).not.toContain(n));
  });

  it('tiene las sombrillas 1 a 220 completas', () => {
    expect([...NUMEROS_SOMBRILLAS].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 220 }, (_, i) => i + 1)
    );
  });
});

describe('numerosDeUnidades', () => {
  it('con plano, carpas y sombrillas salen del plano y no de la capacidad', () => {
    expect(numerosDeUnidades(est, 'carpa', true)).toEqual(NUMEROS_CARPAS);
    expect(numerosDeUnidades(est, 'sombrilla', true)).toEqual(NUMEROS_SOMBRILLAS);
  });

  it('el estacionamiento sigue siendo 1..capacidad aunque haya plano', () => {
    expect(numerosDeUnidades(est, 'parking', true)).toEqual([1, 2, 3, 4]);
  });

  it('sin plano, es 1..capacidad', () => {
    expect(numerosDeUnidades(est, 'carpa', false)).toEqual([1, 2, 3, 4, 5]);
    expect(numerosDeUnidades(est, 'sombrilla', false)).toEqual([1, 2, 3]);
  });

  it('sin establecimiento o sin capacidad devuelve lista vacia', () => {
    expect(numerosDeUnidades(null, 'parking', true)).toEqual([]);
    expect(numerosDeUnidades({ carpasCapacity: '' }, 'carpa', false)).toEqual([]);
  });
});

describe('capacidadDelPlano', () => {
  it('da la cantidad relevada para carpas y sombrillas', () => {
    expect(capacidadDelPlano('carpa', true)).toBe(117);
    expect(capacidadDelPlano('sombrilla', true)).toBe(220);
    expect(capacidadDelPlano('parking', true)).toBeNull();
    expect(capacidadDelPlano('carpa', false)).toBeNull();
  });
});
