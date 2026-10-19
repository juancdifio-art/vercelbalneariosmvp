# Servicios incluidos en la carpa (pileta y cochera)

**Fecha:** 2026-09-26
**Estado:** decisiones cerradas, pendiente de aprobación del spec.
**Alcance:** tres etapas (ver "Etapas"). Reemplaza al borrador "pileta incluida" del mismo día.

---

## 1. Qué se quiere

Al vender una carpa o una sombrilla, el operador le puede sumar **pileta** y **cochera**. Los servicios incluidos son reservas de verdad, que aparecen en sus secciones y calendarios, pero **nacen, se mueven y se cancelan con la carpa**.

La cochera ya se puede incluir hoy, pero está resuelta con dos altas desde el navegador y sin vínculo. Se rehace con el mismo mecanismo que la pileta.

### Decisiones de negocio

**Generales**

- En el modal de la carpa se usan dos tildes: **"Incluye estacionamiento"** (como hoy) e **"Incluye pileta"**.
- **O se guarda todo o no se guarda nada.** Si un incluido no se puede crear (por ejemplo, la plaza está ocupada), la carpa tampoco se guarda. El modal queda abierto con el motivo ("La plaza 45 está ocupada en esas fechas") y el operador corrige.
- **Los incluidos tienen siempre las mismas fechas que la carpa.** Si se cancela la carpa, se cancelan; si cambian sus fechas, se mueven.
- **Con incluidos, la carpa exige cliente guardado** (en las dos APIs). Para no frenar el mostrador, el modal permite **crear un cliente nuevo ahí mismo**.
- **Nada frena el mostrador.** Los datos de las personas se pueden cargar al vender o después, y todo es editable.
- **Máximo 6 personas por unidad de sombra.** Lo dice el contrato, así que **se bloquea**, no solo se avisa.

**Pileta**

- **Cada carpa incluye 4 pases de pileta, dentro del precio de la carpa.** No suman nada al total ni llevan pagos propios.
- **Solo las carpas incluyen pases; las sombrillas no.** A confirmar con el balneario, así que la cantidad es un ajuste del establecimiento y no va fija en el código.
- **Los pases son con nombre.** Cada pase se asigna a una persona de la carpa, que puede ser o no el titular. Para tener pase, la persona necesita **nombre, DNI y edad**. Las personas sin pase siguen necesitando solo el nombre, como hoy.
- **Si hay más de 4 personas, el operador elige quiénes tienen pase.** Por defecto se asignan los primeros con datos completos; el operador lo cambia.
- **Los que quedan sin pase pueden comprar uno pago.** Queda asociado a la carpa pero se muestra distinto: **"Pase pago · Carpa 12"** frente a **"Incluido en Carpa 12"**. También es con nombre.
- **El pase pago no se toca solo** si se cancela la carpa o cambian sus fechas, porque tiene plata de por medio. El sistema avisa y el operador decide.

**Cochera**

- **Se pueden incluir varias cocheras** por carpa, todas opcionales. Cada una lleva su plaza, patente, precio y pago.
- Si no se elige plaza, **el servidor asigna la primera libre** y el modal muestra cuál quedó.
- Desde la cochera se editan **plaza y patente**. Fechas y cancelación, solo desde la carpa.
- Las cocheras cargadas hasta hoy son datos de prueba: **no hay nada que migrar ni vincular.**

### Contexto del contrato (temporada 2026-2027)

- La pileta tiene "costo adicional por temporada o por día" (punto 8). Con lo decidido, eso aplica a los pases **pagos**; los 4 incluidos van dentro del precio de la carpa.
- Temporada del 15/12 al 15/03; pileta de 13:30 a 19:30.
- Máximo 6 personas por unidad de sombra (punto 1). La nómina lista al titular y 5 acompañantes, con nombre y DNI.
- Aparece "Menor de hasta 4-5 años" sin aclarar la regla (ver sección 7).

---

## 2. Cómo funciona hoy

- **Todas las reservas están en `reservation_groups`**, sueltas: lo único que puede unir dos reservas es el `client_id`. Cancelar es un `PATCH` con `status: 'cancelled'`.
- **Pase de pileta:** es una fila con `service_type = 'pileta'` y `resource_number = 1`. Guarda cantidades (`adults_count` / `children_count`) y precio por adulto y por menor por día. No pasa por tarifas. El reporte de ocupación suma `adults_count + children_count` (`api/_handlers/reports/occupancy.js`). El aforo (`pool_max_occupancy`) no se controla.
- **Personas:** el modal de alta solo pide cantidades (`PersonasFields`). Los datos de cada persona se cargan en el detalle de la reserva (`PersonasReserva`, tabla `reservation_guests`, solo `full_name` obligatorio). Son los acompañantes; el titular es el cliente y sus datos están en su ficha (`clients.document_number`, `clients.birth_date`).
- **Cochera incluida:** los modales de carpa y sombrilla tienen "Incluir estacionamiento" (plaza, patente, precio de tarifa, pago inicial). Al guardar, `handleSaveCarpaReservationRange` (`App.jsx`, ~línea 818) y su par de sombrilla (~línea 1217) crean la carpa y **después** disparan un segundo POST para la cochera, con una plaza elegida en el navegador (`findAvailableParkingSpotForRange`). No es atómico, no hay vínculo y cancelar la carpa no toca la cochera.
- **Cliente en el modal:** se elige uno existente (`ClientSearchInput`) o se escribe un nombre suelto. No se puede crear un cliente desde ahí.
- **No hay transacciones en ninguna API.** En `api/index.js`, `db.query` crea y cierra un `Pool` por consulta.
- **El control de superposición es un `SELECT` sin bloqueo** (`api/index.js`, ~línea 1084): dos altas simultáneas de la misma unidad pueden pasar las dos.
- **Diferencia entre APIs:** local exige cliente para un pase de pileta (`pool_client_required`) y producción no.

---

## 3. Enfoque

Cada servicio incluido es una **reserva real** (`reservation_groups`) con una columna que apunta a la carpa. El servidor crea y sincroniza todo **en una transacción**.

Descartados:

- **Flags en la carpa, sin reservas aparte.** No sirve para la cochera: la plaza tiene que ocupar el calendario y chocar con otras reservas.
- **Seguir con varios POST desde el navegador**, como hoy la cochera. No es atómico y no propaga cancelaciones.

---

## 4. Diseño

### 4.1 Datos

Migración nueva `backend/migrate-servicios-incluidos.sql`, idempotente, reflejada en `backend/schema.sql`.

```sql
-- Vinculo de un servicio con la carpa o sombrilla que lo incluye.
ALTER TABLE reservation_groups
  ADD COLUMN IF NOT EXISTS incluida_en_reserva_id INTEGER
    REFERENCES reservation_groups(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS vinculo VARCHAR(10);
-- vinculo: 'incluido'  -> nace, se mueve y se cancela con la carpa (pileta o cochera).
--          'adicional' -> pase de pileta pago, asociado solo para mostrarlo con la carpa.
-- CHECK de valores y "vinculo lleno si y solo si incluida_en_reserva_id lleno":
-- bloque DO $$ que consulta pg_constraint.

-- Un solo pase de pileta incluido por carpa. Cocheras incluidas puede haber varias.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pileta_incluida_unica
  ON reservation_groups(incluida_en_reserva_id)
  WHERE vinculo = 'incluido' AND service_type = 'pileta';

-- Personas que tiene cada pase de pileta con nombre.
CREATE TABLE IF NOT EXISTS pase_pileta_personas (
  id SERIAL PRIMARY KEY,
  establishment_id INTEGER NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  pase_id INTEGER NOT NULL REFERENCES reservation_groups(id) ON DELETE CASCADE,
  guest_id INTEGER REFERENCES reservation_guests(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT pase_persona_una_sola CHECK ((guest_id IS NULL) <> (client_id IS NULL))
);
-- Un acompañante tiene como mucho un pase (incluido o pago).
CREATE UNIQUE INDEX IF NOT EXISTS idx_pase_persona_guest
  ON pase_pileta_personas(guest_id) WHERE guest_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pase_persona_client
  ON pase_pileta_personas(pase_id, client_id) WHERE client_id IS NOT NULL;

-- Ajustes del establecimiento.
ALTER TABLE establishments
  ADD COLUMN IF NOT EXISTS pases_pileta_por_carpa INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS pases_pileta_por_sombrilla INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_personas_por_unidad INTEGER NOT NULL DEFAULT 6;
```

- **Una persona del pase es un acompañante (`guest_id`) o el titular (`client_id`)**, nunca las dos cosas. Nombre, DNI y edad se leen de `reservation_guests` o de `clients` y no se copian: si se corrige un DNI, el pase lo refleja.
- **Que el titular no tenga dos pases de la misma carpa** (incluido y pago) lo valida la API, porque el titular no pertenece a una sola reserva.
- **El pase incluido** tiene `daily_price = 0`, `total_price = 0` y precios de pileta en `NULL`.
- **`adults_count` / `children_count` del pase con nombre** se recalculan desde las personas asignadas, para que el reporte de ocupación siga sumando bien sin cambios. Para separar adultos de menores se usa **menor = menos de 18 años**. En el pase incluido esa división es informativa; en el pago, ver 4.3.
- **La edad de una persona:** si tiene fecha de nacimiento, se calcula de ahí; si no, vale la edad cargada. Mismo criterio que `reservation_guests`. El titular solo tiene `birth_date` en la ficha, así que para asignarle pase su ficha necesita DNI y fecha de nacimiento.

### 4.2 API (las dos: `api/index.js` y `backend/src/index.js`)

**Infraestructura común**

- **Helper `withTransaction(fn)` en cada API.** Pide un cliente (`pool.connect()`), corre `BEGIN` / `COMMIT` / `ROLLBACK` y lo libera en `finally`. En `api/index.js` no se puede usar `db.query` dentro de la transacción.
- **La superposición de una unidad se verifica bloqueando**, con `SELECT id ... FOR UPDATE` sobre las reservas activas de esa unidad dentro de la transacción, o con un advisory lock por `(establecimiento, tipo, unidad)` (convención del equipo: `FOR UPDATE` sobre un `COUNT(*)` no bloquea). Aplica a la carpa y a cada cochera.

**Tope de personas** (carpa y sombrilla, en POST y PATCH)

- Si `adults_count + children_count` supera `max_personas_por_unidad`, se rechaza con **400 `too_many_people`**. La cantidad incluye al titular.
- `POST /reservation-groups/:id/guests` rechaza con el mismo error si la reserva ya tiene tantas personas cargadas como el tope.

**POST `/reservation-groups`** (carpa o sombrilla) acepta `incluidos`:

```json
{
  "serviceType": "carpa",
  "resourceNumber": 12,
  "clientId": 34,
  "...": "resto de los campos de hoy",
  "incluidos": {
    "pileta": true,
    "cocheras": [
      { "plaza": 45, "vehiclePlate": "AB123CD", "precio": { "cobrado": 700000, "motivoAjuste": null } },
      { "plaza": null, "vehiclePlate": "AC456EF", "precio": { "cobrado": 600000, "motivoAjuste": null } }
    ]
  }
}
```

- Con `incluidos` no vacío, `clientId` es obligatorio: **400 `client_required`**.
- `pileta: true` solo si el establecimiento tiene `has_pileta` y la cantidad de pases para ese tipo de unidad es mayor que 0. Si no, **400 `pileta_no_incluible`**.
- `cocheras` solo si tiene `has_parking`. Cada cochera pasa por las mismas validaciones que una reserva de estacionamiento suelta: patente obligatoria y normalizada (`vehicle_plate_required`), superposición (`resource_conflict`) y tarifa con `api/_tarifas/` (si difiere, `motivoAjuste`). Con `plaza: null`, el servidor elige la primera libre del rango que no esté ya pedida en el mismo request.
- Sin plaza libre: **409 `parking_unavailable`**. Con plaza ocupada: **409 `resource_conflict`**, y el `message` dice cuál (la carpa o la cochera en la plaza 45).
- Todo en una transacción: carpa, pase incluido (si va) y cocheras. **Si algo falla, no queda nada.**
- **Si la pileta va y el titular tiene DNI y fecha de nacimiento**, se le asigna un pase de entrada. Si no, el pase queda con 0 asignados.
- Responde con la carpa y sus incluidos (con la plaza de cada cochera, para que el modal muestre las que asignó el servidor).

**PATCH de la carpa**

- **`status: 'cancelled'`** → cancela sus incluidos (`vinculo = 'incluido'`). Los pases pagos asociados no se tocan; la respuesta trae `adicionalesAsociados: n` para que el frontend avise.
- **Cambio de fechas** → mueve los incluidos a las mismas fechas, revalidando la superposición de cada cochera (misma respuesta 409 con el detalle). Los pagos asociados no se mueven; mismo aviso.
- **Cambio de personas** → valida el tope. Si la cantidad baja por debajo de los pases asignados, no se desasigna nada solo; el detalle lo muestra.
- **`incluidos.pileta: true | false`** → agrega el pase incluido o lo cancela.
- **`incluidos.cocherasNuevas: [...]`** → agrega cocheras, con el mismo formato y validaciones que en el POST.
- **`incluidos.cocherasCanceladas: [id, ...]`** → cancela esas cocheras (tienen que ser incluidas de esta carpa).
- Todo en transacción.

**PATCH de un incluido**

- **Pase de pileta incluido:** se rechaza con **409 `servicio_incluido_no_editable`**. Las personas se asignan con el endpoint de abajo; lo demás, desde la carpa.
- **Cochera incluida:** acepta solo `resourceNumber` (plaza) y `vehiclePlate`, con las validaciones de siempre. Fechas, estado o cliente se rechazan con `servicio_incluido_no_editable`.
- **Pase pago asociado:** se edita como cualquier pase.

**Personas de un pase: `PUT /reservation-groups/:paseId/pase-personas`**

```json
{ "guestIds": [101, 102, 104], "incluyeTitular": true }
```

- Reemplaza la lista de personas del pase. En el router de producción va con `segments[3] === 'pase-personas'`, como `payments`.
- Cada `guestId` tiene que ser una persona de **la carpa** asociada al pase. `incluyeTitular` usa el cliente de la carpa.
- Cada persona tiene que tener nombre, DNI y edad: si no, **400 `persona_incompleta`**, con la lista de quiénes faltan.
- Pase incluido: como mucho la cantidad del ajuste (4 en carpas): si no, **400 `demasiados_pases`**.
- Una persona que ya tiene otro pase de la misma carpa: **409 `persona_con_pase`**.
- Recalcula `adults_count` / `children_count` del pase. En transacción, con `FOR UPDATE` sobre la fila del pase.
- `GET` en la misma ruta devuelve las personas con nombre, DNI y edad.

**Asignación por defecto**

- Al agregar un acompañante con nombre, DNI y edad a una carpa cuyo pase incluido tiene lugar, el servidor se lo asigna (en la misma transacción que el alta). Al completar el DNI o la edad de alguien que no los tenía, lo mismo. El operador puede desasignarlo.
- Al borrar un acompañante, su lugar en el pase se libera solo (`ON DELETE CASCADE`).

**Pase pago asociado**

- Es el `POST` de pase de siempre con `incluidaEnReservaId` (la carpa) y `vinculo: 'adicional'`. Después se le asignan personas con `pase-personas`, sin tope salvo el de la carpa.
- Sus fechas por defecto son las de la carpa, pero se pueden cambiar (la regla de "mismas fechas" es solo para los incluidos).

**Establecimiento:** `GET` y `PUT /establishment` leen y guardan `pasesPiletaPorCarpa`, `pasesPiletaPorSombrilla` y `maxPersonasPorUnidad`.

**GET de reservas:** cada reserva trae `incluidaEnReservaId` y `vinculo`. La carpa trae un resumen:

```json
"incluidos": {
  "pileta": { "id": 501, "pases": 4, "asignados": 3 },
  "cocheras": [{ "id": 502, "plaza": 45, "vehiclePlate": "AB123CD" }],
  "pasesPagos": [{ "id": 503, "personas": 2 }]
}
```

### 4.3 Pantallas

**Modal de nueva reserva y de edición (carpa y sombrilla)**

- **Cliente:** junto al buscador, un botón **"+ Nuevo cliente"** que abre la ficha de cliente de siempre (`ClientFormModal`) y, al guardarla, deja el cliente elegido en la reserva. Si hay algún incluido tildado y no hay cliente elegido, el modal no deja guardar y lo dice.
- **Personas:** si adultos + menores supera el tope, el modal no deja guardar: "Máximo 6 personas por unidad".
- **"Incluye pileta":** visible si el establecimiento tiene pileta y ese tipo de unidad da pases. Debajo: "4 pases de pileta incluidos. Se asignan a las personas desde el detalle de la reserva."
- **"Incluye estacionamiento":** el de hoy, más **"+ Agregar otra cochera"**. Cada cochera tiene plaza (opcional), patente, precio y pago inicial. En la edición lista las cocheras incluidas, con opción de quitar y de agregar.
- **Al guardar se manda todo en un solo request.** Se saca la segunda alta de `handleSaveCarpaReservationRange` y de `handleSaveSombrillaReservationRange`, y el uso de `findAvailableParkingSpotForRange` en ese flujo. El armado de `incluidos` va en un helper aparte (`frontend/src/lib/incluidos.js`) con tests, no en `App.jsx`.
- Si el servidor responde 409, el modal queda abierto con el mensaje. Si el servidor asignó plazas, el aviso de éxito dice cuáles.

**Detalle de la carpa (`ReservationDetailsModal` / `PersonasReserva`)**

- **Personas:** el titular aparece primero, con los datos de su ficha. Cada persona tiene un tilde **"Pileta"**, con un contador "3 de 4 pases asignados". El tilde está deshabilitado para quien no tiene DNI o edad ("Completá DNI y edad para darle pase") y cuando no quedan pases. Una persona con pase pago muestra "Pase pago" en lugar del tilde.
- **Servicios incluidos:** pileta (pases asignados) y cocheras (plaza y patente).
- **Pases pagos asociados**, con sus personas y su saldo.
- **Botón "Vender pase de pileta":** abre `PoolPassModal` con las fechas y el cliente de la carpa, y la lista de personas de la carpa **sin pase** para marcar. Adultos y menores se precargan según la edad (menor = menos de 18) y se pueden corregir, porque el precio del pase pago sale de esas cantidades, como hoy.
- **Al cancelar o cambiar fechas** de una carpa con pases pagos asociados: "Esta carpa tiene 1 pase pago asociado. Revisalo."

**Secciones Pileta y Estacionamiento, y sus calendarios**

- Pase incluido: marca **"Incluido en Carpa 12"**, con los nombres. En vez de editar, **"Ir a la reserva"**.
- Pase pago asociado: **"Pase pago · Carpa 12"**. Se edita como cualquier pase.
- Cochera incluida: **"Incluida en Carpa 12"**. Permite editar plaza y patente; para lo demás, "Ir a la reserva".

**Comprobante (`generateReceipt`):** líneas "Pileta incluida: 4 pases (Juan Pérez, Ana Pérez, …)" y "Cochera incluida: plaza 45, AB123CD".

**Configuración del establecimiento (`EstablishmentConfigForm`):** tres campos nuevos: pases de pileta por carpa, pases por sombrilla y máximo de personas por unidad.

### 4.4 Pagos y reportes

- **Pase incluido:** precio 0, sin pagos. No aparece en ingresos.
- **Cocheras:** su propio precio de tarifa y sus propios pagos, como hoy. El pago inicial de cada una sigue siendo un POST aparte después de crear todo: si falla, la reserva queda sin ese pago y se carga a mano, sin romper la consistencia entre reservas.
- **Pase pago:** precio y pagos propios, como cualquier pase.
- **Ocupación:** sin cambios en el reporte. El pase con nombre mantiene `adults_count` / `children_count` iguales a sus personas asignadas; cada cochera cuenta como una plaza.

---

## 5. Etapas

Cada etapa se puede mergear y probar por separado.

1. **Base y cochera.** Transacciones y bloqueo de superposición en las dos APIs. Columnas de vínculo. Cocheras incluidas del lado del servidor (varias), con su pantalla. "+ Nuevo cliente" en el modal. Cliente obligatorio con incluidos. Tope de personas y ajustes del establecimiento.
2. **Pileta incluida.** Pase incluido al vender y al editar. Tabla `pase_pileta_personas`, endpoint `pase-personas`, asignación por defecto, tilde "Pileta" en el detalle, marcas en la sección Pileta.
3. **Pase pago asociado.** "Vender pase de pileta" desde la carpa, marca "Pase pago", avisos al cancelar o mover la carpa.

## 6. Fuera de alcance

- **Precio de pileta en el módulo de tarifas** (por día y por temporada). Se hace en un cambio aparte; hasta entonces, el precio del pase pago se sigue tipeando.
- **Usuarios múltiples y roles**, y después el **control de acceso a la pileta desde el celular**, con el aforo. Van en specs propios. Este spec deja lo que esos necesitan: cada pase dice quiénes pueden entrar, con nombre y DNI.
- **Pases sueltos (sin carpa) con nombre.** Siguen con cantidades hasta el spec de control de acceso.
- **Tarifas que traigan los incluidos tildados por defecto** (por ejemplo, "el sector Premium siempre incluye pileta").

## 7. Para consultar con el balneario

- **¿Las sombrillas incluyen pases de pileta?** Por ahora no (ajuste en 0).
- **"Menor de hasta 4-5 años":** ¿cuenta para el máximo de 6? ¿Necesita pase? Por ahora cuenta como una persona más.
- **Edad de corte entre adulto y menor** para el precio de pileta. Se usa menos de 18 como precarga editable.

## 8. Riesgos

- **Olvidarse de una de las dos APIs.** Es la trampa conocida del repo. Los tests en `api/` cubren producción; en local, los flujos de la sección 9 se prueban a mano.
- **Transacciones nuevas.** No hay un patrón previo. El mock de `pg` de los tests (`api/test/pg-mock.js`, sembrado en `require.cache`) tiene que soportar `connect()` y un cliente con `query` y `release`.
- **Frontend y backend salen juntos.** Si sale uno solo, la cochera se crea dos veces o ninguna.
- **Tope de personas en reservas existentes.** Una reserva con más de 6 no se podrá editar sin bajar la cantidad. Hoy son datos de prueba.
- **Cambio de comportamiento visible:** una carpa con cochera ya no se guarda si la cochera falla. Avisar al operador en el manual de uso.

## 9. Cómo verificarlo

1. Crear la Carpa 12 del 10/01 al 20/01, con 3 adultos y 2 menores, con pileta y dos cocheras (una en la plaza 45 y otra sin plaza). Aparecen el pase en Pileta ("Incluido en Carpa 12") y las dos cocheras en Estacionamiento; el aviso dice qué plaza asignó el servidor.
2. Crear otra carpa con cochera en la plaza 45 en fechas superpuestas. No se guarda nada y el modal dice que la plaza 45 está ocupada.
3. Crear una carpa con 7 personas. No deja.
4. Crear una carpa con incluidos sin cliente. No deja; crear el cliente con "+ Nuevo cliente" desde el modal y guardar.
5. En el detalle de la Carpa 12, cargar 5 acompañantes, 4 con DNI y edad. Los pases se asignan solos hasta completar 4; el que no tiene datos no se puede tildar. Cambiar a mano quién tiene pase.
6. Vender un pase pago al quinto acompañante desde la carpa. Aparece "Pase pago · Carpa 12" con su precio.
7. Cambiar las fechas de la Carpa 12. El pase incluido y las cocheras se mueven; el pase pago no, y aparece el aviso.
8. Cambiar la patente y la plaza desde una cochera. Deja. Cambiar sus fechas desde la cochera: no deja y ofrece ir a la carpa.
9. Quitar una cochera desde la edición de la carpa. Queda cancelada.
10. Cancelar la Carpa 12. El pase incluido y las cocheras quedan cancelados; el pase pago no, con aviso.
11. Una sombrilla no muestra el tilde de pileta (ajuste en 0), pero sí el de cochera.
12. El reporte de ocupación de la pileta cuenta las personas asignadas.
13. Todo lo anterior en local (puerto 9000) y en Vercel.

---

## 10. Ampliaciones posteriores a la aprobación

### 10.1 Personas en el alta (30/09)

El modal de alta de carpa y sombrilla muestra una fila por persona (adultos + menores, sin pasar el tope). El titular va primero con los datos de su ficha; el DNI y la fecha de nacimiento que se completen ahí **se guardan en la ficha del cliente**. Los acompañantes (nombre, DNI, edad) son **de esa reserva**, no del cliente. Con "Incluye pileta", cada fila tiene un botón para darle o sacarle el pase; por defecto lo tienen los primeros con datos completos, hasta la cantidad de pases. Todo viaja en el POST de la carpa (`personas`, `titular`) y se guarda en su transacción (`completarAlta`).

### 10.2 Cuenta única (06/10)

Reemplaza la decisión G2 ("cada servicio se cobra por su lado").

- **Pases pagos desde el alta.** Cada fila de persona tiene dos botones excluyentes: "Incluido" (hasta la cantidad de pases) y "Pase pago". Los dos piden DNI y edad. El pase pago no depende de que la carpa incluya pileta, solo de que el balneario tenga pileta.
- **Precio del pase pago:** por día, uno para adulto y otro para menor (menor = menos de 18, por la edad de la fila). Total = (adultos × precio adulto + menores × precio menor) × días de la carpa. Cuando la pileta entre en tarifas, esos precios se cargan solos.
- **Resumen de la cuenta** al final del modal: subtotal de la carpa, de la pileta paga y de cada cochera, y el total.
- **Un solo pago**, parcial o total, por toda la cuenta. No puede superar el total.
- **Reparto:** el pago se imputa en orden: la carpa, después las cocheras (por orden de alta) y al final la pileta paga. Cada parte queda como un pago de su reserva (`reservation_payments`), así los reportes por rubro no cambian.
- **En el servidor:** el POST acepta `pasePago: { precioAdultoPorDia, precioMenorPorDia }`, `personas[].pasePago`, `titular.pasePago` y `pagoInicial: { monto, metodo }`. La carpa, sus servicios, el pase pago con sus personas y el pago van en la misma transacción.
- **Pagos posteriores:** `POST /reservation-groups/:id/pago-cuenta` cobra contra el saldo total de la carpa con todo lo suyo y lo reparte en el mismo orden. El detalle de la carpa muestra ese saldo total. Las cocheras y los pases se siguen pudiendo pagar por separado.
- **Columna del medio de pago:** local guarda `method` y producción `payment_method`. El reparto vive en `_incluidos` y cada API le pasa su propia función para insertar el pago.
