# Tarifas: diseño

**Fecha:** 2026-09-23
**Estado:** aprobado en conversación, pendiente de revisión escrita

## Objetivo

Hoy el encargado escribe a mano el "Valor por día" de cada reserva y el total se calcula en el navegador. No hay tarifas guardadas.

Queremos que el precio salga de tarifas configuradas por el balneario:

- **Por fecha:** temporadas que se repiten todos los años (alta, baja, fines de semana largos). Se cotiza día por día.
- **Por estadía:** según la cantidad de días (temporada completa +90 días, media temporada 45–89). Si aplica, reemplaza a las tarifas por fecha para toda la reserva.
- **Por alcance:** una tarifa aplica a todo un tipo de servicio, a un **sector** (Terraza, Frente al mar) o a una **unidad suelta**.

El encargado puede modificar el precio en el mostrador, pero queda registrado el precio de tarifa, el cobrado y el motivo.

Aplica a carpas, sombrillas y estacionamiento. La pileta sigue con sus precios por adulto/menor actuales. La cantidad de personas no cambia el precio de una unidad.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Tarifa por estadía | Puede ser **precio cerrado** (monto fijo por el paquete) o **por día** (valor diario × días). Se elige al cargarla. |
| Cambio de precio en mostrador | Permitido. Se guardan precio de tarifa, precio cobrado y **motivo obligatorio** si difieren. |
| Grupos de unidades | **Sectores con nombre**, armados sobre el plano. Una unidad pertenece a **un solo sector** de su tipo. |
| Precedencia de alcance | Unidad > sector > tipo. |
| Dónde vive el cálculo | Un **módulo compartido** en `api/_tarifas/`, usado por las dos APIs. |

## Modelo de datos

Migración nueva e idempotente: `backend/migrate-tarifas.sql`. Reflejar todo en `backend/schema.sql`.

### `sectores`

| Columna | Tipo | Notas |
|---|---|---|
| id | SERIAL PK | |
| establishment_id | FK establishments | |
| service_type | VARCHAR(20) | `carpa` \| `sombrilla` \| `parking` |
| nombre | VARCHAR(100) | UNIQUE por (establishment_id, service_type, nombre) |
| color | VARCHAR(20) | Para pintarlo en el plano |

### `sector_unidades`

| Columna | Tipo | Notas |
|---|---|---|
| sector_id | FK sectores ON DELETE CASCADE | |
| establishment_id | FK establishments | |
| service_type | VARCHAR(20) | Copiado del sector, para poder poner el UNIQUE |
| resource_number | INTEGER | |

UNIQUE (establishment_id, service_type, resource_number): una unidad está en un solo sector. Lo garantiza la base, no el formulario.

### `periodos_tarifarios`

| Columna | Tipo | Notas |
|---|---|---|
| id | SERIAL PK | |
| establishment_id | FK | |
| nombre | VARCHAR(100) | |
| mes_inicio, dia_inicio, mes_fin, dia_fin | SMALLINT | Sin año: no vencen |
| prioridad | INTEGER | Mayor gana |

- Pueden cruzar el fin de año: si inicio > fin, una fecha cae adentro cuando es >= inicio o <= fin.
- Valen para todos los tipos de servicio del establecimiento.
- Dos períodos con **la misma prioridad que se superponen** se rechazan al crear o editar (`periodo_superpuesto`).

### `tarifas`

| Columna | Tipo | Notas |
|---|---|---|
| id | SERIAL PK | |
| establishment_id | FK | |
| service_type | VARCHAR(20) | |
| alcance | VARCHAR(10) | `tipo` \| `sector` \| `unidad` |
| sector_id | FK sectores ON DELETE CASCADE, nullable | Solo si alcance = `sector` |
| resource_number | INTEGER nullable | Solo si alcance = `unidad` |
| clase | VARCHAR(10) | `fecha` \| `estadia` |
| periodo_id | FK periodos_tarifarios ON DELETE CASCADE, nullable | Obligatorio si clase = `fecha`; opcional si `estadia` |
| nombre | VARCHAR(100) nullable | Para las de estadía ("Temporada completa") |
| dias_min | INTEGER nullable | Solo estadía |
| dias_max | INTEGER nullable | Solo estadía. Vacío = sin tope |
| modo | VARCHAR(10) nullable | Solo estadía: `cerrado` \| `por_dia` |
| precio | NUMERIC(12,2) NOT NULL | Por día (fecha y estadía `por_dia`) o total (estadía `cerrado`) |

Validaciones en la API (y CHECKs en la base donde se pueda):

- Coherencia de columnas según `alcance` y `clase`.
- No puede haber dos tarifas `fecha` para el mismo alcance y período (`tarifa_duplicada`).
- Las tarifas `estadia` de un mismo alcance y mismo período (o ambas sin período) no pueden tener rangos de días solapados (`rango_superpuesto`). 45–89 y 90+ está bien; 45–90 y 90+ no.

La unidad suelta se llama `resource_number`, igual que en `reservation_groups`, para no tener nombres desalineados.

### Columnas nuevas en `reservation_groups`

| Columna | Tipo | Notas |
|---|---|---|
| precio_tarifa | NUMERIC(12,2) nullable | Lo que dio el cálculo. Vacío si faltaban tarifas o si es una reserva anterior a este cambio |
| desglose | JSONB nullable | Snapshot del cálculo en el momento de reservar |
| motivo_ajuste | TEXT nullable | Obligatorio si `total_price` ≠ `precio_tarifa` |

`total_price` sigue siendo lo cobrado. `daily_price` se sigue llenando con `total_price / días`, redondeado, para no romper pantallas ni reportes que lo leen.

Si después cambia una tarifa, las reservas ya hechas no se tocan.

## El cálculo: `api/_tarifas/`

Tres módulos CommonJS sin dependencias: `calculo.js` (puro), `validaciones.js` (puro) y `servicio.js` (consultas, recibe la función `query` por parámetro). Los requieren `api/index.js` y `backend/src/index.js`, así el cálculo y los endpoints de tarifas existen una sola vez; cada API solo los adapta a su forma de rutear.

Vive dentro de `api/` y no en una carpeta `shared/` en la raíz para que Vercel lo empaquete con la función sin configuración extra. La carpeta empieza con `_` y `vercel.json` solo declara `api/index.js`, así que no se expone como endpoint.

```js
cotizar({ tarifas, periodos, sectorId, serviceType, resourceNumber, desde, hasta })
// → { total, completo, desglose, diasSinTarifa, dias }
```

`desde` y `hasta` son `YYYY-MM-DD` inclusivos. Se parten a mano como texto: nunca `new Date('YYYY-MM-DD')`, que interpreta UTC y corre un día.

### Paso 1: tarifa por estadía

1. `dias` = días inclusivos (del 1 al 5 son 5).
2. Candidatas: tarifas `estadia` del `serviceType` cuyo rango contiene `dias`, que aplican a la unidad (por alcance), y que no tienen período o cuyo período es el vigente en la **fecha de entrada**.
3. Si hay varias, gana la de alcance más específico: unidad > sector > tipo.
4. `cerrado` → total = precio. `por_dia` → total = precio × dias.
5. Si hubo tarifa por estadía, el cálculo termina ahí. Las tarifas por fecha no se miran.

Desglose: `{ clase: 'estadia', tarifaId, nombre, modo, dias, precio, total }`.

### Paso 2: tarifas por fecha, día por día

Solo si no hubo tarifa por estadía.

1. Para cada día: el período vigente es el de mayor prioridad que contiene ese día/mes.
2. Precio del día: la tarifa `fecha` de ese período con el alcance más específico que la tenga (unidad, si no sector, si no tipo). Así un sector carga solo lo que cambia respecto de la general.
3. Si ningún alcance tiene precio para ese día (o no hay período), el día va a `diasSinTarifa`.
4. Días consecutivos con el mismo período y el mismo precio se agrupan en tramos.

Desglose: `{ clase: 'fecha', tramos: [{ desde, hasta, periodo, dias, precioDia, subtotal }], diasSinTarifa }`.

### Resultado incompleto

Si `diasSinTarifa` no está vacío: `completo: false`, `total` = suma de lo que sí tiene precio (solo informativo). La reserva se puede guardar con precio cargado a mano, `precio_tarifa` vacío, sin exigir motivo, y el desglose guarda qué días faltaron.

## API

Todos los endpoints nuevos se implementan en **las dos APIs** (`api/index.js` y `backend/src/index.js`) y filtran por `establishment_id`, no por usuario.

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `tarifas/cotizar?serviceType&resourceNumber&startDate&endDate` | Devuelve el resultado de `cotizar` |
| GET/POST/PATCH/DELETE | `tarifas/periodos[/id]` | ABM de períodos |
| GET/POST/PATCH/DELETE | `tarifas/sectores[/id]` | ABM de sectores; el body incluye la lista de unidades |
| GET/POST/PATCH/DELETE | `tarifas[/id]` | ABM de tarifas |

### Cambios en reservas

- **POST:** la API lee tarifas, períodos y sectores, llama a `cotizar`, y guarda `precio_tarifa` y `desglose`. Recibe `totalPrice` (cobrado) y `motivoAjuste`. Si el cálculo está completo, `totalPrice` difiere de `precio_tarifa` y no hay motivo → 400 `motivo_ajuste_required`. Si `totalPrice` no viene, se usa `precio_tarifa`. El precio del navegador nunca reemplaza al cálculo: solo se acepta como "cobrado" contra un motivo.
- **PATCH:** si cambian las fechas o la unidad, se recalcula con las tarifas vigentes y aplica la misma regla de motivo. Si solo cambian otros datos (nombre, notas, personas), el snapshot queda intacto.
- Las respuestas de listado y detalle incluyen `precioTarifa`, `desglose` y `motivoAjuste`.

### Errores

Cada consulta de tarifas, períodos o sectores se loguea si falla y devuelve 500. Nunca se responde "precio 0" ante un error de base.

## Pantallas

### Sección "Tarifas"

Entrada nueva en `frontend/src/config/sections.js`, en el grupo de configuración. Componente propio (no dentro de `App.jsx`), con tres pestañas:

1. **Períodos:** lista con nombre, desde (día/mes), hasta (día/mes), prioridad. Arriba, una tira de 12 meses que muestra el período vigente de cada día, para ver huecos y superposiciones.
2. **Sectores:** selector de tipo; crear sector con nombre y color; clic sobre las unidades de `PlanoBalneario` para sumarlas o sacarlas. Las unidades de otro sector se ven con su color y no se pueden tomar. En estacionamiento, que no está en el plano, se eligen de una lista de números.
3. **Precios**, por tipo de servicio:
   - **Por fecha:** grilla con filas "Todas las carpas", un renglón por sector y un renglón por cada unidad con precio propio (con "agregar unidad"), y columnas por período. Cada celda es el precio por día; vacía = usa el de la fila general.
   - **Por estadía:** lista con nombre, días mín./máx., cerrado/por día, precio, período opcional y alcance.

### Modales de reserva

En `CarpaReservationModal`, `SombrillaReservationModal`, `ParkingReservationModal` (y la parte de cochera de los dos primeros), el campo "Valor por día" se reemplaza por un componente **`PrecioReserva`**:

- Con unidad y fechas elegidas, llama a `cotizar` y muestra el desglose ("3 días Baja × $9.000 · 2 días Alta × $14.000 = $55.000" o "Temporada completa (cerrado) = $3.500.000").
- **Total cobrado:** precargado con el precio de tarifa y editable. Si difiere, aparece **Motivo del ajuste** (obligatorio) y la diferencia ("−$5.000 respecto de la tarifa").
- Sin tarifa completa: "Consultar precio: faltan tarifas para el 14/03 y 15/03" y el total queda para cargar a mano.
- En `ReservationEditModal`, si cambian fechas o unidad, se recotiza igual.

### Detalle de la reserva

`ReservationDetailsModal` muestra el desglose guardado y, si hubo ajuste: "Tarifa $60.000 · Cobrado $55.000 · Motivo: cliente de años". Las reservas viejas, sin desglose, se ven como hoy.

## Tests

- **`api/_tarifas/` (vitest, sin base):** período que cruza fin de año; prioridad (Navidad pisa Temporada alta); estadía que pisa las tarifas por fecha; estadía atada a un período; fallback unidad → sector → tipo; días sin tarifa; cerrado vs por día; límites de rango (89 y 90 días); fechas sin corrimiento de zona horaria.
- **API (`api/index.test.js`, mock de `pg`):** cotizar; crear reserva con precio de tarifa, con ajuste y motivo, con ajuste sin motivo (400); editar fechas con recálculo; editar notas sin recálculo; validaciones de superposición.
- **Frontend (RTL):** `PrecioReserva` (desglose, motivo obligatorio, consultar precio) y la grilla de precios.

## Fuera de alcance

- Reporte de ajustes de precio (los datos quedan guardados para hacerlo después).
- Precio según cantidad de personas.
- Una unidad en más de un sector.
- Recalcular reservas existentes cuando cambia una tarifa.
