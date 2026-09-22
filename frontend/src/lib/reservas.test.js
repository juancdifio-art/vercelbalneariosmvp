import { describe, it, expect } from 'vitest';
import {
  diasInclusivos,
  reservasDelCliente,
  otrasReservasVigentes,
  saldoDe,
  estadoDeCuenta,
  diasOcupadaDesde,
  deudasPorCliente,
  hoyISO
} from './reservas';

const HOY = '2026-09-22';

describe('diasInclusivos', () => {
  it('cuenta los dos extremos', () => {
    expect(diasInclusivos('2026-09-23', '2026-09-29')).toBe(7);
  });

  it('un mismo dia es 1', () => {
    expect(diasInclusivos(HOY, HOY)).toBe(1);
  });

  it('no se corre un dia al cruzar un cambio de mes ni de anio', () => {
    expect(diasInclusivos('2026-09-22', '2027-03-28')).toBe(188);
  });
});

describe('reservasDelCliente', () => {
  const RESERVAS = [
    { id: 1, clientId: 16, customerName: 'Alejandro Morales' },
    { id: 2, clientId: 113, customerName: 'Alejandro Morales' },
    { id: 3, clientId: null, customerName: '' },
    { id: 4, clientId: 7, customerName: 'Mariana Cabrera' }
  ];

  it('filtra por clientId', () => {
    expect(reservasDelCliente(RESERVAS, 113).map((g) => g.id)).toEqual([2]);
  });

  it('no mezcla clientes con el mismo nombre', () => {
    // El bug que motivo esto: la ficha de un Alejandro Morales mostraba las
    // reservas de otro Alejandro Morales.
    expect(reservasDelCliente(RESERVAS, 16).map((g) => g.id)).toEqual([1]);
  });

  it('una reserva sin cliente no aparece en ninguna ficha', () => {
    // Antes el nombre vacio coincidia con todos: 'x'.includes('') es true.
    for (const id of [16, 113, 7]) {
      expect(reservasDelCliente(RESERVAS, id).some((g) => g.id === 3)).toBe(false);
    }
  });

  it('acepta el id como string, como llega de algunos formularios', () => {
    expect(reservasDelCliente(RESERVAS, '7').map((g) => g.id)).toEqual([4]);
  });

  it('sin clientId devuelve vacio', () => {
    expect(reservasDelCliente(RESERVAS, null)).toEqual([]);
    expect(reservasDelCliente(RESERVAS, undefined)).toEqual([]);
  });
});

describe('otrasReservasVigentes', () => {
  const ACTUAL = { id: 10, clientId: 5, status: 'active', startDate: '2026-09-20', endDate: '2026-10-05' };
  const RESERVAS = [
    ACTUAL,
    { id: 11, clientId: 5, status: 'active', startDate: '2026-09-20', endDate: '2026-10-05' },
    { id: 12, clientId: 5, status: 'active', startDate: '2026-10-10', endDate: '2026-10-20' },
    { id: 13, clientId: 5, status: 'active', startDate: '2026-08-01', endDate: '2026-08-15' },
    { id: 14, clientId: 5, status: 'cancelled', startDate: '2026-09-20', endDate: '2026-10-05' },
    { id: 15, clientId: 9, status: 'active', startDate: '2026-09-20', endDate: '2026-10-05' }
  ];

  it('trae las del mismo cliente en curso y futuras, sin la que se esta mirando', () => {
    expect(otrasReservasVigentes(RESERVAS, ACTUAL, HOY).map((g) => g.id)).toEqual([11, 12]);
  });

  it('deja afuera las terminadas y las canceladas', () => {
    const ids = otrasReservasVigentes(RESERVAS, ACTUAL, HOY).map((g) => g.id);
    expect(ids).not.toContain(13);
    expect(ids).not.toContain(14);
  });

  it('una reserva sin cliente no tiene otras', () => {
    expect(otrasReservasVigentes(RESERVAS, { ...ACTUAL, clientId: null }, HOY)).toEqual([]);
  });
});

describe('saldoDe y estadoDeCuenta', () => {
  it('el saldo es el total menos lo pagado, con los NUMERIC que llegan como string', () => {
    expect(saldoDe({ totalPrice: '2400000.00', paidAmount: 500000 })).toBe(1900000);
  });

  it('el estado de cuenta suma todo menos las canceladas', () => {
    const cuenta = estadoDeCuenta([
      { status: 'active', totalPrice: '126000.00', paidAmount: 126000 },
      { status: 'active', totalPrice: '558000.00', paidAmount: 279000 },
      { status: 'cancelled', totalPrice: '999999.00', paidAmount: 0 }
    ]);
    expect(cuenta).toEqual({ total: 684000, pagado: 405000, saldo: 279000 });
  });
});

describe('diasOcupadaDesde', () => {
  const carpa = (id, startDate, endDate, status = 'active') => ({
    id, serviceType: 'carpa', resourceNumber: 1, status, startDate, endDate
  });

  it('cuenta hasta el fin real de la reserva, sin tope de 90 dias', () => {
    // El caso de la captura: Carpa 1 del 22/09 al 28/03 marcaba 90.
    const reservas = [carpa(1, '2026-09-22', '2027-03-28')];
    expect(diasOcupadaDesde(reservas, 'carpa', 1, HOY)).toBe(188);
  });

  it('cuenta desde hoy aunque la reserva haya empezado antes', () => {
    const reservas = [carpa(1, '2026-09-15', '2026-09-25')];
    expect(diasOcupadaDesde(reservas, 'carpa', 1, HOY)).toBe(4);
  });

  it('encadena reservas pegadas de la misma unidad: la pregunta es cuando se libera', () => {
    const reservas = [carpa(1, '2026-09-20', '2026-09-25'), carpa(2, '2026-09-26', '2026-09-30')];
    expect(diasOcupadaDesde(reservas, 'carpa', 1, HOY)).toBe(9);
  });

  it('no encadena si queda un dia libre en el medio', () => {
    const reservas = [carpa(1, '2026-09-20', '2026-09-25'), carpa(2, '2026-09-27', '2026-09-30')];
    expect(diasOcupadaDesde(reservas, 'carpa', 1, HOY)).toBe(4);
  });

  it('ignora las canceladas y las de otras unidades o servicios', () => {
    const reservas = [
      carpa(1, '2026-09-20', '2026-09-25'),
      carpa(2, '2026-09-26', '2026-12-30', 'cancelled'),
      { ...carpa(3, '2026-09-26', '2026-12-30'), resourceNumber: 2 },
      { ...carpa(4, '2026-09-26', '2026-12-30'), serviceType: 'sombrilla' }
    ];
    expect(diasOcupadaDesde(reservas, 'carpa', 1, HOY)).toBe(4);
  });

  it('si la unidad esta libre hoy devuelve 0', () => {
    expect(diasOcupadaDesde([carpa(1, '2026-10-01', '2026-10-05')], 'carpa', 1, HOY)).toBe(0);
  });
});

describe('hoyISO', () => {
  it('usa la fecha local, no la UTC', () => {
    // 22/09 a las 22 hs en Argentina ya es 23/09 en UTC.
    expect(hoyISO(new Date(2026, 8, 22, 22, 30))).toBe('2026-09-22');
  });
});

describe('deudasPorCliente', () => {
  const r = (id, clientId, endDate, total, pagado, status = 'active') => ({
    id, clientId, status, startDate: '2026-08-01', endDate, totalPrice: String(total), paidAmount: pagado
  });

  it('suma lo impago de las reservas que ya terminaron', () => {
    const deudas = deudasPorCliente(
      [r(1, 5, '2026-09-10', 100000, 40000), r(2, 5, '2026-09-15', 50000, 0)],
      HOY
    );
    expect(deudas.get(5).monto).toBe(110000);
    expect(deudas.get(5).reservas.map((g) => g.id)).toEqual([2, 1]);
  });

  it('no cuenta las reservas en curso: se pagan durante la estadia', () => {
    const deudas = deudasPorCliente([r(1, 5, '2026-09-30', 100000, 0)], HOY);
    expect(deudas.has(5)).toBe(false);
  });

  it('una reserva que termina hoy todavia esta en curso', () => {
    expect(deudasPorCliente([r(1, 5, HOY, 100000, 0)], HOY).has(5)).toBe(false);
  });

  it('no cuenta las pagadas ni las canceladas', () => {
    const deudas = deudasPorCliente(
      [r(1, 5, '2026-09-10', 100000, 100000), r(2, 5, '2026-09-10', 100000, 0, 'cancelled')],
      HOY
    );
    expect(deudas.has(5)).toBe(false);
  });

  it('ignora las reservas sin cliente', () => {
    expect(deudasPorCliente([r(1, null, '2026-09-10', 100000, 0)], HOY).size).toBe(0);
  });

  it('separa por cliente', () => {
    const deudas = deudasPorCliente(
      [r(1, 5, '2026-09-10', 100000, 0), r(2, 9, '2026-09-10', 30000, 10000)],
      HOY
    );
    expect(deudas.get(5).monto).toBe(100000);
    expect(deudas.get(9).monto).toBe(20000);
  });
});
