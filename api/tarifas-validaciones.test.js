import { describe, it, expect } from 'vitest';
import validaciones from './_tarifas/validaciones.js';

const { validarPeriodo, periodosSeSuperponen, validarSector, validarTarifa, conflictoTarifa } = validaciones;

const P = (mi, di, mf, df, extra = {}) => ({ nombre: 'X', mesInicio: mi, diaInicio: di, mesFin: mf, diaFin: df, prioridad: 1, ...extra });
const T = (extra = {}) => ({
  id: null, serviceType: 'carpa', alcance: 'tipo', sectorId: null, resourceNumber: null,
  clase: 'fecha', periodoId: 1, nombre: null, diasMin: null, diasMax: null, modo: null, precio: 10000, ...extra
});
const EST = (diasMin, diasMax, extra = {}) => T({ clase: 'estadia', periodoId: null, diasMin, diasMax, modo: 'cerrado', ...extra });

describe('validarPeriodo', () => {
  it('acepta uno bien cargado, incluido el 29/02', () => {
    expect(validarPeriodo(P(12, 15, 3, 15))).toBeNull();
    expect(validarPeriodo(P(2, 29, 2, 29))).toBeNull();
  });
  it('rechaza nombre vacio, dias que no existen y prioridad no entera', () => {
    expect(validarPeriodo(P(1, 1, 1, 2, { nombre: '  ' }))).toBe('nombre_requerido');
    expect(validarPeriodo(P(4, 31, 5, 1))).toBe('fecha_invalida');
    expect(validarPeriodo(P(13, 1, 1, 1))).toBe('fecha_invalida');
    expect(validarPeriodo(P(1, 1, 1, 2, { prioridad: 1.5 }))).toBe('prioridad_invalida');
  });
  it('rechaza un nombre de mas de 100 caracteres', () => {
    expect(validarPeriodo(P(1, 1, 1, 2, { nombre: 'x'.repeat(101) }))).toBe('nombre_largo');
    expect(validarPeriodo(P(1, 1, 1, 2, { nombre: 'x'.repeat(100) }))).toBeNull();
  });
});

describe('periodosSeSuperponen', () => {
  it('detecta superposicion tambien cruzando el fin de anio', () => {
    expect(periodosSeSuperponen(P(12, 15, 3, 15), P(12, 24, 12, 26))).toBe(true);
    expect(periodosSeSuperponen(P(12, 15, 3, 15), P(3, 16, 12, 14))).toBe(false);
    expect(periodosSeSuperponen(P(12, 1, 1, 31), P(1, 15, 2, 1))).toBe(true);
  });
});

describe('validarSector', () => {
  it('pide servicio valido y nombre', () => {
    expect(validarSector({ serviceType: 'carpa', nombre: 'Terraza', unidades: [1] })).toBeNull();
    expect(validarSector({ serviceType: 'pileta', nombre: 'Terraza', unidades: [] })).toBe('servicio_invalido');
    expect(validarSector({ serviceType: 'carpa', nombre: '', unidades: [] })).toBe('nombre_requerido');
  });
  it('rechaza un nombre de mas de 100 caracteres', () => {
    expect(validarSector({ serviceType: 'carpa', nombre: 'x'.repeat(101), unidades: [] })).toBe('nombre_largo');
  });
  it('rechaza un color que no es hexadecimal de 6 digitos', () => {
    expect(validarSector({ serviceType: 'carpa', nombre: 'Terraza', color: 'rojo', unidades: [] })).toBe('color_invalido');
    expect(validarSector({ serviceType: 'carpa', nombre: 'Terraza', color: '#0EA5E9', unidades: [] })).toBeNull();
  });
});

describe('validarTarifa', () => {
  it('acepta tarifas coherentes', () => {
    expect(validarTarifa(T())).toBeNull();
    expect(validarTarifa(EST(90, null))).toBeNull();
    expect(validarTarifa(T({ alcance: 'sector', sectorId: 3 }))).toBeNull();
    expect(validarTarifa(T({ alcance: 'unidad', resourceNumber: 58 }))).toBeNull();
  });
  it('rechaza combinaciones incoherentes', () => {
    expect(validarTarifa(T({ serviceType: 'pileta' }))).toBe('servicio_invalido');
    expect(validarTarifa(T({ alcance: 'sector' }))).toBe('alcance_invalido');
    expect(validarTarifa(T({ alcance: 'tipo', resourceNumber: 3 }))).toBe('alcance_invalido');
    expect(validarTarifa(T({ periodoId: null }))).toBe('tarifa_invalida');
    expect(validarTarifa(T({ modo: 'cerrado' }))).toBe('tarifa_invalida');
    expect(validarTarifa(EST(90, null, { modo: null }))).toBe('tarifa_invalida');
    expect(validarTarifa(EST(90, 45))).toBe('tarifa_invalida');
    expect(validarTarifa(EST(0, null))).toBe('tarifa_invalida');
    expect(validarTarifa(T({ precio: -1 }))).toBe('precio_invalido');
    expect(validarTarifa(T({ precio: null }))).toBe('precio_invalido');
  });
  it('rechaza un nombre de mas de 100 caracteres', () => {
    expect(validarTarifa(T({ nombre: 'x'.repeat(101) }))).toBe('nombre_largo');
    expect(validarTarifa(T({ nombre: 'x'.repeat(100) }))).toBeNull();
  });
  it('en una tarifa por estadia, el periodoId si viene no puede ser fraccionario', () => {
    expect(validarTarifa(EST(90, null, { periodoId: 1.5 }))).toBe('tarifa_invalida');
    expect(validarTarifa(EST(90, null, { periodoId: 1 }))).toBeNull();
  });
});

describe('conflictoTarifa', () => {
  it('no deja dos precios por fecha para el mismo alcance y periodo', () => {
    expect(conflictoTarifa(T(), [T({ id: 5 })])).toBe('tarifa_duplicada');
    expect(conflictoTarifa(T(), [T({ id: 5, periodoId: 2 })])).toBeNull();
    expect(conflictoTarifa(T(), [T({ id: 5, alcance: 'sector', sectorId: 3 })])).toBeNull();
  });
  it('no deja rangos de estadia solapados en el mismo alcance y periodo', () => {
    expect(conflictoTarifa(EST(45, 90), [EST(90, null, { id: 5 })])).toBe('rango_superpuesto');
    expect(conflictoTarifa(EST(45, 89), [EST(90, null, { id: 5 })])).toBeNull();
    expect(conflictoTarifa(EST(90, null), [EST(90, null, { id: 5, periodoId: 1 })])).toBeNull();
  });
  it('ignora la propia tarifa al editar', () => {
    expect(conflictoTarifa(T({ id: 5 }), [T({ id: 5 })])).toBeNull();
  });
});
