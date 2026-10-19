import { describe, it, expect } from 'vitest';
import { etiquetaMetodo, fechaCorta, nombreUnidad } from './formato';

describe('formato para mostrar', () => {
  it('traduce el medio de pago', () => {
    expect(etiquetaMetodo('cash')).toBe('Efectivo');
    expect(etiquetaMetodo('transfer')).toBe('Transferencia');
    expect(etiquetaMetodo('card')).toBe('Tarjeta');
    expect(etiquetaMetodo('other')).toBe('Otro');
    expect(etiquetaMetodo('')).toBe('Sin medio de pago');
    expect(etiquetaMetodo('mercadopago')).toBe('mercadopago');
  });

  it('muestra la fecha como dia/mes/año', () => {
    expect(fechaCorta('2026-10-06')).toBe('06/10/2026');
    expect(fechaCorta('2026-10-06T23:59:56.363Z')).toBe('06/10/2026');
    expect(fechaCorta('')).toBe('');
    expect(fechaCorta('ayer')).toBe('ayer');
  });

  it('nombra la unidad en castellano', () => {
    expect(nombreUnidad('carpa', 22)).toBe('Carpa 22');
    expect(nombreUnidad('parking', 1)).toBe('Estacionamiento, plaza 1');
    expect(nombreUnidad('pileta', 1)).toBe('Pileta');
    expect(nombreUnidad('sombrilla', 3)).toBe('Sombrilla 3');
  });
});
