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
  cocheraVacia,
  analizarCocheras,
  cambiosIncluidos
} from './incluidos';
import * as incluidosLib from './incluidos';

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

describe('analizarCocheras', () => {
  const cochera = (extra = {}) => ({ ...cocheraVacia(), vehiclePlate: 'AB123CD', precio: { cobrado: '1000', motivo: '', precioTarifa: 1000 }, ...extra });
  const analizar = (cocheras, ocupadas = [], extra = {}) =>
    analizarCocheras({ cocheras, ocupadas: new Set(ocupadas), capacidad: 5, verificando: false, ...extra });

  it('sin plaza elegida asigna la primera libre, sin repetir la de otra cochera', () => {
    const r = analizar([cochera(), cochera({ plaza: '2' }), cochera()], [1]);
    expect(r.efectivas).toEqual([3, 2, 4]);
    expect(r.mensajes[0]).toBe('Se asigna la plaza 3.');
    expect(r.bloquea).toBe(false);
  });

  it('una plaza elegida ocupada es conflicto y bloquea', () => {
    const r = analizar([cochera({ plaza: '1' })], [1]);
    expect(r.conflicto).toEqual([true]);
    expect(r.bloquea).toBe(true);
  });

  it('sin plazas libres avisa y bloquea', () => {
    const r = analizar([cochera()], [1, 2, 3, 4, 5]);
    expect(r.efectivas).toEqual([null]);
    expect(r.mensajes[0]).toBe('No hay plazas libres en esas fechas.');
    expect(r.bloquea).toBe(true);
  });

  it('sin patente bloquea', () => {
    expect(analizar([cochera({ vehiclePlate: ' ' })]).faltaPatente).toBe(true);
  });

  it('un pago mayor al total o sin metodo bloquea', () => {
    expect(analizar([cochera({ pagoMonto: '2000', pagoMetodo: 'cash' })]).pagoExcede).toEqual([true]);
    const sinMetodo = analizar([cochera({ pagoMonto: '500', pagoMetodo: '' })]);
    expect(sinMetodo.pagoSinMetodo).toEqual([true]);
    expect(sinMetodo.bloquea).toBe(true);
  });

  it('suma el total de todas las cocheras', () => {
    expect(analizar([cochera(), cochera({ precio: { cobrado: '500' } })]).total).toBe(1500);
  });

  it('mientras verifica disponibilidad no asigna ni deja guardar', () => {
    const r = analizar([cochera()], [], { verificando: true });
    expect(r.efectivas).toEqual([null]);
    expect(r.mensajes[0]).toBeNull();
    expect(r.bloquea).toBe(true);
  });
});

describe('cambiosIncluidos', () => {
  const carpa = { id: 60, incluidos: { pileta: { id: 501, asignados: 2 }, cocheras: [{ id: 502, plaza: 45 }], pasesPagos: [] } };

  it('sin cambios no manda nada', () => {
    expect(cambiosIncluidos(carpa, [])).toBeUndefined();
    expect(cambiosIncluidos({ ...carpa, tempIncluyePileta: true }, [])).toBeUndefined();
  });

  it('quitar la pileta y una cochera', () => {
    expect(cambiosIncluidos({ ...carpa, tempIncluyePileta: false, tempCocherasCanceladas: [502] }, []))
      .toEqual({ pileta: false, cocherasCanceladas: [502] });
  });

  it('agregar cocheras nuevas con la plaza que se cotizo y la patente normalizada', () => {
    const modal = { id: 60, incluidos: null, tempIncluyePileta: true, cocheras: [{ ...cocheraVacia(), vehiclePlate: 'ab 123 cd', precio: { cobrado: '700', motivo: '' } }] };
    expect(cambiosIncluidos(modal, [7])).toEqual({
      pileta: true,
      cocherasNuevas: [{ plaza: 7, vehiclePlate: 'AB123CD', precio: { cobrado: '700', motivoAjuste: '' } }]
    });
  });
});

describe('filas de personas en el alta', () => {
  const { filasDePersonas, armarPersonasAlta } = incluidosLib;
  const cliente = { id: 7, fullName: 'Lucia', documentNumber: '30111222', birthDate: '1990-05-01T03:00:00.000Z' };

  it('una fila de titular y una por acompanante segun la cantidad', () => {
    const filas = filasDePersonas({ adultsCount: '2', childrenCount: '2', cliente, titularDatos: undefined, acompanantes: [], max: 6 });
    expect(filas).toHaveLength(4);
    expect(filas[0]).toMatchObject({ esTitular: true, fullName: 'Lucia', documentNumber: '30111222', birthDate: '1990-05-01' });
    expect(filas[1]).toMatchObject({ esTitular: false, indice: 0, fullName: '' });
  });

  it('nunca pasa del tope de personas', () => {
    expect(filasDePersonas({ adultsCount: '9', childrenCount: '0', cliente, acompanantes: [], max: 6 })).toHaveLength(6);
  });

  it('por defecto da pase a los primeros completos hasta el maximo; lo elegido a mano manda', () => {
    const acompanantes = [
      { fullName: 'Ana', documentNumber: '1', age: '40' },
      { fullName: 'Beto', documentNumber: '', age: '10' },
      { fullName: 'Caro', documentNumber: '3', age: '12', pileta: false },
      { fullName: 'Dani', documentNumber: '4', age: '15' },
      { fullName: 'Eli', documentNumber: '5', age: '30' }
    ];
    const filas = filasDePersonas({ adultsCount: '6', childrenCount: '0', cliente, acompanantes, max: 6, pases: 4, incluyePileta: true });
    expect(filas.map((f) => f.pileta)).toEqual([true, true, false, false, true, true]);
  });

  it('sin pileta nadie tiene pase', () => {
    const filas = filasDePersonas({ adultsCount: '2', childrenCount: '0', cliente, acompanantes: [{ fullName: 'Ana', documentNumber: '1', age: '40' }], max: 6, pases: 4, incluyePileta: false });
    expect(filas.map((f) => f.pileta)).toEqual([false, false]);
  });

  it('arma lo que se manda: titular y acompanantes con nombre', () => {
    const filas = filasDePersonas({
      adultsCount: '3', childrenCount: '0', cliente, max: 6, pases: 4, incluyePileta: true,
      acompanantes: [{ fullName: 'Ana', documentNumber: '1', age: '40' }, { fullName: '' }]
    });
    expect(armarPersonasAlta(filas)).toEqual({
      titular: { documentNumber: '30111222', birthDate: '1990-05-01', pileta: true, pasePago: false },
      personas: [{ fullName: 'Ana', documentNumber: '1', age: '40', pileta: true, pasePago: false }]
    });
  });

  it('sin cliente guardado no hay datos de titular para mandar', () => {
    const filas = filasDePersonas({ adultsCount: '2', childrenCount: '0', cliente: null, customerName: 'Juan', acompanantes: [{ fullName: 'Ana' }], max: 6 });
    expect(filas[0]).toMatchObject({ esTitular: true, fullName: 'Juan', sinFicha: true });
    expect(armarPersonasAlta(filas).titular).toBeUndefined();
  });
});

describe('cuenta unica en el alta', () => {
  const { filasDePersonas, armarPersonasAlta, cuentaDelAlta, mensajeErrorIncluidos: mensaje } = incluidosLib;
  const cliente = { id: 7, fullName: 'Lucia', documentNumber: '30111222', birthDate: '1990-05-01' };
  const acompanantes = [
    { fullName: 'Ana', documentNumber: '1', age: '40' },
    { fullName: 'Dani', documentNumber: '4', age: '30', pasePago: true, pileta: false },
    { fullName: 'Eli', documentNumber: '5', age: '10', pasePago: true, pileta: false },
    { fullName: 'Beto', documentNumber: '', age: '10', pasePago: true }
  ];
  const filas = () => filasDePersonas({
    adultsCount: '3', childrenCount: '2', cliente, acompanantes, max: 6, pases: 4, incluyePileta: true, ventaPases: true
  });

  it('una fila tiene pase incluido o pase pago, y el pago pide datos completos', () => {
    const f = filas();
    expect(f.map((x) => [x.pileta, x.pasePago])).toEqual([[true, false], [true, false], [false, true], [false, true], [false, false]]);
  });

  it('sin pileta en el balneario no hay pase pago', () => {
    const f = filasDePersonas({ adultsCount: '2', childrenCount: '0', cliente, acompanantes: [acompanantes[1]], max: 6, ventaPases: false });
    expect(f[1].pasePago).toBe(false);
  });

  it('manda el pase pago de cada persona', () => {
    const r = armarPersonasAlta(filas());
    expect(r.titular).toEqual({ documentNumber: '30111222', birthDate: '1990-05-01', pileta: true, pasePago: false });
    expect(r.personas[1]).toEqual({ fullName: 'Dani', documentNumber: '4', age: '30', pileta: false, pasePago: true });
  });

  it('arma la cuenta: cada item con su subtotal y el total', () => {
    const cuenta = cuentaDelAlta({
      etiquetaUnidad: 'Carpa 12', totalUnidad: 150000, filas: filas(), pasesIncluidos: 4,
      precios: { adulto: '5000', menor: '3000' }, dias: 3,
      cocheras: [{ plaza: 45, total: 70000 }]
    });
    expect(cuenta.lineas).toEqual([
      { clave: 'unidad', etiqueta: 'Carpa 12', monto: 150000 },
      { clave: 'pileta-incluida', etiqueta: 'Pileta incluida (2 de 4 pases)', monto: null },
      { clave: 'pileta-paga', etiqueta: 'Pileta paga (2 pases)', monto: 24000 },
      { clave: 'cochera-0', etiqueta: 'Cochera plaza 45', monto: 70000 }
    ]);
    expect(cuenta.total).toBe(244000);
    expect(cuenta.pasePago).toEqual({ cantidad: 2, adultos: 1, menores: 1, total: 24000, faltaPrecio: false });
  });

  it('avisa si falta el precio de los pases pagos', () => {
    const cuenta = cuentaDelAlta({ etiquetaUnidad: 'Carpa 12', totalUnidad: 1000, filas: filas(), pasesIncluidos: 4, precios: { adulto: '5000', menor: '' }, dias: 3, cocheras: [] });
    expect(cuenta.pasePago.faltaPrecio).toBe(true);
  });

  it('sin pileta ni cocheras la cuenta es solo la unidad', () => {
    const cuenta = cuentaDelAlta({ etiquetaUnidad: 'Sombrilla 3', totalUnidad: 500, filas: [], pasesIncluidos: 0, precios: {}, dias: 1, cocheras: [] });
    expect(cuenta.lineas).toEqual([{ clave: 'unidad', etiqueta: 'Sombrilla 3', monto: 500 }]);
    expect(cuenta.total).toBe(500);
  });

  it('traduce los errores del cobro', () => {
    expect(mensaje({ error: 'pago_excede_total', saldo: 244000 })).toBe('El pago no puede superar el saldo de la cuenta ($244.000).');
    expect(mensaje({ error: 'payment_method_required' })).toMatch(/medio de pago/);
    expect(mensaje({ error: 'precio_pase_requerido' })).toMatch(/precio por día/);
  });
});

describe('pileta incluida: sin precio propio', () => {
  it('se reconoce y dice en el precio de que unidad va', async () => {
    const { esPiletaIncluida, textoPiletaIncluida } = await import('./incluidos');
    const incluida = { serviceType: 'pileta', vinculo: 'incluido', incluidaEnTipo: 'carpa', incluidaEnNumero: 97 };
    expect(esPiletaIncluida(incluida)).toBe(true);
    expect(textoPiletaIncluida(incluida)).toBe('Incluida en el precio de la Carpa 97');
    // Un pase pago de la carpa si tiene precio, y una cochera incluida tambien.
    expect(esPiletaIncluida({ ...incluida, vinculo: 'adicional' })).toBe(false);
    expect(esPiletaIncluida({ ...incluida, serviceType: 'parking' })).toBe(false);
    expect(esPiletaIncluida({ serviceType: 'pileta' })).toBe(false);
  });
});
