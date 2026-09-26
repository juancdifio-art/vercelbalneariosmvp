import { describe, it, expect } from 'vitest';
import {
  armarIncluidos,
  mensajeErrorIncluidos,
  personaCompletaParaPase,
  contarPorEdad,
  etiquetaVinculo,
  pasesIncluidosPara,
  maxPersonasPara,
  superaTope,
  cocheraVacia
} from './incluidos';

const HOY = new Date(2026, 8, 26);

describe('armarIncluidos', () => {
  it('sin pileta ni cocheras no manda nada', () => {
    expect(armarIncluidos({ incluyePileta: false, cocheras: [] })).toBeUndefined();
  });

  it('arma plaza, patente y precio de cada cochera, sin los datos del pago', () => {
    const cochera = { ...cocheraVacia(), plaza: '45', vehiclePlate: 'AB123CD', precio: { cobrado: '700000', motivo: 'amigo' }, pagoMonto: '1000', pagoMetodo: 'cash' };
    expect(armarIncluidos({ incluyePileta: true, cocheras: [cochera, { ...cocheraVacia(), vehiclePlate: 'AC456EF' }] })).toEqual({
      pileta: true,
      cocheras: [
        { plaza: 45, vehiclePlate: 'AB123CD', precio: { cobrado: '700000', motivoAjuste: 'amigo' } },
        { plaza: null, vehiclePlate: 'AC456EF', precio: { cobrado: '', motivoAjuste: '' } }
      ]
    });
  });
});

describe('mensajeErrorIncluidos', () => {
  it('usa el mensaje del servidor cuando dice que plaza choca', () => {
    expect(mensajeErrorIncluidos({ error: 'resource_conflict', message: 'La plaza 45 está ocupada en esas fechas.' }))
      .toBe('La plaza 45 está ocupada en esas fechas.');
  });

  it('traduce los errores conocidos', () => {
    expect(mensajeErrorIncluidos({ error: 'client_required' })).toMatch(/cliente/);
    expect(mensajeErrorIncluidos({ error: 'too_many_people', max: 6 })).toBe('Máximo 6 personas por unidad.');
    expect(mensajeErrorIncluidos({ error: 'persona_incompleta', personas: ['Ana', 'Beto'] })).toBe('Falta DNI o edad de: Ana, Beto.');
    expect(mensajeErrorIncluidos({ error: 'demasiados_pases', max: 4 })).toBe('La reserva incluye 4 pases de pileta.');
  });

  it('un error desconocido no tiene mensaje', () => {
    expect(mensajeErrorIncluidos({ error: 'otra_cosa' })).toBeNull();
    expect(mensajeErrorIncluidos(null)).toBeNull();
  });
});

describe('personas', () => {
  it('para tener pase hacen falta nombre, DNI y edad', () => {
    expect(personaCompletaParaPase({ fullName: 'Ana', documentNumber: '1', age: 30 })).toBe(true);
    expect(personaCompletaParaPase({ fullName: 'Ana', documentNumber: '1', birthDate: '1990-01-01' })).toBe(true);
    expect(personaCompletaParaPase({ fullName: 'Ana', age: 30 })).toBe(false);
    expect(personaCompletaParaPase({ fullName: 'Ana', documentNumber: '1' })).toBe(false);
  });

  it('cuenta adultos y menores de 18', () => {
    expect(contarPorEdad([{ age: 40 }, { age: 17 }, { birthDate: '2020-01-01' }], HOY)).toEqual({ adults: 1, children: 2 });
  });
});

describe('etiquetaVinculo', () => {
  it('dice en que carpa esta incluido o asociado', () => {
    expect(etiquetaVinculo({ vinculo: 'incluido', incluidaEnTipo: 'carpa', incluidaEnNumero: 12 })).toBe('Incluido en Carpa 12');
    expect(etiquetaVinculo({ vinculo: 'incluido', incluidaEnTipo: 'sombrilla', incluidaEnNumero: 3 })).toBe('Incluido en Sombrilla 3');
    expect(etiquetaVinculo({ vinculo: 'adicional', incluidaEnTipo: 'carpa', incluidaEnNumero: 12 })).toBe('Pase pago · Carpa 12');
    expect(etiquetaVinculo({ vinculo: null })).toBeNull();
  });
});

describe('ajustes del establecimiento', () => {
  it('pases incluidos por tipo de unidad, solo si hay pileta', () => {
    expect(pasesIncluidosPara({ hasPileta: true }, 'carpa')).toBe(4);
    expect(pasesIncluidosPara({ hasPileta: true }, 'sombrilla')).toBe(0);
    expect(pasesIncluidosPara({ hasPileta: true, pasesPiletaPorCarpa: 5 }, 'carpa')).toBe(5);
    expect(pasesIncluidosPara({ hasPileta: false, pasesPiletaPorCarpa: 5 }, 'carpa')).toBe(0);
  });

  it('tope de personas por unidad', () => {
    expect(maxPersonasPara({})).toBe(6);
    expect(maxPersonasPara({ maxPersonasPorUnidad: 8 })).toBe(8);
    expect(superaTope({}, '4', '2')).toBe(false);
    expect(superaTope({}, '5', '2')).toBe(true);
  });
});
