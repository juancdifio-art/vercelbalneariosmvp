# Personas por reserva — cantidad y datos de los acompañantes

**Fecha:** 2026-09-22
**Estado:** aprobado, listo para plan de implementación
**Alcance:** dos etapas. La 1 es prerrequisito de la 2.

---

## 1. Qué se quiere

Que cada reserva registre **cuántos adultos y cuántos menores** la ocupan, en los cuatro servicios, y que además se puedan cargar **los datos de cada persona**: nombre, DNI, edad y fecha de nacimiento.

Decisiones tomadas con el cliente:

- **La cantidad es lo obligatorio y rápido:** dos números al crear la reserva.
- **Los datos de cada persona son opcionales** y se pueden cargar al crear la reserva o después, cuando la gente llega. Se editan y se borran desde el detalle de la reserva.
- **Nada bloquea el mostrador.** Si la cantidad no coincide con las personas cargadas, se avisa y se sigue.

## 2. El problema de fondo: dos bases que divergieron

El sistema tiene dos implementaciones de la misma API, que son **generaciones distintas** del mismo código:

| | `backend/src/index.js` (local) | `api/index.js` (producción) |
|---|---|---|
| Cantidad de personas | no existe | `adults_count`, `children_count`, para cualquier servicio |
| Composición del pase de pileta | `pool_adults_count`, `pool_children_count` | no existe |
| Precio por adulto y por niño (pileta) | `pool_adult_price_per_day`, `pool_child_price_per_day` | **no existe** |

El frontend sobrevive a esto mandando **los dos nombres a la vez** y leyendo con alternativas (`poolAdultsCount ?? adultsCount`). Es un parche que ya obligó a arreglar dos veces lo mismo: el comprobante mostraba "Adultos: 0" y todos los pagos como método "Otro" en producción.

**Consecuencia hoy, visible para el usuario:** en producción **no se puede editar un pase de pileta**, porque los precios por adulto y por niño no se guardan en ningún lado.

Construir la función nueva sobre esta diferencia agregaría una tercera variante. Por eso la Etapa 1.

Superficie a tocar: **34 referencias** en el backend local, **14** en el de producción, y 7 archivos del frontend.

## 3. Etapa 1 — Unificar las columnas

Las dos bases pasan a usar **`adults_count` y `children_count` para los cuatro servicios**. Se eligen esos nombres, y no los `pool_*`, por dos razones: producción ya los tiene con datos, y el prefijo `pool_` no tiene sentido en una carpa.

Los precios por persona **siguen llamándose `pool_*`**: son propios de la pileta, ahí el nombre es correcto.

### Migración en local

```sql
ALTER TABLE reservation_groups
  ADD COLUMN IF NOT EXISTS adults_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS children_count INTEGER NOT NULL DEFAULT 0;

-- Los pases de pileta ya tenian la cantidad en las columnas pool_*.
UPDATE reservation_groups
   SET adults_count = COALESCE(pool_adults_count, 0),
       children_count = COALESCE(pool_children_count, 0)
 WHERE service_type = 'pileta'
   AND adults_count = 0
   AND children_count = 0;
```

### Migración en producción

```sql
ALTER TABLE reservation_groups
  ADD COLUMN IF NOT EXISTS pool_adult_price_per_day NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS pool_child_price_per_day NUMERIC(12, 2);
```

Las columnas viejas `pool_adults_count` y `pool_children_count` **no se borran**: quedan como respaldo de los datos ya cargados. Se pueden eliminar más adelante, cuando se confirme que nada las lee.

### Código

- **Los dos backends** leen y escriben `adults_count` / `children_count` en `GET`, `POST` y `PATCH`, para cualquier `service_type`, y `pool_adult_price_per_day` / `pool_child_price_per_day` cuando el servicio es pileta.
- **La API devuelve `adultsCount`, `childrenCount`, `poolAdultPricePerDay`, `poolChildPricePerDay`** en los dos entornos, con los mismos nombres.
- **El frontend deja de mandar los nombres por duplicado.** Se sacan los parches de compatibilidad de `App.jsx` y las lecturas con alternativa de `PiletaSection`, `ReservationDetailsModal` y `generateReceipt`.

### Cómo verificar que salió bien

1. Crear un pase de pileta con 2 adultos y 1 niño **en los dos entornos**, y que la composición y los precios se vean iguales al reabrirlo.
2. **Editar** ese pase en producción y que los precios por persona aparezcan cargados, que es lo que hoy falla.
3. Que las reservas de pileta que ya existían sigan mostrando su composición.

## 4. Etapa 2 — Datos de los acompañantes

### Tabla, igual en las dos bases

```sql
CREATE TABLE IF NOT EXISTS reservation_guests (
  id SERIAL PRIMARY KEY,
  establishment_id INTEGER NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  reservation_group_id INTEGER NOT NULL REFERENCES reservation_groups(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  document_number VARCHAR(50),
  age INTEGER,
  birth_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservation_guests_group
  ON reservation_guests(reservation_group_id);
```

**Solo `full_name` es obligatorio.** Si el operador tiene el nombre y nada más, lo carga igual: un dato a medias sirve más que ninguno.

**`age` y `birth_date` conviven a propósito.** En el mostrador se pregunta la edad, no la fecha de nacimiento. Si se carga la fecha, la edad se calcula y se muestra a partir de ella; si no, vale la edad escrita a mano. La edad guardada **no se recalcula sola** con el paso del tiempo: es la que tenía cuando se cargó.

Al borrar la reserva se borran sus personas, por el `ON DELETE CASCADE`.

### Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/reservation-groups/:id/guests` | Lista las personas de la reserva |
| `POST` | `/api/reservation-groups/:id/guests` | Agrega una: `{ fullName, documentNumber?, age?, birthDate? }` |
| `PATCH` | `/api/reservation-guests/:guestId` | Edita los campos que se manden |
| `DELETE` | `/api/reservation-guests/:guestId` | La quita |

En el router de producción, las rutas de tres segmentos se resuelven con `segments[3]`, igual que `/api/reservation-groups/:id/payments`.

Todos verifican que la reserva y la persona pertenezcan al establecimiento del usuario, como el resto de los endpoints.

| Situación | Código | Respuesta |
|---|---|---|
| Falta `fullName` o viene vacío | 400 | `{ "error": "missing_fields" }` |
| La reserva no es de ese establecimiento | 404 | `{ "error": "not_found" }` |
| Sin token | 401 | `{ "error": "missing_token" }` |

### Pantallas

**Al crear la reserva** (carpa, sombrilla, estacionamiento y pileta): dos campos, **Adultos** y **Menores**. En pileta son los que ya existen: no cambian en pantalla, solo pasan a guardarse en las columnas unificadas. Los precios por adulto y por niño de la pileta quedan como están.

**En el detalle de la reserva**, una sección **Personas** con la lista y un botón para agregar. Cada fila se edita o se borra. Muestra la edad, calculada de la fecha de nacimiento si está cargada.

**Si la cantidad no coincide** con las personas cargadas, un aviso suave: *"Cargaste 3 de 6 personas"*. No bloquea guardar ni nada.

### Por qué una tabla aparte y no la de clientes

Un acompañante no es un cliente: no reserva, no paga y no se le factura. Meterlos en `clients` ensuciaría la lista de clientes, el buscador del alta y el filtro de deudas con gente que nunca reservó nada. Si un acompañante después reserva por su cuenta, se lo carga como cliente en ese momento.

## 5. Orden y riesgos

**La Etapa 1 va primero y sola.** No agrega nada visible, así que si algo sale mal se nota enseguida y se revierte sin arrastrar la función nueva.

Riesgos y cómo se cubren:

- **Perder la composición de los pases de pileta ya cargados en local.** La migración los copia antes de que el código cambie, y las columnas viejas no se borran.
- **Quedar a mitad de camino entre los dos entornos.** Las dos migraciones tienen que correr antes de desplegar el código nuevo. El `ADD COLUMN IF NOT EXISTS` permite correrlas antes sin romper el código viejo, porque las columnas nuevas simplemente no se usan todavía.
- **Otra deriva más adelante.** Mientras existan dos implementaciones, el riesgo sigue. Esta etapa lo reduce para estas columnas, no lo elimina.

## 6. Fuera de alcance

- **Unificar los dos backends del todo.** Es la causa raíz y merece su propia decisión: mantener los dos en sincronía, o que el de producción sea el único y el local lo use.
- **Cambiar el cliente de una reserva desde la app.** Hoy la API no lo permite y hay que tocar la base a mano. Apareció al arreglar el vínculo con el cliente.
- **Precio según la edad** (por ejemplo, menores de 5 gratis). La tabla deja los datos listos para hacerlo, pero la lógica de precios es otro tema.
- **Cupo por cantidad de personas** (que una carpa no admita más de N). Requiere definir ese límite en el establecimiento.
