// Servicios incluidos contra la base. Como _tarifas/servicio.js, no importa pg:
// recibe la funcion query, asi lo comparten api/index.js y backend/src/index.js.
// Todo lo que escribe se llama dentro de una transaccion (ver transaccion.js):
// los errores se devuelven como { error, status, message } para que el
// llamador vuelva atras.
// Spec: docs/superpowers/specs/2026-09-26-servicios-incluidos-design.md

const tarifas = require('../_tarifas/servicio');
const reglas = require('./reglas');

const { fechaISO } = tarifas;
const falla = (status, error, message) => (message ? { status, error, message } : { status, error });

// ---------- Unidades: bloqueo y disponibilidad ----------

// Serializa las altas y cambios de una misma unidad hasta el fin de la
// transaccion. Un SELECT de superposicion sin bloqueo deja pasar dos altas
// simultaneas de la misma plaza.
async function bloquearUnidad(query, estId, serviceType, numero) {
  await query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${estId}:${serviceType}:${numero}`]);
}

async function hayConflicto(query, estId, serviceType, numero, desde, hasta, excluirId = null) {
  const r = await query(
    `SELECT id FROM reservation_groups
     WHERE establishment_id = $1
       AND service_type = $2
       AND resource_number = $3
       AND status = 'active'
       AND NOT (end_date < $4::date OR start_date > $5::date)
       AND ($6::int IS NULL OR id <> $6::int)
     LIMIT 1`,
    [estId, serviceType, numero, desde, hasta, excluirId]
  );
  return r.rows.length > 0;
}

// Bloquea la unidad y confirma que sigue libre.
async function reservarUnidad(query, estId, serviceType, numero, desde, hasta, excluirId = null) {
  await bloquearUnidad(query, estId, serviceType, numero);
  return !(await hayConflicto(query, estId, serviceType, numero, desde, hasta, excluirId));
}

// Primera plaza libre del rango que no este ya tomada en este mismo pedido.
async function plazaLibre(query, est, desde, hasta, tomadas) {
  const capacidad = Number.parseInt(est.parking_capacity, 10) || 0;
  const ocupadas = await query(
    `SELECT DISTINCT resource_number FROM reservation_groups
     WHERE establishment_id = $1 AND service_type = 'parking' AND status = 'active'
       AND NOT (end_date < $2::date OR start_date > $3::date)`,
    [est.id, desde, hasta]
  );
  const ocupada = new Set(ocupadas.rows.map((r) => Number(r.resource_number)));
  for (let n = 1; n <= capacidad; n += 1) {
    if (ocupada.has(n) || tomadas.has(n)) continue;
    // Entre la lista y el bloqueo otra alta pudo tomarla: se confirma bloqueada.
    if (await reservarUnidad(query, est.id, 'parking', n, desde, hasta)) return n;
  }
  return null;
}

// ---------- Alta de reservas vinculadas ----------

async function insertarReserva(query, d) {
  const r = await query(
    `INSERT INTO reservation_groups (establishment_id, service_type, resource_number, start_date, end_date, customer_name, customer_phone, daily_price, total_price, notes, status, client_id, adults_count, children_count, pool_adult_price_per_day, pool_child_price_per_day, vehicle_plate, precio_tarifa, desglose, motivo_ajuste, incluida_en_reserva_id, vinculo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
     RETURNING *`,
    [
      d.estId, d.serviceType, d.resourceNumber, d.desde, d.hasta, d.customerName ?? null, d.customerPhone ?? null,
      d.dailyPrice ?? null, d.totalPrice ?? null, null, 'active', d.clientId ?? null, d.adults ?? 0, d.children ?? 0,
      null, null, d.vehiclePlate ?? null, d.precioTarifa ?? null, d.desglose == null ? null : JSON.stringify(d.desglose),
      d.motivoAjuste ?? null, d.carpaId, d.vinculo
    ]
  );
  return r.rows[0];
}

const datosDeCarpa = (carpa) => ({
  estId: carpa.establishment_id,
  desde: fechaISO(carpa.start_date),
  hasta: fechaISO(carpa.end_date),
  customerName: carpa.customer_name,
  customerPhone: carpa.customer_phone,
  clientId: carpa.client_id,
  carpaId: carpa.id
});

async function crearCocheras(query, est, carpa, cocheras) {
  const base = { ...datosDeCarpa(carpa), estId: est.id };
  const tomadas = new Set(cocheras.filter((c) => c.plaza !== null).map((c) => c.plaza));
  const creadas = [];
  for (const c of cocheras) {
    let plaza = c.plaza;
    if (plaza === null) {
      plaza = await plazaLibre(query, est, base.desde, base.hasta, tomadas);
      if (plaza === null) return falla(409, 'parking_unavailable', 'No quedan cocheras libres en esas fechas.');
      tomadas.add(plaza);
    } else if (!(await reservarUnidad(query, est.id, 'parking', plaza, base.desde, base.hasta))) {
      return falla(409, 'resource_conflict', `La plaza ${plaza} está ocupada en esas fechas.`);
    }

    const precio = await tarifas.precioAlCrear(query, est.id, {
      serviceType: 'parking', resourceNumber: plaza, startDate: base.desde, endDate: base.hasta,
      totalPrice: c.totalPrice, motivoAjuste: c.motivoAjuste
    });
    if (precio.error) return falla(400, precio.error);

    const row = await insertarReserva(query, {
      ...base, serviceType: 'parking', resourceNumber: plaza, vehiclePlate: c.vehiclePlate,
      dailyPrice: precio.dailyPrice, totalPrice: precio.totalPrice, precioTarifa: precio.precioTarifa,
      desglose: precio.desglose, motivoAjuste: precio.motivoAjuste, vinculo: 'incluido'
    });
    creadas.push({ id: row.id, plaza, vehiclePlate: c.vehiclePlate, totalPrice: row.total_price ?? null });
  }
  return { cocheras: creadas };
}

// El pase incluido va dentro del precio de la carpa: vale cero y no lleva pagos.
async function crearPileta(query, est, carpa, { asignarTitular = true } = {}) {
  const row = await insertarReserva(query, {
    ...datosDeCarpa(carpa), estId: est.id, serviceType: 'pileta', resourceNumber: 1,
    dailyPrice: 0, totalPrice: 0, vinculo: 'incluido'
  });
  let asignados = 0;
  // El titular ocupa un pase de entrada si su ficha tiene DNI y fecha de nacimiento.
  if (asignarTitular && carpa.client_id) {
    const cli = await query(
      'SELECT id, full_name, document_number, birth_date FROM clients WHERE id = $1 AND establishment_id = $2',
      [carpa.client_id, est.id]
    );
    const titular = cli.rows[0];
    if (titular && reglas.personaCompleta({ fullName: titular.full_name, documentNumber: titular.document_number, birthDate: titular.birth_date })) {
      await insertarPersona(query, est.id, row.id, { clientId: titular.id });
      asignados = (await recalcularConteo(query, est.id, row.id)).length;
    }
  }
  return { id: row.id, asignados };
}

async function crearIncluidos(query, est, carpa, pedido) {
  const resultado = { pileta: null, cocheras: [] };
  if (pedido.pileta) resultado.pileta = await crearPileta(query, est, carpa);
  if (pedido.cocheras.length) {
    const r = await crearCocheras(query, est, carpa, pedido.cocheras);
    if (r.error) return r;
    resultado.cocheras = r.cocheras;
  }
  return resultado;
}

// Todo lo que acompana al alta de una carpa o sombrilla, en su transaccion:
// los datos del titular (van a su ficha), los acompanantes, la pileta con los
// pases elegidos y las cocheras. `personasPedido` sale de
// reglas.normalizarPersonas; si es null, la pileta asigna sola al titular.
async function completarAlta(query, est, carpa, pedido, personasPedido) {
  const titular = personasPedido?.titular || null;
  if (titular && carpa.client_id && (titular.documentNumber || titular.birthDate)) {
    await query(
      'UPDATE clients SET document_number = COALESCE($1, document_number), birth_date = COALESCE($2, birth_date), updated_at = NOW() WHERE id = $3 AND establishment_id = $4',
      [titular.documentNumber, titular.birthDate, carpa.client_id, est.id]
    );
  }

  const guests = [];
  for (const p of personasPedido?.personas || []) {
    const r = await query(
      'INSERT INTO reservation_guests (establishment_id, reservation_group_id, full_name, document_number, age, birth_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [est.id, carpa.id, p.fullName, p.documentNumber, p.age, p.birthDate]
    );
    guests.push({ ...p, id: r.rows[0].id });
  }

  const resultado = { pileta: null, cocheras: [] };

  if (pedido.pileta && personasPedido) {
    // Los pases van exactamente a quienes se eligieron en el alta.
    const elegidos = [];
    if (titular?.pileta && carpa.client_id) {
      const t = (await query(
        'SELECT id, full_name, document_number, birth_date FROM clients WHERE id = $1 AND establishment_id = $2',
        [carpa.client_id, est.id]
      )).rows[0];
      if (t) elegidos.push({ clientId: t.id, fullName: t.full_name, documentNumber: t.document_number, birthDate: t.birth_date });
    }
    for (const g of guests) if (g.pileta) elegidos.push({ ...g, guestId: g.id });

    const incompletas = elegidos.filter((p) => !reglas.personaCompleta(p)).map((p) => p.fullName);
    if (incompletas.length) return { status: 400, error: 'persona_incompleta', personas: incompletas };
    const max = reglas.pasesIncluidos(est, carpa.service_type);
    if (elegidos.length > max) return { status: 400, error: 'demasiados_pases', max };

    const pase = await crearPileta(query, est, carpa, { asignarTitular: false });
    for (const p of elegidos) await insertarPersona(query, est.id, pase.id, { guestId: p.guestId ?? null, clientId: p.clientId ?? null });
    const asignados = elegidos.length ? (await recalcularConteo(query, est.id, pase.id)).length : 0;
    resultado.pileta = { id: pase.id, asignados };
  } else if (pedido.pileta) {
    resultado.pileta = await crearPileta(query, est, carpa);
  }

  if (pedido.cocheras.length) {
    const r = await crearCocheras(query, est, carpa, pedido.cocheras);
    if (r.error) return r;
    resultado.cocheras = r.cocheras;
  }
  return resultado;
}

// ---------- Sincronizacion con la carpa ----------

async function contarAdicionales(query, carpaId) {
  const r = await query(
    "SELECT COUNT(*)::int AS n FROM reservation_groups WHERE incluida_en_reserva_id = $1 AND vinculo = 'adicional' AND status = 'active'",
    [carpaId]
  );
  return Number(r.rows[0]?.n || 0);
}

// Despues de cancelar la carpa o cambiarle las fechas. Los pases pagos
// asociados no se tocan (tienen plata de por medio): solo se cuentan para avisar.
async function sincronizarIncluidos(query, estId, carpa, { cancelada = false, fechasCambiaron = false } = {}) {
  if (!cancelada && !fechasCambiaron) return { adicionalesAsociados: 0 };

  if (cancelada) {
    await query(
      "UPDATE reservation_groups SET status = 'cancelled', updated_at = NOW() WHERE incluida_en_reserva_id = $1 AND vinculo = 'incluido' AND status = 'active'",
      [carpa.id]
    );
    return { adicionalesAsociados: await contarAdicionales(query, carpa.id) };
  }

  const desde = fechaISO(carpa.start_date);
  const hasta = fechaISO(carpa.end_date);
  const incluidos = (await query(
    "SELECT id, service_type, resource_number, total_price, precio_tarifa, desglose, motivo_ajuste FROM reservation_groups WHERE incluida_en_reserva_id = $1 AND vinculo = 'incluido' AND status = 'active' ORDER BY id",
    [carpa.id]
  )).rows;

  // Primero se revisan todas las cocheras: si una choca no se mueve nada.
  for (const inc of incluidos) {
    if (inc.service_type !== 'parking') continue;
    if (!(await reservarUnidad(query, estId, 'parking', inc.resource_number, desde, hasta, inc.id))) {
      return falla(409, 'resource_conflict', `La cochera de la plaza ${inc.resource_number} está ocupada en las fechas nuevas.`);
    }
  }

  for (const inc of incluidos) {
    if (inc.service_type === 'parking') {
      const precio = await tarifas.precioAlEditar(query, estId, inc, {}, {
        recalcular: true, desde, hasta, resourceNumber: inc.resource_number
      });
      if (precio.error) return falla(400, precio.error);
      await query(
        'UPDATE reservation_groups SET start_date = $1, end_date = $2, daily_price = $3, total_price = $4, precio_tarifa = $5, desglose = $6, motivo_ajuste = $7, updated_at = NOW() WHERE id = $8',
        [desde, hasta, precio.dailyPrice ?? null, precio.totalPrice ?? null, precio.precioTarifa, precio.desglose == null ? null : JSON.stringify(precio.desglose), precio.motivoAjuste, inc.id]
      );
    } else {
      await query('UPDATE reservation_groups SET start_date = $1, end_date = $2, updated_at = NOW() WHERE id = $3', [desde, hasta, inc.id]);
    }
  }
  return { adicionalesAsociados: await contarAdicionales(query, carpa.id) };
}

// PATCH de la carpa con `incluidos`: { pileta: true|false, cocherasNuevas, cocherasCanceladas }.
async function modificarIncluidos(query, est, carpa, incluidos = {}) {
  const resultado = { pileta: null, cocheras: [] };

  if (incluidos.pileta === false) {
    await query(
      "UPDATE reservation_groups SET status = 'cancelled', updated_at = NOW() WHERE incluida_en_reserva_id = $1 AND vinculo = 'incluido' AND service_type = 'pileta' AND status = 'active'",
      [carpa.id]
    );
  } else if (incluidos.pileta === true) {
    const pedido = reglas.normalizarPedido({ pileta: true }, est, carpa.service_type);
    if (pedido.error) return falla(400, pedido.error);
    const previo = (await query(
      "SELECT id, status FROM reservation_groups WHERE incluida_en_reserva_id = $1 AND vinculo = 'incluido' AND service_type = 'pileta'",
      [carpa.id]
    )).rows[0];
    if (!previo) {
      resultado.pileta = await crearPileta(query, est, carpa);
    } else if (previo.status !== 'active') {
      // El indice unico no deja un segundo pase incluido: se reactiva el que habia, con sus personas.
      await query(
        "UPDATE reservation_groups SET status = 'active', start_date = $1, end_date = $2, updated_at = NOW() WHERE id = $3",
        [fechaISO(carpa.start_date), fechaISO(carpa.end_date), previo.id]
      );
      resultado.pileta = { id: previo.id };
    }
  }

  const canceladas = (incluidos.cocherasCanceladas || []).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (canceladas.length) {
    await query(
      "UPDATE reservation_groups SET status = 'cancelled', updated_at = NOW() WHERE incluida_en_reserva_id = $1 AND id = ANY($2::int[]) AND vinculo = 'incluido' AND service_type = 'parking'",
      [carpa.id, canceladas]
    );
  }

  if (Array.isArray(incluidos.cocherasNuevas) && incluidos.cocherasNuevas.length) {
    const pedido = reglas.normalizarPedido({ cocheras: incluidos.cocherasNuevas }, est, carpa.service_type);
    if (pedido.error) return falla(400, pedido.error);
    const r = await crearCocheras(query, est, carpa, pedido.cocheras);
    if (r.error) return r;
    resultado.cocheras = r.cocheras;
  }

  return resultado;
}

// ---------- Personas de un pase ----------

async function insertarPersona(query, estId, paseId, { guestId = null, clientId = null }) {
  await query(
    'INSERT INTO pase_pileta_personas (establishment_id, pase_id, guest_id, client_id) VALUES ($1, $2, $3, $4)',
    [estId, paseId, guestId, clientId]
  );
}

const mapPersona = (r) => ({
  guestId: r.guest_id ?? null,
  clientId: r.client_id ?? null,
  fullName: r.full_name,
  documentNumber: r.document_number ?? null,
  age: r.age ?? null,
  birthDate: r.birth_date ? fechaISO(r.birth_date) : null,
  edad: reglas.edadDe({ age: r.age, birthDate: r.birth_date })
});

async function personasDePase(query, estId, paseId) {
  const r = await query(
    `SELECT pp.id, pp.guest_id, pp.client_id,
            COALESCE(g.full_name, cl.full_name) AS full_name,
            COALESCE(g.document_number, cl.document_number) AS document_number,
            g.age,
            COALESCE(g.birth_date, cl.birth_date) AS birth_date
     FROM pase_pileta_personas pp
     LEFT JOIN reservation_guests g ON g.id = pp.guest_id
     LEFT JOIN clients cl ON cl.id = pp.client_id
     WHERE pp.pase_id = $1 AND pp.establishment_id = $2
     ORDER BY (pp.client_id IS NULL), pp.id`,
    [paseId, estId]
  );
  return r.rows.map(mapPersona);
}

// El reporte de ocupacion suma adults_count + children_count: el pase con
// nombre los mantiene iguales a sus personas asignadas.
async function recalcularConteo(query, estId, paseId) {
  const personas = await personasDePase(query, estId, paseId);
  const { adults, children } = reglas.contarPorEdad(personas);
  await query('UPDATE reservation_groups SET adults_count = $1, children_count = $2 WHERE id = $3', [adults, children, paseId]);
  return personas;
}

async function soltarPasesCancelados(query, guestIds) {
  if (!guestIds.length) return;
  await query(
    "DELETE FROM pase_pileta_personas pp USING reservation_groups p WHERE p.id = pp.pase_id AND p.status = 'cancelled' AND pp.guest_id = ANY($1::int[])",
    [guestIds]
  );
}

// GET / PUT /reservation-groups/:paseId/pase-personas. Devuelve { status, body }.
async function rutearPasePersonas(query, est, paseId, method, body = {}) {
  const pase = (await query(
    "SELECT * FROM reservation_groups WHERE id = $1 AND establishment_id = $2 AND service_type = 'pileta'",
    [paseId, est.id]
  )).rows[0];
  if (!pase) return { status: 404, body: { error: 'not_found' } };

  if (method === 'GET') {
    return { status: 200, body: { personas: await personasDePase(query, est.id, paseId) } };
  }
  if (method !== 'PUT') return { status: 405, body: { error: 'method_not_allowed' } };

  if (!pase.incluida_en_reserva_id) return { status: 400, body: { error: 'pase_sin_carpa' } };
  if (pase.status !== 'active') return { status: 409, body: { error: 'pase_cancelado' } };

  const carpa = (await query('SELECT id, client_id, service_type FROM reservation_groups WHERE id = $1', [pase.incluida_en_reserva_id])).rows[0];
  await query('SELECT id FROM reservation_groups WHERE id = $1 FOR UPDATE', [paseId]);

  const guestIds = [...new Set((body.guestIds || []).map(Number))].filter((n) => Number.isInteger(n) && n > 0);
  const incluyeTitular = Boolean(body.incluyeTitular);

  const personas = [];
  if (guestIds.length) {
    const guests = (await query(
      'SELECT id, full_name, document_number, age, birth_date FROM reservation_guests WHERE reservation_group_id = $1 AND establishment_id = $2 AND id = ANY($3::int[])',
      [carpa.id, est.id, guestIds]
    )).rows;
    if (guests.length !== guestIds.length) return { status: 400, body: { error: 'persona_ajena' } };
    for (const g of guests) personas.push({ guestId: g.id, fullName: g.full_name, documentNumber: g.document_number, age: g.age, birthDate: g.birth_date });
  }
  let titularId = null;
  if (incluyeTitular) {
    if (!carpa.client_id) return { status: 400, body: { error: 'sin_titular' } };
    const t = (await query(
      'SELECT id, full_name, document_number, birth_date FROM clients WHERE id = $1 AND establishment_id = $2',
      [carpa.client_id, est.id]
    )).rows[0];
    if (!t) return { status: 400, body: { error: 'sin_titular' } };
    titularId = t.id;
    personas.push({ clientId: t.id, fullName: t.full_name, documentNumber: t.document_number, birthDate: t.birth_date });
  }

  const incompletas = personas.filter((p) => !reglas.personaCompleta(p)).map((p) => p.fullName);
  if (incompletas.length) return { status: 400, body: { error: 'persona_incompleta', personas: incompletas } };

  if (pase.vinculo === 'incluido') {
    const max = reglas.pasesIncluidos(est, carpa.service_type);
    if (personas.length > max) return { status: 400, body: { error: 'demasiados_pases', max } };
  }

  const conOtroPase = await query(
    `SELECT pp.guest_id, pp.client_id FROM pase_pileta_personas pp
     JOIN reservation_groups p ON p.id = pp.pase_id
     WHERE p.incluida_en_reserva_id = $1 AND pp.pase_id <> $2 AND p.status = 'active'
       AND (pp.guest_id = ANY($3::int[]) OR pp.client_id = $4)`,
    [carpa.id, paseId, guestIds, titularId]
  );
  if (conOtroPase.rows.length) return { status: 409, body: { error: 'persona_con_pase' } };

  await query('DELETE FROM pase_pileta_personas WHERE pase_id = $1', [paseId]);
  await soltarPasesCancelados(query, guestIds);
  for (const p of personas) await insertarPersona(query, est.id, paseId, p);

  // En el pase pago adultos y menores fijan el precio y los corrige el
  // operador: solo el incluido se recalcula solo.
  const resultado = pase.vinculo === 'incluido'
    ? await recalcularConteo(query, est.id, paseId)
    : await personasDePase(query, est.id, paseId);
  return { status: 200, body: { personas: resultado } };
}

// Al agregar o completar un acompanante: si esta completo, no tiene pase y el
// pase incluido de su carpa tiene lugar, se le asigna. El operador lo puede quitar.
async function autoAsignar(query, est, carpaId, guestId) {
  const pase = (await query(
    `SELECT p.id, c.service_type FROM reservation_groups p
     JOIN reservation_groups c ON c.id = p.incluida_en_reserva_id
     WHERE p.incluida_en_reserva_id = $1 AND p.vinculo = 'incluido' AND p.service_type = 'pileta' AND p.status = 'active'
     FOR UPDATE OF p`,
    [carpaId]
  )).rows[0];
  if (!pase) return;

  const asignados = Number((await query('SELECT COUNT(*)::int AS n FROM pase_pileta_personas WHERE pase_id = $1', [pase.id])).rows[0]?.n || 0);
  if (asignados >= reglas.pasesIncluidos(est, pase.service_type)) return;

  const g = (await query(
    `SELECT g.id, g.full_name, g.document_number, g.age, g.birth_date FROM reservation_guests g
     WHERE g.id = $1 AND g.reservation_group_id = $2
       AND NOT EXISTS (
         SELECT 1 FROM pase_pileta_personas pp JOIN reservation_groups p ON p.id = pp.pase_id
         WHERE pp.guest_id = g.id AND p.status = 'active'
       )`,
    [guestId, carpaId]
  )).rows[0];
  if (!g || !reglas.personaCompleta({ fullName: g.full_name, documentNumber: g.document_number, age: g.age, birthDate: g.birth_date })) return;

  await soltarPasesCancelados(query, [g.id]);
  await insertarPersona(query, est.id, pase.id, { guestId: g.id });
  await recalcularConteo(query, est.id, pase.id);
}

// Al borrar un acompanante su lugar se libera solo (ON DELETE CASCADE); hay
// que recalcular el conteo de los pases donde estaba.
async function recalcularPases(query, estId, paseIds) {
  for (const id of paseIds) {
    const p = (await query("SELECT vinculo FROM reservation_groups WHERE id = $1", [id])).rows[0];
    if (p?.vinculo === 'incluido') await recalcularConteo(query, estId, id);
  }
}

// Una carpa o sombrilla de este establecimiento, para asociarle un pase pago.
async function carpaParaAsociar(query, estId, id) {
  const r = await query(
    "SELECT id, service_type, client_id FROM reservation_groups WHERE id = $1 AND establishment_id = $2 AND service_type IN ('carpa', 'sombrilla')",
    [id, estId]
  );
  return r.rows[0] || null;
}

// ---------- Lectura: columnas extra del GET de reservas ----------

// Se agregan al SELECT del GET de reservation-groups (alias rg, join padre).
const SQL_COLUMNAS_VINCULO = `
            rg.incluida_en_reserva_id,
            rg.vinculo,
            padre.resource_number AS incluida_en_numero,
            padre.service_type AS incluida_en_tipo,
            (SELECT COALESCE(json_agg(json_build_object(
                'id', i.id, 'serviceType', i.service_type, 'vinculo', i.vinculo,
                'resourceNumber', i.resource_number, 'vehiclePlate', i.vehicle_plate,
                'personas', (SELECT COUNT(*) FROM pase_pileta_personas pp WHERE pp.pase_id = i.id)
              ) ORDER BY i.id), '[]'::json)
             FROM reservation_groups i
             WHERE i.incluida_en_reserva_id = rg.id AND i.status = 'active') AS vinculadas,
            (SELECT COALESCE(json_agg(COALESCE(pg.full_name, pc.full_name) ORDER BY (pp.client_id IS NULL), pp.id), '[]'::json)
             FROM pase_pileta_personas pp
             LEFT JOIN reservation_guests pg ON pg.id = pp.guest_id
             LEFT JOIN clients pc ON pc.id = pp.client_id
             WHERE pp.pase_id = rg.id) AS pase_nombres,`;

const SQL_JOIN_PADRE = `
          LEFT JOIN reservation_groups padre
            ON padre.id = rg.incluida_en_reserva_id`;

const SQL_GROUP_VINCULO = `
            rg.incluida_en_reserva_id,
            rg.vinculo,
            padre.resource_number,
            padre.service_type,`;

function resumenIncluidos(vinculadas) {
  const lista = Array.isArray(vinculadas) ? vinculadas : [];
  const pileta = lista.find((v) => v.serviceType === 'pileta' && v.vinculo === 'incluido');
  return {
    pileta: pileta ? { id: pileta.id, asignados: Number(pileta.personas || 0) } : null,
    cocheras: lista
      .filter((v) => v.serviceType === 'parking' && v.vinculo === 'incluido')
      .map((v) => ({ id: v.id, plaza: v.resourceNumber, vehiclePlate: v.vehiclePlate ?? null })),
    pasesPagos: lista
      .filter((v) => v.serviceType === 'pileta' && v.vinculo === 'adicional')
      .map((v) => ({ id: v.id, personas: Number(v.personas || 0) }))
  };
}

function mapVinculo(row) {
  return {
    incluidaEnReservaId: row.incluida_en_reserva_id ?? null,
    vinculo: row.vinculo ?? null,
    incluidaEnNumero: row.incluida_en_numero ?? null,
    incluidaEnTipo: row.incluida_en_tipo ?? null,
    paseNombres: Array.isArray(row.pase_nombres) ? row.pase_nombres : [],
    incluidos: resumenIncluidos(row.vinculadas)
  };
}

module.exports = {
  bloquearUnidad,
  hayConflicto,
  reservarUnidad,
  plazaLibre,
  crearIncluidos,
  completarAlta,
  sincronizarIncluidos,
  modificarIncluidos,
  personasDePase,
  recalcularConteo,
  recalcularPases,
  rutearPasePersonas,
  autoAsignar,
  carpaParaAsociar,
  mapVinculo,
  SQL_COLUMNAS_VINCULO,
  SQL_JOIN_PADRE,
  SQL_GROUP_VINCULO
};
