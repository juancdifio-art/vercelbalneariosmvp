import { describe, it, expect } from 'vitest';
import { numerosDeUnidades, capacidadDelPlano } from './unidades';
import { NUMEROS_CARPAS, NUMEROS_SOMBRILLAS } from '../config/planoZeus';

const est = { carpasCapacity: '5', sombrillasCapacity: '3', parkingCapacity: '4' };
const conZeus = { ...est, plano: 'zeus' };

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
  it('con plano, carpas y sombrillas salen del plano del establecimiento y no de la capacidad', () => {
    expect(numerosDeUnidades(conZeus, 'carpa')).toEqual(NUMEROS_CARPAS);
    expect(numerosDeUnidades(conZeus, 'sombrilla')).toEqual(NUMEROS_SOMBRILLAS);
  });

  it('una clave de plano que no existe es como no tener plano', () => {
    expect(numerosDeUnidades({ ...est, plano: 'otro' }, 'carpa')).toEqual([1, 2, 3, 4, 5]);
  });

  it('el estacionamiento sigue siendo 1..capacidad aunque haya plano', () => {
    expect(numerosDeUnidades(conZeus, 'parking')).toEqual([1, 2, 3, 4]);
  });

  it('sin plano, es 1..capacidad', () => {
    expect(numerosDeUnidades(est, 'carpa')).toEqual([1, 2, 3, 4, 5]);
    expect(numerosDeUnidades(est, 'sombrilla')).toEqual([1, 2, 3]);
  });

  it('sin establecimiento o sin capacidad devuelve lista vacia', () => {
    expect(numerosDeUnidades(null, 'parking')).toEqual([]);
    expect(numerosDeUnidades({ carpasCapacity: '' }, 'carpa')).toEqual([]);
  });
});

describe('capacidadDelPlano', () => {
  it('da la cantidad relevada para carpas y sombrillas', () => {
    expect(capacidadDelPlano(conZeus, 'carpa')).toBe(117);
    expect(capacidadDelPlano(conZeus, 'sombrilla')).toBe(220);
    expect(capacidadDelPlano(conZeus, 'parking')).toBeNull();
    expect(capacidadDelPlano(est, 'carpa')).toBeNull();
  });
});
