import { describe, it, expect, vi } from 'vitest';
import servicio from './_incluidos/servicio.js';
import transaccion from './_incluidos/transaccion.js';

const {
  crearIncluidos, sincronizarIncluidos, modificarIncluidos, rutearPasePersonas, autoAsignar, mapVinculo
} = servicio;
const { enTransaccion } = transaccion;

// Una query falsa: cada regla es [regex del SQL, filas | (params, sql) => filas].
// Gana la primera que coincide; sin regla, la consulta devuelve cero filas.
function fakeDb(reglas = []) {
  return vi.fn(async (sql, params = []) => {
    for (const [re, filas] of reglas) {
      if (re.test(sql)) return { rows: typeof filas === 'function' ? filas(params, sql) : filas };
    }
    return { rows: [] };
  });
}

const llamadas = (query, re) => query.mock.calls.filter(([sql]) => re.test(sql));

const EST = { id: 1, has_pileta: true, has_parking: true, parking_capacity: 3 };
const CARPA = {
  id: 60, service_type: 'carpa', resource_number: 12, client_id: 7,
  start_date: '2026-01-10', end_date: '2026-01-20', customer_name: 'Lucia', customer_phone: null
};

let siguienteId = 500;
const insertDevuelve = (params) => [{
  id: siguienteId++, service_type: params[1], resource_number: params[2], vehicle_plate: params[16], total_price: params[8]
}];

describe('crearIncluidos: cocheras', () => {
  it('dos cocheras sin plaza reciben plazas libres distintas', async () => {
    const query = fakeDb([
      [/SELECT DISTINCT resource_number/, [{ resource_number: 1 }]],
      [/INSERT INTO reservation_groups/, insertDevuelve]
    ]);
    const pedido = { pileta: false, cocheras: [
      { plaza: null, vehiclePlate: 'AB123CD', totalPrice: null, motivoAjuste: null },
      { plaza: null, vehiclePlate: 'AC456EF', totalPrice: null, motivoAjuste: null }
    ] };

    const r = await crearIncluidos(query, EST, CARPA, pedido);

    expect(r.error).toBeUndefined();
    expect(r.cocheras.map((c) => c.plaza)).toEqual([2, 3]);
    const inserts = llamadas(query, /INSERT INTO reservation_groups/);
    expect(inserts).toHaveLength(2);
    // Vinculadas a la carpa, con sus fechas.
    expect(inserts[0][1]).toEqual(expect.arrayContaining([60, 'incluido', '2026-01-10', '2026-01-20']));
  });

  it('sin plaza libre falla con parking_unavailable', async () => {
    const query = fakeDb([
      [/SELECT DISTINCT resource_number/, [{ resource_number: 1 }, { resource_number: 2 }, { resource_number: 3 }]]
    ]);
    const pedido = { pileta: false, cocheras: [{ plaza: null, vehiclePlate: 'AB123CD', totalPrice: null, motivoAjuste: null }] };

    const r = await crearIncluidos(query, EST, CARPA, pedido);

    expect(r).toMatchObject({ error: 'parking_unavailable', status: 409 });
    expect(llamadas(query, /INSERT INTO reservation_groups/)).toHaveLength(0);
  });

  it('una plaza elegida que esta ocupada falla con resource_conflict y dice cual', async () => {
    const query = fakeDb([
      [/FROM reservation_groups\s+WHERE establishment_id = \$1\s+AND service_type = \$2\s+AND resource_number = \$3/, [{ id: 9 }]]
    ]);
    const pedido = { pileta: false, cocheras: [{ plaza: 45, vehiclePlate: 'AB123CD', totalPrice: null, motivoAjuste: null }] };

    const r = await crearIncluidos(query, { ...EST, parking_capacity: 100 }, CARPA, pedido);

    expect(r).toMatchObject({ error: 'resource_conflict', status: 409 });
    expect(r.message).toContain('45');
  });

  it('bloquea la plaza antes de revisar si esta libre', async () => {
    const query = fakeDb([[/INSERT INTO reservation_groups/, insertDevuelve]]);
    const pedido = { pileta: false, cocheras: [{ plaza: 2, vehiclePlate: 'AB123CD', totalPrice: null, motivoAjuste: null }] };

    await crearIncluidos(query, EST, CARPA, pedido);

    const orden = query.mock.calls.map(([sql]) => (/pg_advisory_xact_lock/.test(sql) ? 'lock' : /resource_number = \$3/.test(sql) ? 'check' : null)).filter(Boolean);
    expect(orden.slice(0, 2)).toEqual(['lock', 'check']);
  });
});

describe('crearIncluidos: pileta', () => {
  it('crea el pase incluido en cero pesos y le asigna el titular si su ficha esta completa', async () => {
    const query = fakeDb([
      [/INSERT INTO reservation_groups/, insertDevuelve],
      [/FROM clients/, [{ id: 7, full_name: 'Lucia Gomez', document_number: '30111222', birth_date: '1990-05-01' }]],
      [/FROM pase_pileta_personas pp/, [{ guest_id: null, client_id: 7, full_name: 'Lucia Gomez', document_number: '30111222', age: null, birth_date: '1990-05-01' }]]
    ]);

    const r = await crearIncluidos(query, EST, CARPA, { pileta: true, cocheras: [] });

    expect(r.pileta).toMatchObject({ asignados: 1 });
    const insert = llamadas(query, /INSERT INTO reservation_groups/)[0][1];
    expect(insert[1]).toBe('pileta');
    expect(insert[8]).toBe(0); // total
    expect(llamadas(query, /INSERT INTO pase_pileta_personas/)).toHaveLength(1);
  });

  it('con la ficha del titular incompleta el pase queda sin asignar', async () => {
    const query = fakeDb([
      [/INSERT INTO reservation_groups/, insertDevuelve],
      [/FROM clients/, [{ id: 7, full_name: 'Lucia Gomez', document_number: null, birth_date: null }]]
    ]);

    const r = await crearIncluidos(query, EST, CARPA, { pileta: true, cocheras: [] });

    expect(r.pileta).toMatchObject({ asignados: 0 });
    expect(llamadas(query, /INSERT INTO pase_pileta_personas/)).toHaveLength(0);
  });
});

describe('sincronizarIncluidos', () => {
  it('al cancelar la carpa cancela sus incluidos y cuenta los pases pagos asociados', async () => {
    const query = fakeDb([[/COUNT\(\*\)/, [{ n: 1 }]]]);

    const r = await sincronizarIncluidos(query, 1, CARPA, { cancelada: true });

    expect(r).toEqual({ adicionalesAsociados: 1 });
    const update = llamadas(query, /UPDATE reservation_groups SET status = 'cancelled'/)[0];
    expect(update[0]).toContain("vinculo = 'incluido'");
    expect(update[1]).toEqual([60]);
  });

  it('al mover las fechas mueve los incluidos', async () => {
    const query = fakeDb([
      [/SELECT id, service_type, resource_number, total_price, precio_tarifa, desglose, motivo_ajuste FROM reservation_groups/, [{ id: 501, service_type: 'pileta', resource_number: 1 }]],
      [/COUNT\(\*\)/, [{ n: 0 }]]
    ]);

    const r = await sincronizarIncluidos(query, 1, { ...CARPA, start_date: '2026-01-12', end_date: '2026-01-22' }, { fechasCambiaron: true });

    expect(r).toEqual({ adicionalesAsociados: 0 });
    const update = llamadas(query, /UPDATE reservation_groups SET start_date/)[0];
    expect(update[1]).toEqual(expect.arrayContaining(['2026-01-12', '2026-01-22', 501]));
  });

  it('si una cochera choca en las fechas nuevas falla sin mover nada', async () => {
    const query = fakeDb([
      [/SELECT id, service_type, resource_number, total_price, precio_tarifa, desglose, motivo_ajuste FROM reservation_groups/, [{ id: 502, service_type: 'parking', resource_number: 45 }]],
      [/resource_number = \$3/, [{ id: 9 }]]
    ]);

    const r = await sincronizarIncluidos(query, 1, CARPA, { fechasCambiaron: true });

    expect(r).toMatchObject({ error: 'resource_conflict', status: 409 });
    expect(r.message).toContain('45');
    expect(llamadas(query, /UPDATE reservation_groups SET start_date/)).toHaveLength(0);
  });

  it('sin cambios no toca nada', async () => {
    const query = fakeDb();
    expect(await sincronizarIncluidos(query, 1, CARPA, {})).toEqual({ adicionalesAsociados: 0 });
    expect(query).not.toHaveBeenCalled();
  });
});

describe('modificarIncluidos', () => {
  it('quitar la pileta cancela el pase incluido', async () => {
    const query = fakeDb();

    const r = await modificarIncluidos(query, EST, CARPA, { pileta: false });

    expect(r.error).toBeUndefined();
    const update = llamadas(query, /UPDATE reservation_groups SET status = 'cancelled'/)[0];
    expect(update[0]).toContain("service_type = 'pileta'");
  });

  it('agregar la pileta reactiva un pase incluido cancelado en vez de crear otro', async () => {
    const query = fakeDb([
      [/SELECT id, status FROM reservation_groups/, [{ id: 501, status: 'cancelled' }]]
    ]);

    await modificarIncluidos(query, EST, CARPA, { pileta: true });

    expect(llamadas(query, /UPDATE reservation_groups SET status = 'active'/)).toHaveLength(1);
    expect(llamadas(query, /INSERT INTO reservation_groups/)).toHaveLength(0);
  });

  it('cancela solo las cocheras incluidas de esta carpa', async () => {
    const query = fakeDb();

    await modificarIncluidos(query, EST, CARPA, { cocherasCanceladas: [502, 503] });

    const update = llamadas(query, /UPDATE reservation_groups SET status = 'cancelled'/)[0];
    expect(update[0]).toContain('incluida_en_reserva_id = $1');
    expect(update[1]).toEqual([60, [502, 503]]);
  });

  it('valida las cocheras nuevas como en el alta', async () => {
    const r = await modificarIncluidos(fakeDb(), EST, CARPA, { cocherasNuevas: [{ plaza: 1 }] });
    expect(r).toMatchObject({ error: 'vehicle_plate_required', status: 400 });
  });
});

describe('rutearPasePersonas', () => {
  const PASE = { id: 501, service_type: 'pileta', vinculo: 'incluido', incluida_en_reserva_id: 60, status: 'active' };
  const guest = (id, extra = {}) => ({ id, full_name: `Persona ${id}`, document_number: `${id}000`, age: 30, birth_date: null, ...extra });

  const db = (guests, extra = []) => fakeDb([
    ...extra,
    [/SELECT \* FROM reservation_groups WHERE id = \$1 AND establishment_id = \$2 AND service_type = 'pileta'/, [PASE]],
    [/SELECT id, client_id, service_type FROM reservation_groups/, [{ id: 60, client_id: 7, service_type: 'carpa' }]],
    [/FROM reservation_guests WHERE reservation_group_id = \$1/, guests],
    [/FROM clients/, [{ id: 7, full_name: 'Lucia', document_number: '30111222', birth_date: '1990-01-01' }]]
  ]);

  it('no deja asignar mas pases que los incluidos', async () => {
    const guests = [1, 2, 3, 4].map((i) => guest(i));
    const r = await rutearPasePersonas(db(guests), EST, 501, 'PUT', { guestIds: [1, 2, 3, 4], incluyeTitular: true });
    expect(r).toEqual({ status: 400, body: { error: 'demasiados_pases', max: 4 } });
  });

  it('una persona sin DNI o edad no puede tener pase', async () => {
    const r = await rutearPasePersonas(db([guest(1, { document_number: null })]), EST, 501, 'PUT', { guestIds: [1] });
    expect(r).toEqual({ status: 400, body: { error: 'persona_incompleta', personas: ['Persona 1'] } });
  });

  it('una persona que no es de la carpa se rechaza', async () => {
    const r = await rutearPasePersonas(db([guest(1)]), EST, 501, 'PUT', { guestIds: [1, 99] });
    expect(r).toEqual({ status: 400, body: { error: 'persona_ajena' } });
  });

  it('una persona que ya tiene otro pase de la carpa se rechaza', async () => {
    const query = db([guest(1)], [[/pp\.pase_id <> \$2/, [{ guest_id: 1, client_id: null }]]]);
    const r = await rutearPasePersonas(query, EST, 501, 'PUT', { guestIds: [1] });
    expect(r).toEqual({ status: 409, body: { error: 'persona_con_pase' } });
  });

  it('reemplaza la lista y recalcula adultos y menores del pase incluido', async () => {
    const query = db([guest(1), guest(2, { age: 8 })], [
      [/FROM pase_pileta_personas pp\s+LEFT JOIN/, [
        { guest_id: 1, client_id: null, full_name: 'Persona 1', document_number: '1000', age: 30, birth_date: null },
        { guest_id: 2, client_id: null, full_name: 'Persona 2', document_number: '2000', age: 8, birth_date: null }
      ]]
    ]);

    const r = await rutearPasePersonas(query, EST, 501, 'PUT', { guestIds: [1, 2] });

    expect(r.status).toBe(200);
    expect(r.body.personas).toHaveLength(2);
    expect(llamadas(query, /DELETE FROM pase_pileta_personas WHERE pase_id = \$1/)).toHaveLength(1);
    expect(llamadas(query, /INSERT INTO pase_pileta_personas/)).toHaveLength(2);
    const conteo = llamadas(query, /UPDATE reservation_groups SET adults_count/)[0];
    expect(conteo[1]).toEqual([1, 1, 501]);
  });

  it('un pase que no existe es 404', async () => {
    const r = await rutearPasePersonas(fakeDb(), EST, 501, 'GET', {});
    expect(r).toEqual({ status: 404, body: { error: 'not_found' } });
  });
});

describe('autoAsignar', () => {
  const base = (asignados) => [
    [/SELECT p\.id, c\.service_type FROM reservation_groups p/, [{ id: 501, service_type: 'carpa' }]],
    [/SELECT COUNT\(\*\)::int AS n FROM pase_pileta_personas/, [{ n: asignados }]],
    [/FROM reservation_guests g/, [{ id: 3, full_name: 'Ana', document_number: '1', age: 20, birth_date: null }]]
  ];

  it('le da pase a la persona nueva si esta completa y quedan lugares', async () => {
    const query = fakeDb(base(2));
    await autoAsignar(query, EST, 60, 3);
    expect(llamadas(query, /INSERT INTO pase_pileta_personas/)).toHaveLength(1);
  });

  it('con los 4 pases asignados no hace nada', async () => {
    const query = fakeDb(base(4));
    await autoAsignar(query, EST, 60, 3);
    expect(llamadas(query, /INSERT INTO pase_pileta_personas/)).toHaveLength(0);
  });

  it('sin pase incluido no hace nada', async () => {
    const query = fakeDb();
    await autoAsignar(query, EST, 60, 3);
    expect(llamadas(query, /INSERT INTO pase_pileta_personas/)).toHaveLength(0);
  });
});

describe('mapVinculo', () => {
  it('arma el resumen de incluidos de una carpa', () => {
    const r = mapVinculo({
      incluida_en_reserva_id: null, vinculo: null,
      vinculadas: [
        { id: 501, serviceType: 'pileta', vinculo: 'incluido', personas: 3 },
        { id: 502, serviceType: 'parking', vinculo: 'incluido', resourceNumber: 45, vehiclePlate: 'AB123CD' },
        { id: 503, serviceType: 'pileta', vinculo: 'adicional', personas: 2 }
      ]
    });
    expect(r.incluidos).toEqual({
      pileta: { id: 501, asignados: 3 },
      cocheras: [{ id: 502, plaza: 45, vehiclePlate: 'AB123CD' }],
      pasesPagos: [{ id: 503, personas: 2 }]
    });
  });

  it('en un servicio incluido dice a que carpa pertenece', () => {
    const r = mapVinculo({ incluida_en_reserva_id: 60, vinculo: 'incluido', incluida_en_numero: 12, incluida_en_tipo: 'carpa', pase_nombres: ['Ana'] });
    expect(r).toMatchObject({ incluidaEnReservaId: 60, vinculo: 'incluido', incluidaEnNumero: 12, incluidaEnTipo: 'carpa', paseNombres: ['Ana'] });
  });
});

describe('enTransaccion', () => {
  const cliente = () => ({ query: vi.fn(async () => ({ rows: [] })) });
  const sqls = (c) => c.query.mock.calls.map(([sql]) => sql);

  it('confirma si todo sale bien', async () => {
    const c = cliente();
    const r = await enTransaccion(c, async () => ({ ok: true }));
    expect(r).toEqual({ ok: true });
    expect(sqls(c)).toEqual(['BEGIN', 'COMMIT']);
  });

  it('vuelve atras si el resultado es un error', async () => {
    const c = cliente();
    const r = await enTransaccion(c, async () => ({ error: 'x' }));
    expect(r).toEqual({ error: 'x' });
    expect(sqls(c)).toEqual(['BEGIN', 'ROLLBACK']);
  });

  it('vuelve atras si el resultado es una respuesta 4xx', async () => {
    const c = cliente();
    await enTransaccion(c, async () => ({ status: 400, body: {} }));
    expect(sqls(c)).toEqual(['BEGIN', 'ROLLBACK']);
  });

  it('vuelve atras y relanza una excepcion', async () => {
    const c = cliente();
    await expect(enTransaccion(c, async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    expect(sqls(c)).toEqual(['BEGIN', 'ROLLBACK']);
  });
});
