import { describe, it, expect } from 'vitest';
import calculo from './_tarifas/calculo.js';

const { diasEntre, diasInclusivos, periodoVigente, cotizar, calendarioAnual } = calculo;

const P = (id, nombre, mi, di, mf, df, prioridad = 1) => ({ id, nombre, mesInicio: mi, diaInicio: di, mesFin: mf, diaFin: df, prioridad });
const ALTA = P(1, 'Alta', 12, 15, 3, 15);
const BAJA = P(2, 'Baja', 3, 16, 12, 14);
const NAVIDAD = P(3, 'Navidad', 12, 24, 12, 26, 10);

let sig = 100;
const F = (periodoId, precio, alcance = 'tipo', extra = {}) => ({
  id: sig++, serviceType: 'carpa', alcance, sectorId: null, resourceNumber: null,
  clase: 'fecha', periodoId, nombre: null, diasMin: null, diasMax: null, modo: null, precio, ...extra
});
const E = (diasMin, diasMax, modo, precio, extra = {}) => ({
  id: sig++, serviceType: 'carpa', alcance: 'tipo', sectorId: null, resourceNumber: null,
  clase: 'estadia', periodoId: null, nombre: 'Estadía', diasMin, diasMax, modo, precio, ...extra
});
const unidad = (resourceNumber = 58, sectorId = null) => ({ serviceType: 'carpa', resourceNumber, sectorId });

describe('fechas', () => {
  it('lista los dias inclusivos sin correrse de dia', () => {
    expect(diasEntre('2026-03-01', '2026-03-01')).toEqual(['2026-03-01']);
    expect(diasEntre('2026-02-27', '2026-03-02')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
    expect(diasEntre('2028-02-28', '2028-03-01')).toEqual(['2028-02-28', '2028-02-29', '2028-03-01']);
    expect(diasInclusivos('2026-01-01', '2026-01-05')).toBe(5);
  });

  it('rechaza fechas mal escritas y rangos al reves', () => {
    expect(() => diasEntre('2026-3-1', '2026-03-05')).toThrow(expect.objectContaining({ codigo: 'fecha_invalida' }));
    expect(() => diasEntre('2026-03-05', '2026-03-01')).toThrow(expect.objectContaining({ codigo: 'rango_invalido' }));
    expect(() => diasEntre('2026-01-01', '2027-06-01')).toThrow(expect.objectContaining({ codigo: 'rango_demasiado_largo' }));
  });
});

describe('periodoVigente', () => {
  it('resuelve periodos que cruzan el fin de anio', () => {
    expect(periodoVigente([ALTA, BAJA], '2026-01-10')).toBe(ALTA);
    expect(periodoVigente([ALTA, BAJA], '2026-12-20')).toBe(ALTA);
    expect(periodoVigente([ALTA, BAJA], '2026-06-01')).toBe(BAJA);
    expect(periodoVigente([ALTA, BAJA], '2026-03-15')).toBe(ALTA);
    expect(periodoVigente([ALTA, BAJA], '2026-03-16')).toBe(BAJA);
  });

  it('gana el de mayor prioridad', () => {
    expect(periodoVigente([ALTA, BAJA, NAVIDAD], '2026-12-25')).toBe(NAVIDAD);
  });

  it('devuelve null si ningun periodo contiene la fecha', () => {
    expect(periodoVigente([NAVIDAD], '2026-07-01')).toBeNull();
  });
});

describe('cotizar por fecha', () => {
  it('una estadia que cruza de temporada se cotiza dia por dia', () => {
    const c = cotizar({ tarifas: [F(1, 14000), F(2, 9000)], periodos: [ALTA, BAJA], ...unidad(), desde: '2026-03-13', hasta: '2026-03-17' });
    expect(c.total).toBe(60000);
    expect(c.completo).toBe(true);
    expect(c.dias).toBe(5);
    expect(c.desglose.clase).toBe('fecha');
    expect(c.desglose.tramos).toEqual([
      { desde: '2026-03-13', hasta: '2026-03-15', periodoId: 1, periodo: 'Alta', dias: 3, precioDia: 14000, subtotal: 42000 },
      { desde: '2026-03-16', hasta: '2026-03-17', periodoId: 2, periodo: 'Baja', dias: 2, precioDia: 9000, subtotal: 18000 }
    ]);
  });

  it('Navidad pisa a Temporada alta', () => {
    const c = cotizar({ tarifas: [F(1, 14000), F(3, 20000)], periodos: [ALTA, BAJA, NAVIDAD], ...unidad(), desde: '2026-12-23', hasta: '2026-12-27' });
    expect(c.desglose.tramos.map((t) => [t.periodo, t.dias])).toEqual([['Alta', 1], ['Navidad', 3], ['Alta', 1]]);
    expect(c.total).toBe(88000);
  });

  it('usa la tarifa mas especifica: unidad, despues sector, despues tipo', () => {
    const tarifas = [
      F(1, 14000),
      F(1, 18000, 'sector', { sectorId: 7 }),
      F(2, 9000),
      F(1, 25000, 'unidad', { resourceNumber: 58 })
    ];
    const periodos = [ALTA, BAJA];
    const dosDiasAlta = { desde: '2026-01-10', hasta: '2026-01-11' };
    expect(cotizar({ tarifas, periodos, ...unidad(58, 7), ...dosDiasAlta }).total).toBe(50000);
    expect(cotizar({ tarifas, periodos, ...unidad(60, 7), ...dosDiasAlta }).total).toBe(36000);
    expect(cotizar({ tarifas, periodos, ...unidad(61, null), ...dosDiasAlta }).total).toBe(28000);
    // El sector no tiene precio en Baja: usa el general.
    expect(cotizar({ tarifas, periodos, ...unidad(60, 7), desde: '2026-06-01', hasta: '2026-06-01' }).total).toBe(9000);
  });

  it('marca los dias sin tarifa y no une tramos a traves de un hueco', () => {
    const c = cotizar({ tarifas: [F(1, 14000)], periodos: [ALTA, BAJA], ...unidad(), desde: '2026-03-15', hasta: '2026-03-17' });
    expect(c.completo).toBe(false);
    expect(c.diasSinTarifa).toEqual(['2026-03-16', '2026-03-17']);
    expect(c.total).toBe(14000);

    const hueco = cotizar({ tarifas: [F(3, 20000)], periodos: [NAVIDAD], ...unidad(), desde: '2026-12-23', hasta: '2026-12-27' });
    expect(hueco.diasSinTarifa).toEqual(['2026-12-23', '2026-12-27']);
    expect(hueco.desglose.tramos).toHaveLength(1);
  });

  it('sin periodos ni tarifas todo queda sin tarifa y el total es 0', () => {
    const c = cotizar({ tarifas: [], periodos: [], ...unidad(), desde: '2026-01-01', hasta: '2026-01-03' });
    expect(c).toMatchObject({ completo: false, total: 0, dias: 3 });
    expect(c.diasSinTarifa).toHaveLength(3);
  });

  it('ignora tarifas de otro servicio', () => {
    const c = cotizar({ tarifas: [F(1, 5000, 'tipo', { serviceType: 'sombrilla' })], periodos: [ALTA], ...unidad(), desde: '2026-01-10', hasta: '2026-01-10' });
    expect(c.completo).toBe(false);
  });
});

describe('cotizar por estadia', () => {
  it('una tarifa de estadia pisa a las de fecha', () => {
    const c = cotizar({ tarifas: [F(1, 14000), E(90, null, 'cerrado', 3500000)], periodos: [ALTA, BAJA], ...unidad(), desde: '2026-12-15', hasta: '2027-03-14' });
    expect(c.dias).toBe(90);
    expect(c.total).toBe(3500000);
    expect(c.completo).toBe(true);
    expect(c.desglose).toMatchObject({ clase: 'estadia', modo: 'cerrado', dias: 90, precio: 3500000, total: 3500000 });
  });

  it('respeta los limites del rango: 89 y 90 dias', () => {
    const tarifas = [E(45, 89, 'por_dia', 12000), E(90, null, 'cerrado', 3500000)];
    const c89 = cotizar({ tarifas, periodos: [ALTA, BAJA], ...unidad(), desde: '2026-12-15', hasta: '2027-03-13' });
    expect(c89.dias).toBe(89);
    expect(c89.total).toBe(1068000);
    expect(c89.desglose.modo).toBe('por_dia');
    const c90 = cotizar({ tarifas, periodos: [ALTA, BAJA], ...unidad(), desde: '2026-12-15', hasta: '2027-03-14' });
    expect(c90.total).toBe(3500000);
  });

  it('una estadia atada a un periodo solo aplica si la entrada cae en ese periodo', () => {
    const tarifas = [E(90, null, 'cerrado', 3500000, { periodoId: 1 }), F(2, 9000)];
    const invierno = cotizar({ tarifas, periodos: [ALTA, BAJA], ...unidad(), desde: '2026-04-01', hasta: '2026-06-29' });
    expect(invierno.desglose.clase).toBe('fecha');
    expect(invierno.total).toBe(90 * 9000);
    const verano = cotizar({ tarifas, periodos: [ALTA, BAJA], ...unidad(), desde: '2026-12-15', hasta: '2027-03-14' });
    expect(verano.total).toBe(3500000);
  });

  it('entre dos estadias gana la de alcance mas especifico', () => {
    const tarifas = [E(90, null, 'cerrado', 3500000), E(90, null, 'cerrado', 4200000, { alcance: 'sector', sectorId: 7 })];
    const c = cotizar({ tarifas, periodos: [ALTA, BAJA], ...unidad(58, 7), desde: '2026-12-15', hasta: '2027-03-14' });
    expect(c.total).toBe(4200000);
  });

  it('a igual alcance, la estadia atada al periodo de entrada gana a la suelta, en cualquier orden', () => {
    const atada = E(90, null, 'cerrado', 3000000, { periodoId: 1 });
    const suelta = E(90, null, 'cerrado', 3500000);
    const args = { periodos: [ALTA, BAJA], ...unidad(), desde: '2026-12-15', hasta: '2027-03-14' };
    expect(cotizar({ tarifas: [suelta, atada], ...args }).total).toBe(3000000);
    expect(cotizar({ tarifas: [atada, suelta], ...args }).total).toBe(3000000);
  });

  it('a igual alcance y periodo desempata el id mas bajo, en cualquier orden', () => {
    const vieja = E(90, null, 'cerrado', 3000000, { id: 1 });
    const nueva = E(90, 120, 'cerrado', 3500000, { id: 2 });
    const args = { periodos: [ALTA, BAJA], ...unidad(), desde: '2026-12-15', hasta: '2027-03-14' };
    expect(cotizar({ tarifas: [nueva, vieja], ...args }).desglose.tarifaId).toBe(1);
    expect(cotizar({ tarifas: [vieja, nueva], ...args }).desglose.tarifaId).toBe(1);
  });

  it('una estadia atada a un periodo aplica si ese periodo contiene la entrada, aunque otro de mayor prioridad rija ese dia', () => {
    const ENERO = P(5, 'Enero', 1, 1, 1, 31, 5);
    const tarifas = [E(15, 44, 'por_dia', 42000, { periodoId: 1 })];
    const quincena = cotizar({ tarifas, periodos: [ALTA, ENERO], ...unidad(), desde: '2027-01-05', hasta: '2027-01-24' });
    expect(quincena.dias).toBe(20);
    expect(quincena.desglose.clase).toBe('estadia');
    expect(quincena.total).toBe(840000);

    // Sigue sin aplicar a una entrada que cae en baja, fuera de ALTA.
    const baja = cotizar({ tarifas, periodos: [ALTA, ENERO], ...unidad(), desde: '2026-04-01', hasta: '2026-04-20' });
    expect(baja.desglose.clase).not.toBe('estadia');
  });

  it('una estadia atada a un periodo que no existe en periodos no aplica', () => {
    const tarifas = [E(90, null, 'cerrado', 3500000, { periodoId: 999 })];
    const c = cotizar({ tarifas, periodos: [ALTA, BAJA], ...unidad(), desde: '2026-12-15', hasta: '2027-03-14' });
    expect(c.desglose.clase).not.toBe('estadia');
  });
});

describe('cotizar: sinTarifas', () => {
  it('marca sinTarifas cuando el servicio pedido no tiene ninguna tarifa cargada', () => {
    const c = cotizar({ tarifas: [F(1, 14000, 'tipo', { serviceType: 'sombrilla' })], periodos: [ALTA], ...unidad(), desde: '2026-01-10', hasta: '2026-01-10' });
    expect(c.sinTarifas).toBe(true);
  });

  it('no marca sinTarifas si existe alguna tarifa del servicio, aunque no aplique a estos dias', () => {
    const c = cotizar({ tarifas: [F(2, 9000)], periodos: [ALTA, BAJA], ...unidad(), desde: '2026-01-10', hasta: '2026-01-10' });
    expect(c.completo).toBe(false);
    expect(c.sinTarifas).toBe(false);
  });
});

describe('calendarioAnual', () => {
  it('tiene 366 dias con el periodo vigente de cada uno', () => {
    const cal = calendarioAnual([ALTA, BAJA, NAVIDAD]);
    expect(cal).toHaveLength(366);
    expect(cal.find((d) => d.mes === 12 && d.dia === 25).periodoId).toBe(3);
    expect(cal.find((d) => d.mes === 2 && d.dia === 29).periodoId).toBe(1);
    expect(cal.find((d) => d.mes === 7 && d.dia === 1).periodoId).toBe(2);
  });
});
