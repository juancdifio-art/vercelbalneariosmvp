# Servicios incluidos en la carpa o sombrilla (pileta y cochera)

**Estado:** idea en discusión. No hay nada implementado ni aprobado.

> Este spec empezó como "pileta incluida". Se amplió porque la cochera ya se puede incluir al vender una carpa, pero está resuelta con el enfoque que acá se desaconseja (dos altas desde el navegador, sin vínculo). Las dos cosas se resuelven con el mismo mecanismo.

## El pedido

Al vender una carpa o una sombrilla, el operador puede sumarle:

- **Pileta:** que el sistema cree solo el pase, en vez de cargarlo aparte en la sección Pileta. (Nuevo.)
- **Cochera:** ya existe el tilde "Incluir estacionamiento". Lo que falta es que la cochera quede **vinculada** a la carpa y la acompañe cuando la carpa se cancela o cambia de fechas. (Rehacer lo que hay.)

En los dos casos el servicio incluido es una reserva de verdad, con su precio y sus pagos, pero **nace, se mueve y se cancela con la carpa**.

## Lo que dice el contrato del balneario (temporada 2026-2027)

El contrato de "unidad de sombra" que firma el cliente aclara varias cosas sobre la pileta:

- **La pileta tiene costo adicional** (punto 8): *"El uso de la misma tiene un costo adicional por temporada o por día"*. O sea, "incluye pileta" no quiere decir gratis: el cliente contrata la pileta **además** de la carpa, y se cobra aparte.
- **Se cobra por temporada o por día.** Hoy el sistema solo tiene precio por día (por adulto y por niño). Falta un precio de pileta **por temporada**.
- **La temporada va del 15/12 al 15/03.** La pileta abre de 13:30 a 19:30.
- **Máximo 6 personas por unidad de sombra** (punto 1). Si se pasan, tienen que contratar otra unidad.
- **La nómina lista hasta 6 personas con nombre y DNI:** el titular más 5 acompañantes. Aparece también "Menor de hasta 4-5 años", sin aclarar la regla.

La cochera tiene tarifa propia en `docs/tarifas-temporada-2026-2027.md` (con sombra $700.000, descubierta $600.000 por temporada) y ya pasa por el módulo de tarifas.

## Cómo funciona hoy

### Pileta

- **El pase de pileta es una reserva más.** Es una fila de `reservation_groups` con `service_type = 'pileta'` y `resource_number = 1` fijo. Guarda cantidad de personas (`adults_count` / `children_count`) y precio por adulto y por niño por día (`pool_adult_price_per_day` / `pool_child_price_per_day`). El total es `(adultos × precio adulto + niños × precio niño) × días`.
- **La pileta no pasa por tarifas.** Los precios por persona se tipean en `PoolPassModal` cada vez. El módulo `api/_tarifas/` solo cubre carpa, sombrilla y estacionamiento.
- **Las carpas y sombrillas ya guardan adultos y menores**, en las mismas columnas `adults_count` / `children_count` (spec de personas por reserva, 22/09). Es decir, el dato "cuántas personas" ya está en la reserva de la carpa.
- **El aforo de la pileta (`pool_max_occupancy`) no se controla en ningún lado.** Se configura y se usa en el reporte de ocupación, pero la API deja crear pases de más.
- **Diferencia entre APIs:** `backend/src/index.js` exige cliente guardado para un pase (`pool_client_required`); `api/index.js` no. Hoy un pase sin cliente anda en producción y falla en local.

### Cochera

- **El tilde "Incluir estacionamiento" está en los modales de carpa y de sombrilla** (`CarpaReservationModal`, `SombrillaReservationModal`), con plaza, precio de tarifa (`precioCochera`), pago inicial y medio de pago propios, y la patente.
- **Se guarda con dos altas desde el navegador.** `handleSaveCarpaReservationRange` (`App.jsx`, ~línea 818) y su par de sombrilla (~línea 1217): después de crear la carpa, si `includeParking` está tildado, elige una plaza con `findAvailableParkingSpotForRange` y llama a `handleSaveParkingReservationRange`, que hace su propio POST.
- **Problemas de ese esquema:**
  - **No es atómico.** Si el segundo POST falla, o no quedó plaza, la carpa queda creada sin cochera y solo aparece un aviso.
  - **No hay vínculo.** En la base la cochera es una reserva suelta; lo único que la une a la carpa es el `client_id`. Cancelar la carpa o cambiarle las fechas no toca la cochera.
  - **La plaza la elige el navegador** con el estado que tiene cargado. Si dos operadores cargan a la vez, la API rechaza la segunda cochera por superposición, pero la carpa ya se creó.

### Común

- **No hay ningún vínculo entre reservas.** Cada `reservation_group` está suelto.
- **Cancelar** es un `PATCH` con `status: 'cancelled'`. No hay borrado.
- **No hay transacciones en ninguna de las dos APIs.** Ni `api/index.js` ni `backend/src/index.js` usan `BEGIN` / `COMMIT`. En `api/index.js`, además, `db.query` crea y cierra un `Pool` por consulta, así que dos `db.query` seguidos no comparten conexión. El patrón transaccional hay que crearlo (ver Riesgos).
- **El pago inicial también es un POST aparte**, tanto para la carpa como para la cochera. Eso queda fuera de este cambio: un pago que falla deja la reserva sin ese pago, que se carga a mano, y no rompe la consistencia entre reservas.

## Qué debería pasar

1. En la reserva de carpa o sombrilla hay dos tildes: **"Incluye pileta"** y **"Incluye estacionamiento"** (este ya existe).
2. Al guardar, **el servidor** crea la carpa y los servicios incluidos **en una sola transacción**: se crean todos o ninguno.
   - El pase toma las mismas fechas, cliente y personas que la carpa.
   - La cochera toma las mismas fechas y cliente, más su plaza y su patente.
3. Cada servicio incluido aparece en su sección como cualquier otro, con la marca **"Incluido en Carpa 12"**.
4. Si se cancela la carpa, se cancelan los incluidos. Si cambian las fechas, los incluidos se mueven. Si cambian las personas, el pase se ajusta (la cochera no depende de las personas).

## Enfoques posibles

### A — Reserva real vinculada a la carpa (recomendado)

Cada servicio incluido es una fila más de `reservation_groups` con una columna nueva `incluida_en_reserva_id` que apunta a la reserva de la carpa.

- **A favor:** las secciones Pileta y Estacionamiento, los calendarios, los reportes y el comprobante siguen funcionando sin cambios, porque el pase y la cochera son reservas de verdad. El vínculo deja sincronizar cancelaciones y cambios de fecha. Un solo mecanismo sirve para los dos servicios (y para uno futuro).
- **En contra:** hay que mantener filas sincronizadas, y se escribe en las dos APIs.

### B — Solo flags en la carpa

Se agregan `incluye_pileta` / `incluye_cochera` a la carpa y no se crea ninguna reserva aparte.

- **A favor:** una sola fila, nada que sincronizar.
- **En contra:** no sirve para la cochera: la plaza tiene que aparecer ocupada en el calendario de estacionamiento y chocar con otras reservas, y eso lo resuelve una reserva real. Para la pileta obligaría a que todo lo que lista pases lea dos fuentes.

### C — Que el frontend haga varios POST

Es lo que hace hoy la cochera.

- **A favor:** no toca las APIs.
- **En contra:** no es atómico, no hay vínculo y la cancelación no se propaga. Es justamente lo que este spec quiere reemplazar.

**Recomendación: A**, con la creación de los incluidos **en el servidor**, dentro del mismo POST de la carpa y en una transacción.

## Diseño con el enfoque A

### Datos

```sql
ALTER TABLE reservation_groups
  ADD COLUMN IF NOT EXISTS incluida_en_reserva_id INTEGER
    REFERENCES reservation_groups(id) ON DELETE CASCADE;

-- Como mucho un servicio incluido de cada tipo por carpa.
CREATE UNIQUE INDEX IF NOT EXISTS idx_servicio_incluido_unico
  ON reservation_groups(incluida_en_reserva_id, service_type)
  WHERE incluida_en_reserva_id IS NOT NULL;
```

- La columna solo se llena en reservas `pileta` y `parking`, y solo apunta a una `carpa` o `sombrilla` (lo valida la API).
- El índice único es por `(carpa, tipo de servicio)`: una carpa puede tener un pase **y** una cochera, pero no dos cocheras (ver decisión C2).
- Migración nueva `backend/migrate-servicios-incluidos.sql`, idempotente, y reflejarla en `backend/schema.sql`.
- **Cocheras ya cargadas junto con una carpa no se vinculan solas** (ver decisión C4).

### API (las dos: `api/index.js` y `backend/src/index.js`)

**POST `/reservation-groups`** de una carpa o sombrilla acepta un objeto `incluidos`:

```json
{
  "serviceType": "carpa",
  "resourceNumber": 12,
  "...": "resto de los campos de hoy",
  "incluidos": {
    "pileta": { "precioAdultoPorDia": 5000, "precioMenorPorDia": 3000 },
    "parking": { "plaza": 45, "vehiclePlate": "AB123CD", "precio": { "cobrado": 700000, "motivoAjuste": null } }
  }
}
```

- `pileta` solo si el establecimiento tiene `has_pileta`; `parking` solo si tiene `has_parking`.
- Dentro de una transacción: valida y crea la carpa, después cada incluido con `incluida_en_reserva_id` = id de la carpa.
- **La cochera pasa por las mismas validaciones que una reserva de estacionamiento suelta:** patente obligatoria y normalizada (`vehicle_plate_required`), superposición de plaza (`resource_conflict`) y precio de tarifa con `api/_tarifas/` (si difiere, `motivoAjuste`).
- **Si `plaza` no viene, el servidor elige la primera libre** para el rango, dentro de la transacción. Así la elección no depende del estado que tenga cargado el navegador.
- **Si no hay plaza, falla todo** con `parking_unavailable`, y no se crea la carpa. El modal muestra el error y el operador decide: elegir otra plaza o destildar la cochera.
- Devuelve la carpa y los incluidos creados.

**PATCH de la carpa:**

- `status: 'cancelled'` → cancela también sus incluidos.
- Cambio de fechas → mueve los incluidos a las mismas fechas. Para la cochera se revalida la superposición de su plaza: si choca, falla todo con `resource_conflict` y el mensaje dice que es la cochera la que choca.
- Cambio de personas → actualiza el pase (no la cochera).
- `incluidos.pileta` / `incluidos.parking` con datos o `null` → agrega o cancela ese servicio en una reserva ya creada.
- Todo en transacción.

**PATCH de un incluido:**

- **Pase de pileta:** se rechaza con `servicio_incluido_no_editable`. Se edita desde la carpa.
- **Cochera:** se permite cambiar **plaza y patente** (el auto puede cambiar a mitad de temporada, y mover de plaza es operativo). Fechas, estado y cliente se rechazan con `servicio_incluido_no_editable`: se cambian desde la carpa. (Ver decisión C3.)

**GET** devuelve `incluidaEnReservaId` en cada reserva, y en la carpa un resumen `incluidos: { pileta: {id}, parking: {id, plaza} }` calculado.

### Pantallas

- **Modales de nueva reserva y de edición** (carpa y sombrilla):
  - Tilde "Incluye pileta", visible solo si el establecimiento tiene pileta. Debajo: "Pase para 2 adultos y 1 menor, del 10/01 al 20/01", tomado de los campos que ya existen.
  - Tilde "Incluye estacionamiento": el mismo de hoy, con plaza, patente, precio y pago. Lo que cambia es que se manda dentro de `incluidos` en vez de disparar un segundo POST, y que también aparece en el modal de **edición**.
- **`App.jsx`:** sacar la segunda alta de `handleSaveCarpaReservationRange` y de `handleSaveSombrillaReservationRange`, y el uso de `findAvailableParkingSpotForRange` en ese flujo. Por el tamaño de `App.jsx`, el armado del objeto `incluidos` va en un helper aparte (por ejemplo `frontend/src/lib/incluidos.js`) con sus tests.
- **Secciones Pileta y Estacionamiento, y sus calendarios:** la reserva incluida lleva la marca "Incluido en Carpa 12" y ofrece "Ir a la reserva".
- **Detalle de la carpa y comprobante:** líneas "Incluye pileta: 2 adultos, 1 menor" e "Incluye cochera: plaza 45, AB123CD".

### Pagos y reportes

- Cada incluido tiene **su propio precio y sus propios pagos**, como hoy la cochera. El pago inicial sigue siendo un POST aparte por reserva (fuera de alcance).
- **Pileta:** el contrato dice que se cobra aparte, así que el pase lleva su propio precio (por día o por temporada).
- **Ocupación:** el pase cuenta en la ocupación de la pileta y la cochera en la del estacionamiento, igual que una reserva suelta.
- **Saldo del cliente:** como son reservas separadas, el saldo de la carpa no incluye el de la cochera o el pase. Queda por decidir si el detalle de la carpa muestra además un "saldo total" que sume los incluidos (decisión G2).

## Decisiones abiertas

Hay que definirlas antes de pasar a un plan.

### Generales

- **G1. ¿Los incluidos se deciden en cada venta o vienen de la tarifa?** Ejemplo: "las carpas del sector Premium siempre incluyen pileta". Propuesta: tilde manual en cada venta; más adelante, si hace falta, una tarifa puede traerlo tildado por defecto.
- **G2. Cobro en el mostrador.** ¿Se cobra todo junto (un pago que se reparte entre carpa y servicios) o cada uno por su lado, como hoy la cochera? Propuesta: cada uno por su lado, más un "saldo total" informativo en el detalle de la carpa.
- **G3. Siempre las mismas fechas.** Ejemplo: carpa por todo enero y pileta o cochera solo una semana. Propuesta: mismas fechas; el caso raro se resuelve con una reserva suelta, como hoy.
- **G4. Cliente obligatorio.** Si la carpa no tiene cliente guardado, ¿se pueden crear los incluidos? Hay que unificar el criterio entre las dos APIs (hoy local exige cliente para la pileta y producción no).

### Pileta

- **P1. Precio de temporada.** El contrato ya confirmó que es un costo adicional. ¿La pileta se suma al módulo de tarifas (por día y por temporada, adulto y menor) o se sigue tipeando en el modal? Propuesta: sumarla a tarifas, porque el precio de temporada es fijo y se repite en cada venta. Puede ir en un cambio previo o posterior a este.
- **P2. ¿Qué es "Menor de hasta 4-5 años"?** ¿No cuenta para el máximo de 6? ¿No paga pileta? Hay que preguntárselo al balneario.
- **P3. ~~¿El pase cubre a todas las personas de la carpa?~~ Resuelta (26/09):** la reserva incluye **4 pases de pileta**. Hacen falta los datos de todos los acompañantes, y si la carpa tiene más de 4 personas, el operador elige cuáles 4 tienen pase; el resto queda sin pileta. Esto convierte el pase en **nominal (por persona)**, no en una cantidad de adultos y menores. Preguntas que se desprenden:
  - **P3a.** ¿Los 4 pases están dentro del precio de la carpa, o se cobran aparte? El contrato dice "costo adicional".
  - **P3b.** ¿El número 4 es igual para carpas y sombrillas, o depende del tipo o del sector?
  - **P3c.** Los que quedan sin pase, ¿pueden comprar uno aparte (pase suelto) y queda asociado a la carpa?
  - **P3d.** Cómo se guarda: marca "con pileta" en cada persona de la reserva (`reservation_guests`) o personas propias del pase.
- **P4. Aforo.** Hoy no se controla para ningún pase. Propuesta: aviso sin bloqueo, y hacerlo para todos los pases a la vez, fuera de este cambio.

### Cochera

- **C1. Plaza elegida por el servidor.** Si el operador no elige plaza, ¿está bien que el servidor asigne la primera libre? Propuesta: sí, y el modal muestra cuál quedó.
- **C2. ¿Una sola cochera por carpa?** Una familia puede venir con dos autos. Propuesta: una incluida; la segunda se carga suelta. El índice único lo garantiza.
- **C3. ¿Qué se puede editar desde la cochera?** Propuesta: plaza y patente sí; fechas, estado y cliente solo desde la carpa.
- **C4. Cocheras ya cargadas junto con una carpa.** Hoy no tienen vínculo. ¿Se vinculan con un script (mismo cliente y mismas fechas que una carpa) o se dejan sueltas? Propuesta: dejarlas sueltas; como la temporada 2026-2027 todavía no empezó, hay pocas, y se pueden vincular a mano desde la edición de la carpa.
- **C5. ¿Qué pasa si falla la cochera al crear?** Propuesta: falla todo (ver API). Es un cambio de comportamiento: hoy la carpa se crea igual y solo avisa. En discusión (26/09).

### Pantallas: confirmado

- **26/09:** los tildes "Incluye estacionamiento" (como hoy) e "Incluye pileta" en el modal de la carpa quedan como forma de uso.

## Riesgos

- **Olvidarse de una de las dos APIs.** Es la trampa conocida del repo. Los tests en `api/` cubren producción; en local conviene probar a mano los flujos de "Cómo verificarlo".
- **Transacciones nuevas.** No hay ningún endpoint con transacción para copiar el patrón. En `api/index.js` hay que pedir un cliente explícito (`pool.connect()`, `BEGIN` / `COMMIT` / `ROLLBACK`, y liberarlo en `finally`) en vez de usar `db.query`. Conviene un helper `withTransaction(fn)` en cada API. Los tests mockean `pg` sembrando `require.cache` (`api/test/pg-mock.js`): el mock tiene que soportar `connect()` y un cliente con `query` y `release`.
- **Carrera en la superposición.** El control de superposición es un `SELECT` sin bloqueo: dos altas simultáneas de la misma plaza pueden pasar las dos. Dentro de la transacción, bloquear con `SELECT id ... FOR UPDATE` sobre las reservas activas de esa unidad (o un advisory lock por unidad), según la convención del equipo. Aplica también a la carpa.
- **Incluidos huérfanos** si la sincronización falla a mitad de camino. La transacción lo evita tanto al crear como en el PATCH.
- **Doble alta durante la transición.** Si el backend nuevo sale antes que el frontend nuevo, o al revés, la cochera podría crearse dos veces o ninguna. Salen juntos, en el mismo deploy.

## Cómo verificarlo

1. Crear la Carpa 12 del 10/01 al 20/01, con 2 adultos y 1 menor, con pileta y con cochera en la plaza 45. Aparecen el pase en Pileta y la cochera en Estacionamiento, con esas fechas, marcados "Incluido en Carpa 12", cada uno con su precio.
2. Crear otra carpa con cochera en la plaza 45 en fechas que se superponen. Falla todo y la carpa no queda creada.
3. Crear una carpa con cochera sin elegir plaza. El servidor asigna una libre y el modal la muestra.
4. Cambiar las fechas de la Carpa 12. El pase y la cochera se mueven.
5. Cambiar las personas de la Carpa 12. El pase se ajusta; la cochera no cambia.
6. Cambiar la patente y la plaza desde la cochera. Deja. Cambiar sus fechas desde la cochera: no deja y ofrece ir a la carpa.
7. Cancelar la Carpa 12. El pase y la cochera quedan cancelados.
8. Agregar pileta y cochera a una carpa ya creada desde el modal de edición.
9. Todo lo anterior también con una sombrilla.
10. Todo lo anterior en local (puerto 9000) y en Vercel.
