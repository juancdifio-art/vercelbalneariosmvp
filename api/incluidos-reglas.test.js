import { describe, it, expect } from 'vitest';
import reglas from './_incluidos/reglas.js';

const {
  edadDe, esMenor, personaCompleta, contarPorEdad, pasesIncluidos, maxPersonas,
  validarTope, normalizarPedido, hayIncluidos, validarEdicionIncluido
} = reglas;

const HOY = new Date(2026, 8, 26);
const EST = { id: 1, has_pileta: true, has_parking: true };

describe('edadDe', () => {
  it('calcula la edad desde la fecha de nacimiento', () => {
    expect(edadDe({ birthDate: '2010-09-27' }, HOY)).toBe(15);
    expect(edadDe({ birthDate: '2010-09-26' }, HOY)).toBe(16);
  });

  it('sin fecha usa la edad cargada a mano', () => {
    expect(edadDe({ age: '40' }, HOY)).toBe(40);
  });

  it('sin ninguno de los dos no hay edad', () => {
    expect(edadDe({ age: '' }, HOY)).toBeNull();
  });
});

describe('esMenor', () => {
  it('menor es menos de 18', () => {
    expect(esMenor(17)).toBe(true);
    expect(esMenor(18)).toBe(false);
    expect(esMenor(null)).toBe(false);
  });
});

describe('personaCompleta', () => {
  it('pide nombre, DNI y edad', () => {
    expect(personaCompleta({ fullName: 'Ana', documentNumber: '30111222', age: 30 })).toBe(true);
    expect(personaCompleta({ fullName: 'Ana', documentNumber: ' ', age: 30 })).toBe(false);
    expect(personaCompleta({ fullName: 'Ana', documentNumber: '30111222' })).toBe(false);
  });
});

describe('contarPorEdad', () => {
  it('separa adultos y menores; sin edad cuenta como adulto', () => {
    expect(contarPorEdad([{ age: 40 }, { age: 10 }, {}], HOY)).toEqual({ adults: 2, children: 1 });
  });
});

describe('ajustes del establecimiento', () => {
  it('por defecto la carpa da 4 pases y la sombrilla ninguno', () => {
    expect(pasesIncluidos({}, 'carpa')).toBe(4);
    expect(pasesIncluidos({}, 'sombrilla')).toBe(0);
    expect(pasesIncluidos({ pases_pileta_por_sombrilla: 2 }, 'sombrilla')).toBe(2);
  });

  it('el tope de personas es 6 salvo que se configure otro', () => {
    expect(maxPersonas({})).toBe(6);
    expect(maxPersonas({ max_personas_por_unidad: 8 })).toBe(8);
  });

  it('validarTope rechaza mas personas que el tope', () => {
    expect(validarTope({}, 4, 2)).toBeNull();
    expect(validarTope({}, 5, 2)).toBe('too_many_people');
  });
});

describe('normalizarPedido', () => {
  it('sin incluidos devuelve un pedido vacio', () => {
    const p = normalizarPedido(undefined, EST, 'carpa');
    expect(p).toEqual({ pileta: false, cocheras: [] });
    expect(hayIncluidos(p)).toBe(false);
  });

  it('normaliza patente, plaza y precio de cada cochera', () => {
    const p = normalizarPedido({
      pileta: true,
      cocheras: [
        { plaza: '45', vehiclePlate: 'ab 123-cd', precio: { cobrado: 700000, motivoAjuste: null } },
        { plaza: '', vehiclePlate: 'AC456EF' }
      ]
    }, EST, 'carpa');

    expect(p).toEqual({
      pileta: true,
      cocheras: [
        { plaza: 45, vehiclePlate: 'AB123CD', totalPrice: 700000, motivoAjuste: null },
        { plaza: null, vehiclePlate: 'AC456EF', totalPrice: null, motivoAjuste: null }
      ]
    });
    expect(hayIncluidos(p)).toBe(true);
  });

  it('una cochera sin patente es vehicle_plate_required', () => {
    expect(normalizarPedido({ cocheras: [{ plaza: 1 }] }, EST, 'carpa')).toEqual({ error: 'vehicle_plate_required' });
  });

  it('la misma plaza dos veces es plaza_repetida', () => {
    const pedido = { cocheras: [{ plaza: 3, vehiclePlate: 'A' }, { plaza: 3, vehiclePlate: 'B' }] };
    expect(normalizarPedido(pedido, EST, 'carpa')).toEqual({ error: 'plaza_repetida' });
  });

  it('pileta en una sombrilla que no da pases es pileta_no_incluible', () => {
    expect(normalizarPedido({ pileta: true }, EST, 'sombrilla')).toEqual({ error: 'pileta_no_incluible' });
  });

  it('pileta sin pileta en el establecimiento es pileta_no_incluible', () => {
    expect(normalizarPedido({ pileta: true }, { has_parking: true }, 'carpa')).toEqual({ error: 'pileta_no_incluible' });
  });

  it('cochera sin estacionamiento es parking_no_incluible', () => {
    expect(normalizarPedido({ cocheras: [{ vehiclePlate: 'A' }] }, { has_pileta: true }, 'carpa')).toEqual({ error: 'parking_no_incluible' });
  });

  it('solo carpas y sombrillas incluyen servicios', () => {
    expect(normalizarPedido({ pileta: true }, EST, 'parking')).toEqual({ error: 'incluidos_invalidos' });
  });
});

describe('validarEdicionIncluido', () => {
  const cochera = { vinculo: 'incluido', service_type: 'parking', start_date: new Date(2026, 0, 10), end_date: new Date(2026, 0, 20), client_id: 3 };

  it('una reserva que no es incluida se edita libre', () => {
    expect(validarEdicionIncluido({ vinculo: null, service_type: 'parking' }, { startDate: '2026-02-01' })).toBeNull();
    expect(validarEdicionIncluido({ vinculo: 'adicional', service_type: 'pileta' }, { adultsCount: 3 })).toBeNull();
  });

  it('el pase incluido no se edita', () => {
    expect(validarEdicionIncluido({ vinculo: 'incluido', service_type: 'pileta' }, { notes: 'x' })).toBe('servicio_incluido_no_editable');
  });

  it('la cochera incluida acepta plaza y patente', () => {
    expect(validarEdicionIncluido(cochera, { resourceNumber: 50, vehiclePlate: 'AB123CD' })).toBeNull();
  });

  it('la cochera incluida acepta las mismas fechas que ya tiene', () => {
    expect(validarEdicionIncluido(cochera, { startDate: '2026-01-10', endDate: '2026-01-20' })).toBeNull();
  });

  it('mandar el mismo estado y el mismo cliente no cuenta como cambio', () => {
    expect(validarEdicionIncluido({ ...cochera, status: 'active' }, { status: 'active', clientId: 3 })).toBeNull();
  });

  it('la cochera incluida rechaza fechas nuevas, estado y otro cliente', () => {
    expect(validarEdicionIncluido(cochera, { endDate: '2026-01-25' })).toBe('servicio_incluido_no_editable');
    expect(validarEdicionIncluido(cochera, { status: 'cancelled' })).toBe('servicio_incluido_no_editable');
    expect(validarEdicionIncluido(cochera, { clientId: 9 })).toBe('servicio_incluido_no_editable');
  });
});

describe('normalizarPersonas', () => {
  const { normalizarPersonas } = reglas;

  it('sin personas ni titular no hay nada que cargar', () => {
    expect(normalizarPersonas(undefined, undefined)).toBeNull();
  });

  it('descarta filas sin nombre y limpia los datos', () => {
    const r = normalizarPersonas([
      { fullName: ' Ana ', documentNumber: ' 1 ', age: '40', pileta: true },
      { fullName: '  ', documentNumber: '2' },
      { fullName: 'Beto', age: '' }
    ], { documentNumber: '30111222', birthDate: '1990-05-01', pileta: true });
    expect(r).toEqual({
      personas: [
        { fullName: 'Ana', documentNumber: '1', age: 40, birthDate: null, pileta: true },
        { fullName: 'Beto', documentNumber: null, age: null, birthDate: null, pileta: false }
      ],
      titular: { documentNumber: '30111222', birthDate: '1990-05-01', pileta: true }
    });
  });

  it('un titular sin datos no pide pase', () => {
    expect(normalizarPersonas([], { documentNumber: '', birthDate: '' }).titular)
      .toEqual({ documentNumber: null, birthDate: null, pileta: false });
  });
});
