# Servicios incluidos en la carpa — Plan de implementación

> **Para quien ejecute:** usar superpowers:executing-plans. Los pasos usan checkbox (`- [ ]`).
> Este plan lo ejecuta en la misma sesión quien lo escribió (pedido del usuario: "hagamos todo lo decidido, después lo pruebo"). Por eso las tareas fijan archivos, interfaces y casos de prueba; el código se escribe con TDD en cada tarea.

**Objetivo:** que una carpa o sombrilla pueda incluir pileta (4 pases con nombre) y una o varias cocheras, creadas y sincronizadas por el servidor en una transacción.

**Arquitectura:** la lógica vive en un módulo compartido `api/_incluidos/`, con el mismo patrón que `api/_tarifas/`: funciones puras en `reglas.js` y funciones que reciben `query` en `servicio.js`. Las dos APIs (`api/index.js` y `backend/src/index.js`) solo lo cablean. El frontend manda todo en un solo request y refresca los datos después de cada cambio.

**Stack:** Node (CommonJS) + pg, Vitest + supertest en `api/`, React + Vitest en `frontend/`.

**Spec:** `docs/superpowers/specs/2026-09-26-servicios-incluidos-design.md`

## Restricciones globales

- Los endpoints nuevos van en **las dos APIs**; `backend/src/index.js` requiere `../../api/_incluidos/*` igual que `_tarifas`.
- En `api/index.js`, `db.query` abre y cierra un pool por consulta: dentro de una transacción se usa un cliente de `pool.connect()`.
- Migraciones idempotentes; los constraints con bloque `DO $$` que consulta `pg_constraint`. Reflejar todo en `backend/schema.sql`.
- Pases por carpa = 4, por sombrilla = 0, máximo de personas por unidad = 6 (ajustes del establecimiento, con esos defaults).
- Menor = menos de 18 años.
- Datos obligatorios para tener pase: nombre, DNI y edad (o fecha de nacimiento).
- Códigos de error: `too_many_people`, `client_required`, `pileta_no_incluible`, `parking_unavailable`, `resource_conflict`, `servicio_incluido_no_editable`, `persona_incompleta`, `demasiados_pases`, `persona_con_pase`.

## Puntos a vigilar

1. **Dos cocheras del mismo request sin plaza:** el servidor no puede asignarles la misma plaza.
2. **Cochera que choca al mover las fechas de la carpa:** tiene que fallar todo, sin mover la carpa.
3. **Cancelar una carpa con pase pago asociado:** el pase pago sigue activo y la respuesta informa `adicionalesAsociados`.
4. **Borrar un acompañante con pase:** se libera el lugar y el conteo del pase baja.
5. **Carpa sin cliente y con incluidos:** 400 antes de tocar la base.

---

## Etapa 1 — Base

### Tarea 1: Migración y esquema

**Archivos:** crear `backend/migrate-servicios-incluidos.sql`; modificar `backend/schema.sql`.

- [ ] Columnas `reservation_groups.incluida_en_reserva_id` y `vinculo`, constraints `reservation_groups_vinculo_valido` y `reservation_groups_vinculo_coherente`, índice `idx_pileta_incluida_unica`, índice `idx_reservation_groups_incluida`.
- [ ] Tabla `pase_pileta_personas` con `pase_persona_una_sola` e índices `idx_pase_persona_guest` y `idx_pase_persona_client`.
- [ ] `establishments.pases_pileta_por_carpa`, `pases_pileta_por_sombrilla` y `max_personas_por_unidad`.
- [ ] Aplicar en la base local (`psql -d balnearios_mvp -f ...`) dos veces para comprobar que es idempotente.
- [ ] Commit.

### Tarea 2: Reglas puras (`api/_incluidos/reglas.js`)

**Produce:**
- `edadDe({ age, birthDate }, hoy = new Date()) -> number|null`
- `esMenor(edad) -> boolean` (menos de 18)
- `personaCompleta({ fullName, documentNumber, age, birthDate }) -> boolean`
- `contarPorEdad(personas) -> { adults, children }`
- `pasesIncluidos(est, serviceType) -> number`
- `maxPersonas(est) -> number`
- `validarTope(est, adults, children) -> null | 'too_many_people'`
- `normalizarPedido(incluidos, est, serviceType) -> { error } | { pileta: boolean, cocheras: [{ plaza: number|null, vehiclePlate, totalPrice, motivoAjuste }] }`
- `validarEdicionIncluido(current, body) -> null | 'servicio_incluido_no_editable'`

**Test:** `api/incluidos-reglas.test.js`. Casos: edad desde fecha y desde número; menor de 18; persona sin DNI incompleta; tope 6 por defecto y configurable; pases 4/0 por defecto; pedido con cochera sin patente -> `vehicle_plate_required`; pileta en sombrilla con 0 pases -> `pileta_no_incluible`; sin `has_parking` -> `parking_no_incluible`; pase incluido no editable; cochera incluida acepta plaza y patente y rechaza fechas, estado y cliente.

- [ ] Test que falla -> implementación -> test en verde -> commit.

### Tarea 3: Servicio con base (`api/_incluidos/servicio.js`, `api/_incluidos/transaccion.js`)

**Produce:**
- `enTransaccion(client, fn)`: `BEGIN`, corre `fn(query)`; si devuelve `{ error }` hace `ROLLBACK` y lo devuelve, si no, `COMMIT`; ante una excepción, `ROLLBACK` y la relanza.
- `bloquearUnidad(query, estId, serviceType, numero)`: `SELECT pg_advisory_xact_lock(hashtext($1))`.
- `hayConflicto(query, estId, serviceType, numero, desde, hasta, excluirId = null) -> boolean`
- `plazaLibre(query, est, desde, hasta, tomadas) -> number|null`
- `crearIncluidos(query, est, carpa, pedido, tarifas) -> { error, status, message } | { pileta, cocheras }`
- `sincronizarIncluidos(query, estId, carpa, { cancelada, fechasCambiaron }) -> { error, status, message } | { adicionalesAsociados }`
- `modificarIncluidos(query, est, carpa, body.incluidos, tarifas) -> { error } | { pileta, cocheras }`
- `rutearPasePersonas(query, est, paseId, method, body) -> { status, body }` (GET / PUT)
- `autoAsignar(query, estId, carpaId) -> void`
- `recalcularConteo(query, paseId) -> void`

**Test:** `api/incluidos-servicio.test.js`, con una `query` falsa que responde según el SQL. Casos: dos cocheras sin plaza reciben plazas distintas; sin plaza libre -> 409 `parking_unavailable`; plaza ocupada -> 409 `resource_conflict` con el mensaje de la plaza; mover fechas con choque de cochera -> error; cancelar -> cancela incluidos y cuenta adicionales; asignar más de 4 -> `demasiados_pases`; persona sin DNI -> `persona_incompleta`; persona con otro pase -> `persona_con_pase`; `autoAsignar` llena solo los lugares libres con personas completas.

- [ ] `pg-mock.js`: `Pool.connect()` devuelve un cliente cuyo `query` deja pasar `BEGIN`/`COMMIT`/`ROLLBACK`/`pg_advisory_xact_lock` sin consumir `queryMock` (los registra en `txMock`), para que los tests existentes conserven el orden de sus respuestas.
- [ ] Test que falla -> implementación -> verde -> commit.

### Tarea 4: Cableado en `api/index.js`

- [ ] Establecimiento: GET y POST con `pasesPiletaPorCarpa`, `pasesPiletaPorSombrilla` y `maxPersonasPorUnidad` (el POST conserva el valor si no viene).
- [ ] POST reservation-groups: carpa, sombrilla y parking en transacción con bloqueo; tope; `client_required`; `incluidos`; pase adicional con `incluidaEnReservaId`. La respuesta trae `incluidos`.
- [ ] PATCH: reglas del incluido; carpa cancelada o con fechas nuevas -> `sincronizarIncluidos`; `body.incluidos` -> `modificarIncluidos`; tope si cambian las personas; todo en transacción.
- [ ] GET: `incluidaEnReservaId`, `vinculo`, `incluidaEnNumero`, `incluidaEnTipo`, `paseNombres` y el resumen `incluidos` en la misma consulta (subconsultas `json_agg`).
- [ ] Guests: tope al agregar, `autoAsignar` al agregar o editar, `recalcularConteo` al borrar.
- [ ] Ruta `reservation-groups/:id/pase-personas`.
- [ ] Tests: `api/incluidos-rutas.test.js` (POST con incluidos, `client_required`, `too_many_people`, cancelar con adicionales, PATCH de un pase incluido 409, PUT pase-personas). Ajustar los tests existentes que cambian de orden de consultas.
- [ ] `cd api && npm test` en verde -> commit.

### Tarea 5: Cableado en `backend/src/index.js`

- [ ] Mismos cambios que la Tarea 4, con `pool.connect()` para la transacción. Unificar la respuesta del PATCH de cancelación para que traiga `adicionalesAsociados`.
- [ ] `node -e "require('./backend/src/index.js')"` no tiene que fallar al cargar (con un `PORT` libre) -> commit.

## Etapa 2 y 3 — Frontend

### Tarea 6: Helper `frontend/src/lib/incluidos.js`

**Produce:**
- `armarIncluidos({ incluyePileta, cocheras }) -> objeto | undefined`
- `mensajeErrorIncluidos(data) -> string | null`
- `edadPersona(p)`, `esMenorPersona(p)`, `personaCompletaParaPase(p) -> boolean`
- `contarPorEdad(personas) -> { adults, children }`
- `etiquetaVinculo(group) -> string | null` ("Incluido en Carpa 12" / "Pase pago · Carpa 12")
- `pasesIncluidosPara(establishment, serviceType)`, `maxPersonasPara(establishment)`

**Test:** `frontend/src/lib/incluidos.test.js`.

### Tarea 7: Configuración del establecimiento

- [ ] `EstablishmentConfigForm`: tres campos numéricos. `App.jsx`: mapear y enviar los campos.

### Tarea 8: Modales de carpa y sombrilla

- [ ] Botón "+ Nuevo cliente" (reusa `ClientFormModal`; al guardar, elige el cliente en el formulario abierto).
- [ ] Tope de personas: no deja guardar.
- [ ] Tilde "Incluye pileta" (según ajuste).
- [ ] Cocheras múltiples: la lista `cocheras` reemplaza a los campos sueltos `parkingSpotNumber`/`precioCochera`/`parkingInitialPayment*`; "+ Agregar otra cochera".
- [ ] `App.jsx`: un solo POST con `incluidos`; pago inicial de cada cochera con el id devuelto; sacar la segunda alta y `findAvailableParkingSpotForRange` de ese flujo; mensaje de plazas asignadas; `datosVersion` para refrescar grillas y listas.
- [ ] Ajustar los tests de modales existentes.

### Tarea 9: Edición

- [ ] `ReservationEditModal`: en carpa o sombrilla, tilde pileta y lista de cocheras incluidas (quitar/agregar). En cochera incluida, solo plaza y patente. En pase incluido, sin edición y con "Ir a la reserva".
- [ ] Avisos: `adicionalesAsociados` al cancelar o mover.

### Tarea 10: Detalle de la carpa

- [ ] `PersonasReserva`: titular primero (datos de la ficha), tilde "Pileta" por persona con contador "N de 4", deshabilitado sin DNI o edad, "Pase pago" para quien lo tiene.
- [ ] Sección "Servicios incluidos" y "Pases pagos asociados".
- [ ] "Vender pase de pileta": `PoolPassModal` precargado (fechas, cliente, personas sin pase, adultos y menores por edad) y crea el pase con `incluidaEnReservaId` + `vinculo: 'adicional'`, y después sus personas.
- [ ] Reemplazar la búsqueda heurística de la cochera "vinculada" en `handleViewReservationDetails` por el vínculo real.

### Tarea 11: Secciones y comprobante

- [ ] Pileta y Estacionamiento: etiqueta de vínculo y "Ir a la reserva".
- [ ] `generateReceipt`: líneas de pileta incluida y cochera incluida.

### Tarea 12: Cierre

- [ ] `cd api && npm test`, `cd frontend && npm test` y `npm run build` en verde.
- [ ] `CLAUDE.md`: módulo `_incluidos` y convención de transacciones.
- [ ] Commit final.
