import { describe, it, expect, vi, beforeEach } from 'vitest';
import servicio from './_tarifas/servicio.js';

const { fechaISO, resolverCobro, precioAlCrear, precioAlEditar, rutearTarifas } = servicio;

// Filas como las devuelve pg: NUMERIC viene como texto.
const filaPeriodo = (id, nombre, mi, di, mf, df, prioridad = 1) => ({ id, nombre, mes_inicio: mi, dia_inicio: di, mes_fin: mf, dia_fin: df, prioridad });
const filaTarifa = (extra = {}) => ({
  id: 10, service_type: 'carpa', alcance: 'tipo', sector_id: null, resource_number: null,
  clase: 'fecha', periodo_id: 1, nombre: null, dias_min: null, dias_max: null, modo: null, precio: '10000.00', ...extra
});
const TODO_EL_ANIO = filaPeriodo(1, 'Todo el año', 1, 1, 12, 31);

let query;
beforeEach(() => {
  query = vi.fn();
});

// Las tres consultas de una cotizacion, en orden: tarifas, periodos, sector de la unidad.
function contexto(tarifas, periodos = [TODO_EL_ANIO], sector = []) {
  query.mockResolvedValueOnce({ rows: tarifas });
  query.mockResolvedValueOnce({ rows: periodos });
  query.mockResolvedValueOnce({ rows: sector });
}

describe('fechaISO', () => {
  it('convierte un Date de pg (medianoche local) sin correrse de dia', () => {
    expect(fechaISO(new Date(2026, 9, 1))).toBe('2026-10-01');
    expect(fechaISO('2026-10-01')).toBe('2026-10-01');
  });
});

describe('resolverCobro', () => {
  it('sin precio cobrado usa el de tarifa', () => {
    expect(resolverCobro({ precioTarifa: 30000, cobrado: null, motivo: '' })).toEqual({ totalPrice: 30000, motivoAjuste: null });
  });
  it('un ajuste sin motivo se rechaza', () => {
    expect(resolverCobro({ precioTarifa: 30000, cobrado: 25000, motivo: '  ' })).toEqual({ error: 'motivo_ajuste_required' });
  });
  it('un ajuste con motivo se guarda con el motivo', () => {
    expect(resolverCobro({ precioTarifa: 30000, cobrado: 25000, motivo: ' cliente de años ' })).toEqual({ totalPrice: 25000, motivoAjuste: 'cliente de años' });
  });
  it('si el cobrado es igual a la tarifa no guarda motivo', () => {
    expect(resolverCobro({ precioTarifa: 30000, cobrado: 30000, motivo: 'viejo' })).toEqual({ totalPrice: 30000, motivoAjuste: null });
  });
  it('sin precio de tarifa acepta el precio a mano sin motivo', () => {
    expect(resolverCobro({ precioTarifa: null, cobrado: 20000, motivo: '' })).toEqual({ totalPrice: 20000, motivoAjuste: null });
  });
  it('un cobrado que no es numero o es negativo se rechaza', () => {
    expect(resolverCobro({ precioTarifa: 30000, cobrado: NaN, motivo: 'x' })).toEqual({ error: 'precio_invalido' });
    expect(resolverCobro({ precioTarifa: null, cobrado: NaN, motivo: '' })).toEqual({ error: 'precio_invalido' });
    expect(resolverCobro({ precioTarifa: null, cobrado: -5, motivo: '' })).toEqual({ error: 'precio_invalido' });
    expect(resolverCobro({ precioTarifa: 30000, cobrado: Infinity, motivo: 'x' })).toEqual({ error: 'precio_invalido' });
  });
});

describe('precioAlCrear', () => {
  const body = { serviceType: 'carpa', resourceNumber: 58, startDate: '2026-01-10', endDate: '2026-01-12' };

  it('cotiza con las tarifas del establecimiento y guarda el snapshot', async () => {
    contexto([filaTarifa()]);
    const r = await precioAlCrear(query, 7, body);
    expect(r).toMatchObject({ precioTarifa: 30000, totalPrice: 30000, dailyPrice: 10000, motivoAjuste: null });
    expect(r.desglose.clase).toBe('fecha');
    expect(query.mock.calls[0][1]).toEqual([7, 'carpa']);
    expect(query.mock.calls[0][0]).toMatch(/ORDER BY id/);
    expect(query.mock.calls[2][1]).toEqual([7, 'carpa', 58]);
  });

  it('toma el sector de la unidad', async () => {
    contexto([filaTarifa(), filaTarifa({ id: 11, alcance: 'sector', sector_id: 4, precio: '15000.00' })], [TODO_EL_ANIO], [{ sector_id: 4 }]);
    const r = await precioAlCrear(query, 7, body);
    expect(r.precioTarifa).toBe(45000);
  });

  it('sin tarifas cargadas acepta el precio del navegador y no guarda desglose', async () => {
    contexto([], []);
    const r = await precioAlCrear(query, 7, { ...body, totalPrice: '27000' });
    expect(r).toEqual({ precioTarifa: null, desglose: null, totalPrice: 27000, dailyPrice: 9000, motivoAjuste: null });
  });

  it('rechaza un ajuste sin motivo', async () => {
    contexto([filaTarifa()]);
    expect(await precioAlCrear(query, 7, { ...body, totalPrice: '25000' })).toEqual({ error: 'motivo_ajuste_required' });
  });

  it('un total que no es numero se rechaza con precio_invalido', async () => {
    contexto([filaTarifa()]);
    expect(await precioAlCrear(query, 7, { ...body, totalPrice: 'abc', motivoAjuste: 'x' })).toEqual({ error: 'precio_invalido' });
  });

  it('fechas al reves devuelven rango_invalido en vez de tirar', async () => {
    contexto([filaTarifa()]);
    expect(await precioAlCrear(query, 7, { ...body, startDate: '2026-01-12', endDate: '2026-01-10' })).toEqual({ error: 'rango_invalido' });
  });

  it('un error de base al cotizar se propaga', async () => {
    query.mockRejectedValueOnce(new Error('conexion caida'));
    await expect(precioAlCrear(query, 7, body)).rejects.toThrow('conexion caida');
  });

  it('pileta no pasa por tarifas', async () => {
    const r = await precioAlCrear(query, 7, { serviceType: 'pileta', dailyPrice: '6000', totalPrice: '6000' });
    expect(query).not.toHaveBeenCalled();
    expect(r).toMatchObject({ dailyPrice: '6000', totalPrice: '6000', precioTarifa: null });
  });
});

describe('precioAlEditar', () => {
  const current = {
    service_type: 'carpa', resource_number: 58, start_date: new Date(2026, 0, 10), end_date: new Date(2026, 0, 12),
    precio_tarifa: '30000.00', total_price: '30000.00', desglose: { clase: 'fecha', tramos: [] }, motivo_ajuste: null
  };

  it('sin recalcular conserva el snapshot y no consulta tarifas', async () => {
    const r = await precioAlEditar(query, 7, current, {}, { recalcular: false, desde: '2026-01-10', hasta: '2026-01-12', resourceNumber: 58 });
    expect(query).not.toHaveBeenCalled();
    expect(r).toEqual({ precioTarifa: 30000, desglose: current.desglose, totalPrice: 30000, dailyPrice: 10000, motivoAjuste: null });
  });

  it('sin recalcular, bajar el precio exige motivo contra la tarifa guardada', async () => {
    const opciones = { recalcular: false, desde: '2026-01-10', hasta: '2026-01-12', resourceNumber: 58 };
    expect(await precioAlEditar(query, 7, current, { totalPrice: '28000' }, opciones)).toEqual({ error: 'motivo_ajuste_required' });
  });

  it('al recalcular cotiza las fechas nuevas', async () => {
    contexto([filaTarifa()]);
    const r = await precioAlEditar(query, 7, current, {}, { recalcular: true, desde: '2026-01-10', hasta: '2026-01-14', resourceNumber: 58 });
    expect(r).toMatchObject({ precioTarifa: 50000, totalPrice: 50000, dailyPrice: 10000 });
  });

  it('al recalcular con fechas al reves devuelve rango_invalido', async () => {
    contexto([filaTarifa()]);
    const r = await precioAlEditar(query, 7, current, {}, { recalcular: true, desde: '2026-01-14', hasta: '2026-01-10', resourceNumber: 58 });
    expect(r).toEqual({ error: 'rango_invalido' });
  });

  it('al recalcular, un error de base se propaga', async () => {
    query.mockRejectedValueOnce(new Error('conexion caida'));
    await expect(precioAlEditar(query, 7, current, {}, { recalcular: true, desde: '2026-01-10', hasta: '2026-01-14', resourceNumber: 58 })).rejects.toThrow('conexion caida');
  });

  it('un total negativo se rechaza con precio_invalido', async () => {
    const opciones = { recalcular: false, desde: '2026-01-10', hasta: '2026-01-12', resourceNumber: 58 };
    expect(await precioAlEditar(query, 7, current, { totalPrice: '-100', motivoAjuste: 'x' }, opciones)).toEqual({ error: 'precio_invalido' });
  });
});

describe('rutearTarifas', () => {
  it('cotizar valida los parametros', async () => {
    const r = await rutearTarifas(query, 7, { method: 'GET', partes: ['cotizar'], params: { serviceType: 'pileta' }, body: {} });
    expect(r).toEqual({ status: 400, body: { error: 'parametros_invalidos' } });
  });

  it('cotizar devuelve la cotizacion', async () => {
    contexto([filaTarifa()]);
    const r = await rutearTarifas(query, 7, { method: 'GET', partes: ['cotizar'], params: { serviceType: 'carpa', resourceNumber: '58', startDate: '2026-01-10', endDate: '2026-01-10' }, body: {} });
    expect(r.status).toBe(200);
    expect(r.body.cotizacion.total).toBe(10000);
  });

  it('cotizar con una fecha que no existe responde 400', async () => {
    contexto([]);
    const r = await rutearTarifas(query, 7, { method: 'GET', partes: ['cotizar'], params: { serviceType: 'carpa', resourceNumber: '58', startDate: '2026-02-30', endDate: '2026-03-02' }, body: {} });
    expect(r).toEqual({ status: 400, body: { error: 'fecha_invalida' } });
  });

  it('lista los periodos con el calendario del anio', async () => {
    query.mockResolvedValueOnce({ rows: [TODO_EL_ANIO] });
    const r = await rutearTarifas(query, 7, { method: 'GET', partes: ['periodos'], params: {}, body: {} });
    expect(r.body.periodos[0]).toEqual({ id: 1, nombre: 'Todo el año', mesInicio: 1, diaInicio: 1, mesFin: 12, diaFin: 31, prioridad: 1 });
    expect(r.body.calendario).toHaveLength(366);
  });

  it('rechaza un periodo superpuesto con la misma prioridad', async () => {
    query.mockResolvedValueOnce({ rows: [TODO_EL_ANIO] });
    const r = await rutearTarifas(query, 7, { method: 'POST', partes: ['periodos'], params: {}, body: { nombre: 'Enero', mesInicio: 1, diaInicio: 1, mesFin: 1, diaFin: 31, prioridad: 1 } });
    expect(r).toEqual({ status: 409, body: { error: 'periodo_superpuesto' } });
  });

  it('crea un periodo de mayor prioridad aunque se superponga', async () => {
    query.mockResolvedValueOnce({ rows: [TODO_EL_ANIO] });
    query.mockResolvedValueOnce({ rows: [filaPeriodo(2, 'Enero', 1, 1, 1, 31, 5)] });
    const r = await rutearTarifas(query, 7, { method: 'POST', partes: ['periodos'], params: {}, body: { nombre: 'Enero', mesInicio: 1, diaInicio: 1, mesFin: 1, diaFin: 31, prioridad: 5 } });
    expect(r.status).toBe(201);
    expect(query.mock.calls[1][1]).toEqual([7, 'Enero', 1, 1, 1, 31, 5]);
  });

  it('traduce la unidad repetida en otro sector a 409', async () => {
    query.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505', constraint: 'sector_unidades_unica' }));
    const r = await rutearTarifas(query, 7, { method: 'POST', partes: ['sectores'], params: {}, body: { serviceType: 'carpa', nombre: 'Terraza', color: '#0EA5E9', unidades: [58, 59, 58] } });
    expect(r).toEqual({ status: 409, body: { error: 'unidad_en_otro_sector' } });
    expect(query.mock.calls[0][1]).toEqual([7, 'carpa', 'Terraza', '#0EA5E9', [58, 59]]);
  });

  it('no deja crear una tarifa para un sector de otro establecimiento', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const r = await rutearTarifas(query, 7, { method: 'POST', partes: [], params: {}, body: { serviceType: 'carpa', alcance: 'sector', sectorId: 99, clase: 'fecha', periodoId: 1, precio: 5000 } });
    expect(r).toEqual({ status: 400, body: { error: 'sector_invalido' } });
  });

  it('crea una tarifa por fecha', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // el periodo es del establecimiento
    query.mockResolvedValueOnce({ rows: [] }); // tarifas existentes
    query.mockResolvedValueOnce({ rows: [filaTarifa({ id: 12 })] });
    const r = await rutearTarifas(query, 7, { method: 'POST', partes: [], params: {}, body: { serviceType: 'carpa', alcance: 'tipo', clase: 'fecha', periodoId: 1, precio: '10000' } });
    expect(r.status).toBe(201);
    expect(r.body.tarifa).toMatchObject({ id: 12, precio: 10000, periodoId: 1 });
  });

  it('una ruta desconocida es 404', async () => {
    const r = await rutearTarifas(query, 7, { method: 'GET', partes: ['nada'], params: {}, body: {} });
    expect(r.status).toBe(404);
  });

  it('un error de base no se disfraza de precio 0: se propaga', async () => {
    query.mockRejectedValueOnce(new Error('connection refused'));
    await expect(rutearTarifas(query, 7, { method: 'GET', partes: ['cotizar'], params: { serviceType: 'carpa', resourceNumber: '58', startDate: '2026-01-10', endDate: '2026-01-10' }, body: {} })).rejects.toThrow('connection refused');
  });
});
