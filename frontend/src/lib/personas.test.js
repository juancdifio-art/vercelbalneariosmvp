import { describe, it, expect } from 'vitest';
import { edadDe, avisoCantidad } from './personas';

const HOY = new Date(2026, 8, 22); // 22 de septiembre de 2026

describe('edadDe', () => {
  it('calcula la edad de la fecha de nacimiento', () => {
    expect(edadDe({ birthDate: '2018-03-04' }, HOY)).toBe(8);
  });

  it('todavia no cumplio anios este anio', () => {
    expect(edadDe({ birthDate: '2018-12-31' }, HOY)).toBe(7);
  });

  it('cumple anios justo hoy', () => {
    expect(edadDe({ birthDate: '2018-09-22' }, HOY)).toBe(8);
  });

  it('cumplio ayer', () => {
    expect(edadDe({ birthDate: '2018-09-21' }, HOY)).toBe(8);
  });

  it('cumple manana', () => {
    expect(edadDe({ birthDate: '2018-09-23' }, HOY)).toBe(7);
  });

  it('la fecha de nacimiento le gana a la edad escrita a mano', () => {
    expect(edadDe({ age: 30, birthDate: '2018-03-04' }, HOY)).toBe(8);
  });

  it('sin fecha, vale la edad escrita a mano', () => {
    expect(edadDe({ age: 34 }, HOY)).toBe(34);
  });

  it('acepta la edad como texto', () => {
    expect(edadDe({ age: '34' }, HOY)).toBe(34);
  });

  it('sin ningun dato devuelve null', () => {
    expect(edadDe({}, HOY)).toBeNull();
    expect(edadDe({ age: '', birthDate: null }, HOY)).toBeNull();
    expect(edadDe(null, HOY)).toBeNull();
  });

  it('descarta una edad negativa', () => {
    expect(edadDe({ age: -3 }, HOY)).toBeNull();
  });

  it('ignora la hora que trae la fecha de la API', () => {
    expect(edadDe({ birthDate: '2018-03-04T00:00:00.000Z' }, HOY)).toBe(8);
  });
});

describe('avisoCantidad', () => {
  it('avisa cuando faltan personas por cargar', () => {
    expect(avisoCantidad(3, 3, [{ id: 1 }, { id: 2 }, { id: 3 }])).toBe('Cargaste 3 de 6 personas');
  });

  it('no avisa cuando estan todas', () => {
    expect(avisoCantidad(1, 1, [{ id: 1 }, { id: 2 }])).toBeNull();
  });

  it('no avisa si hay mas cargadas que declaradas', () => {
    expect(avisoCantidad(1, 0, [{ id: 1 }, { id: 2 }])).toBeNull();
  });

  it('no avisa si no se declaro ninguna cantidad', () => {
    expect(avisoCantidad(0, 0, [])).toBeNull();
    expect(avisoCantidad(null, undefined, [])).toBeNull();
  });

  it('avisa aunque no haya ninguna cargada', () => {
    expect(avisoCantidad(2, 0, [])).toBe('Cargaste 0 de 2 personas');
  });

  it('acepta las cantidades como texto', () => {
    expect(avisoCantidad('2', '2', [{ id: 1 }])).toBe('Cargaste 1 de 4 personas');
  });
});
