import { describe, it, expect } from 'vitest';
import { seccionesDelRol } from './sections';

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

  it('pileta ve la vista rapida, la pileta y su perfil', () => {
    expect(ids(seccionesDelRol(TODAS, 'pileta'))).toEqual(['vista-diaria', 'pileta', 'panel-usuario']);
  });

  it('sin rol conocido no oculta nada', () => {
    expect(seccionesDelRol(TODAS, '')).toHaveLength(TODAS.length);
  });
});
