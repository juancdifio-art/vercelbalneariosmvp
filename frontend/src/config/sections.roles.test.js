import { describe, it, expect } from 'vitest';
import { seccionesDelRol, seccionPermitida, usaSoporte } from './sections';

const TODAS = ['inicio', 'vista-diaria', 'reservas', 'carpas', 'pileta', 'clientes', 'reportes', 'tarifas', 'panel-usuario'].map((id) => ({ id }));
const ids = (items) => items.map((i) => i.id);

describe('secciones por rol', () => {
  it('el encargado ve todas', () => {
    expect(ids(seccionesDelRol(TODAS, 'admin'))).toEqual(ids(TODAS));
  });

  it('un empleado ve todas menos Tarifas', () => {
    expect(ids(seccionesDelRol(TODAS, 'operador'))).not.toContain('tarifas');
    expect(ids(seccionesDelRol(TODAS, 'operador'))).toContain('reportes');
  });

  it('pileta ve solo la pileta y su perfil', () => {
    expect(ids(seccionesDelRol(TODAS, 'pileta'))).toEqual(['pileta', 'panel-usuario']);
  });

  it('si el rol no ve la seccion abierta, va a una que ve', () => {
    expect(seccionPermitida('inicio', 'pileta')).toBe('pileta');
    expect(seccionPermitida('panel-usuario', 'pileta')).toBe('panel-usuario');
    expect(seccionPermitida('tarifas', 'operador')).toBe('inicio');
    expect(seccionPermitida('tarifas', 'admin')).toBe('tarifas');
  });

  it('el chat de soporte es de la administracion', () => {
    expect(usaSoporte('admin')).toBe(true);
    expect(usaSoporte('operador')).toBe(false);
    expect(usaSoporte('pileta')).toBe(false);
  });

  it('sin rol conocido no oculta nada', () => {
    expect(seccionesDelRol(TODAS, '')).toHaveLength(TODAS.length);
  });
});
