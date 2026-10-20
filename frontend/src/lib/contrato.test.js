import { describe, it, expect } from 'vitest';
import {
  armarContrato,
  lineasCondiciones,
  reemplazarDatos,
  datosFaltantes,
  valoresDelContrato,
  esDatoDelSistema,
  TITULO_POR_DEFECTO
} from './contrato';

const CARPA = {
  id: 60, serviceType: 'carpa', resourceNumber: 50, startDate: '2026-12-15', endDate: '2027-03-15',
  customerName: 'Lucía Gómez', customerPhone: '2262 111111', clientDocumentNumber: '30111222'
};

const TITULAR = { fullName: 'Lucía Gómez', documentNumber: '30111222', phone: '2262 555555', addressStreet: 'Calle 59 1234', addressCity: 'Necochea' };

describe('armarContrato', () => {
  it('completa titular, unidad, periodo, importe y forma de pago', () => {
    const c = armarContrato({
      establecimiento: { name: 'Zeus' },
      contrato: { titulo: 'CONTRATACIÓN DE UNIDAD DE SOMBRA 2026-2027', condiciones: '' },
      reserva: CARPA,
      titular: TITULAR,
      pagos: [
        { amount: 1000, method: 'cash' },
        { amount: 2000, paymentMethod: 'transfer' },
        { amount: 500, method: 'cash' }
      ],
      total: '2520000'
    });

    expect(c.balneario).toBe('Zeus');
    expect(c.titulo).toBe('CONTRATACIÓN DE UNIDAD DE SOMBRA 2026-2027');
    expect(c.titular).toEqual([
      ['Titular', 'Lucía Gómez'],
      ['DNI', '30111222'],
      ['Ciudad', 'Necochea'],
      ['Dirección', 'Calle 59 1234'],
      ['Teléfono', '2262 555555']
    ]);
    expect(c.contratacion).toEqual([
      ['Unidad', 'Carpa 50'],
      ['Período', 'Del 15/12/2026 al 15/03/2027 (91 días)'],
      ['Importe total', '$2.520.000'],
      ['Forma de pago', 'Efectivo, Transferencia']
    ]);
  });

  it('sin ficha usa lo que tiene la reserva y deja vacio lo que falta', () => {
    const c = armarContrato({ establecimiento: { name: 'Zeus' }, contrato: null, reserva: CARPA });
    expect(c.titulo).toBe(TITULO_POR_DEFECTO);
    expect(c.titular).toEqual([
      ['Titular', 'Lucía Gómez'], ['DNI', '30111222'], ['Ciudad', ''], ['Dirección', ''], ['Teléfono', '2262 111111']
    ]);
    expect(c.contratacion.find(([e]) => e === 'Importe total')[1]).toBe('');
    expect(c.contratacion.find(([e]) => e === 'Forma de pago')[1]).toBe('');
  });

  it('la nomina deja una fila por persona permitida, menos el titular', () => {
    const c = armarContrato({
      establecimiento: {}, contrato: {}, reserva: CARPA, maxPersonas: 6,
      personas: [{ fullName: 'Ana Gómez', documentNumber: '45111222' }, { fullName: 'Tomás Gómez', documentNumber: null }]
    });
    expect(c.nomina).toHaveLength(5);
    expect(c.nomina.slice(0, 3)).toEqual([
      { nombre: 'Ana Gómez', dni: '45111222' },
      { nombre: 'Tomás Gómez', dni: '' },
      { nombre: '', dni: '' }
    ]);
  });

  it('si hay mas personas que filas, entran todas', () => {
    const personas = Array.from({ length: 7 }, (_, i) => ({ fullName: `P${i}` }));
    expect(armarContrato({ establecimiento: {}, contrato: {}, reserva: CARPA, personas, maxPersonas: 6 }).nomina).toHaveLength(7);
  });

  it('cada cochera dice su sector y su patente', () => {
    const c = armarContrato({
      establecimiento: {}, contrato: {}, reserva: CARPA,
      cocheras: [{ resourceNumber: 12, vehiclePlate: 'AB123CD' }, { resourceNumber: 205, vehiclePlate: 'AC456EF' }],
      sectores: [
        { serviceType: 'carpa', nombre: 'Terraza', unidades: [205] },
        { serviceType: 'parking', nombre: 'Descubierta', unidades: [201, 205, 300] }
      ]
    });
    expect(c.cocheras).toEqual(['N° 12 · patente AB 123 CD', 'N° 205 · Descubierta · patente AC 456 EF']);
  });

  it('sin fechas el periodo queda para completar a mano', () => {
    const c = armarContrato({ establecimiento: {}, contrato: {}, reserva: { serviceType: 'sombrilla', resourceNumber: 3 } });
    expect(c.contratacion[0]).toEqual(['Unidad', 'Sombrilla 3']);
    expect(c.contratacion[1]).toEqual(['Período', '']);
  });
});

describe('datos del contrato', () => {
  const DATOS = [
    { nombre: 'Horario de la pileta', valor: '13.30 a 19.30 hs' },
    { nombre: 'Inicio de temporada', valor: '15 de Diciembre del 2026' },
    { nombre: 'Dispositivos wifi', valor: '' }
  ];
  const valores = valoresDelContrato(DATOS, { nombreBalneario: 'Zeus', maxPersonas: 6 });

  it('cambia cada {Nombre} por su valor, sin importar mayusculas ni espacios', () => {
    expect(reemplazarDatos('Pileta de {Horario de la pileta}; desde el {inicio  de TEMPORADA}.', valores))
      .toBe('Pileta de 13.30 a 19.30 hs; desde el 15 de Diciembre del 2026.');
  });

  it('el maximo de personas y el balneario salen de la configuracion', () => {
    expect(reemplazarDatos('{Balneario}: hasta {Máximo de personas} personas', valores)).toBe('Zeus: hasta 6 personas');
  });

  it('el sistema le gana a un dato cargado con el mismo nombre', () => {
    const v = valoresDelContrato([{ nombre: 'máximo de personas', valor: '99' }], { maxPersonas: 6 });
    expect(reemplazarDatos('{Máximo de personas}', v)).toBe('6');
    expect(esDatoDelSistema(' Máximo  de personas ')).toBe(true);
  });

  it('un dato sin valor sale con puntos y uno que no existe queda tal cual', () => {
    expect(reemplazarDatos('{Dispositivos wifi} y {No existe}', valores)).toBe('.......... y {No existe}');
  });

  it('avisa los nombres del texto que no son datos, sin repetir', () => {
    expect(datosFaltantes('{No existe} {Horario de la pileta} {no existe} {Otro}', valores)).toEqual(['No existe', 'Otro']);
  });

  it('el contrato sale con los datos ya reemplazados, tambien en el titulo', () => {
    const c = armarContrato({
      establecimiento: { name: 'Zeus' },
      contrato: {
        titulo: 'CONTRATACIÓN {Temporada}',
        condiciones: '**8 - PILETA**\nHabilitada de {Horario de la pileta}.\nMáximo {Máximo de personas} personas.',
        datos: [{ nombre: 'Temporada', valor: '2026-2027' }, { nombre: 'Horario de la pileta', valor: '13.30 a 19.30 hs' }]
      },
      reserva: CARPA,
      maxPersonas: 6
    });
    expect(c.titulo).toBe('CONTRATACIÓN 2026-2027');
    expect(c.condiciones).toEqual([
      { texto: '8 - PILETA', negrita: true },
      { texto: 'Habilitada de 13.30 a 19.30 hs.', negrita: false },
      { texto: 'Máximo 6 personas.', negrita: false }
    ]);
  });
});

describe('lineasCondiciones', () => {
  it('una linea entre ** sale en negrita y las vacias se conservan', () => {
    expect(lineasCondiciones('**OBLIGATORIO**\nEl cliente que quiera...\n\n  **7 - DEPOSITO**  \nTexto con **dentro** no es negrita')).toEqual([
      { texto: 'OBLIGATORIO', negrita: true },
      { texto: 'El cliente que quiera...', negrita: false },
      { texto: '', negrita: false },
      { texto: '7 - DEPOSITO', negrita: true },
      { texto: 'Texto con **dentro** no es negrita', negrita: false }
    ]);
  });

  it('sin texto no hay lineas con contenido', () => {
    expect(lineasCondiciones(null).every((l) => !l.texto)).toBe(true);
  });
});
