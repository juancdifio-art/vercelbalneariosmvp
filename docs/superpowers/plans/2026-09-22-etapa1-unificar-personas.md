# Etapa 1: unificar las columnas de personas — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los dos backends guarden la cantidad de adultos y menores en las mismas columnas, para cualquier servicio, y que producción guarde los precios por adulto y por niño de la pileta.

**Architecture:** Dos migraciones idempotentes, una por base. Después, cada backend pasa a usar `adults_count` / `children_count` y a devolver `adultsCount` / `childrenCount`. El frontend deja de mandar los nombres por duplicado. No cambia nada visible, salvo que se arregla la edición de pases de pileta en producción.

**Tech Stack:** Node + Express (backend local) · handler serverless plano (producción) · PostgreSQL · React + Vite · Vitest + Supertest

**Spec:** [`docs/superpowers/specs/2026-09-22-personas-por-reserva-design.md`](../specs/2026-09-22-personas-por-reserva-design.md)

## Global Constraints

- **Las migraciones corren ANTES de desplegar el código.** Son `ADD COLUMN IF NOT EXISTS`: las columnas nuevas quedan sin usar hasta que el código las use, así que correrlas antes no rompe nada.
- **Las columnas viejas `pool_adults_count` y `pool_children_count` no se borran.** Quedan como respaldo.
- **Los precios siguen llamándose `pool_adult_price_per_day` y `pool_child_price_per_day`.** Son propios de la pileta y ahí el nombre es correcto.
- **La cantidad vale para los cuatro servicios**, no solo pileta. En el backend local hoy solo se parsea dentro del `if (isPool)`; eso cambia.
- **Hay dos implementaciones de la misma API** (`backend/src/index.js` y `api/index.js`) y **todo cambio va en las dos**. No comparten código.
- **`api/index.js` es autocontenido:** define su propio `db`, `JWT_SECRET` y `authenticateToken`. No usa `api/lib/*`, que es código muerto.
- **`api/_handlers/reservation-groups/index.js` también es código muerto** (nadie lo rutea). No tocarlo.
- Tests de API: `cd api && npm test`. Tests de frontend: `cd frontend && npm test`. El backend local **no tiene** harness de tests: se verifica con scripts contra el servidor corriendo.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `backend/migrate-unificar-personas-local.sql` | *Crear.* Agrega las columnas a la base local y copia los valores de pileta. |
| `backend/migrate-precios-pileta-prod.sql` | *Crear.* Agrega los precios de pileta a producción. |
| `backend/schema.sql` | *Modificar.* Refleja las columnas nuevas para instalaciones nuevas. |
| `api/index.js` | *Modificar.* Acepta y devuelve los precios de pileta. |
| `api/index.test.js` | *Modificar.* Tests de esos precios. |
| `backend/src/index.js` | *Modificar.* Pasa a `adults_count` / `children_count` para todos los servicios. |
| `frontend/src/App.jsx` | *Modificar.* Deja de mandar nombres duplicados y de leer con alternativas. |
| `frontend/src/components/PiletaSection.jsx` | *Modificar.* Lee `adultsCount` / `childrenCount`. |
| `frontend/src/components/ReservationDetailsModal.jsx` | *Modificar.* Ídem. |
| `frontend/src/utils/generateReceipt.js` | *Modificar.* Ídem. |

---

## Task 1: Migraciones

**Files:**
- Create: `backend/migrate-unificar-personas-local.sql`
- Create: `backend/migrate-precios-pileta-prod.sql`
- Modify: `backend/schema.sql`

**Interfaces:**
- Consumes: nada.
- Produces: en las dos bases, `reservation_groups` con `adults_count`, `children_count`, `pool_adult_price_per_day` y `pool_child_price_per_day`.

- [ ] **Step 1: Migración de la base local**

Crear `backend/migrate-unificar-personas-local.sql`:

```sql
-- Unifica donde se guarda la cantidad de personas: las mismas columnas que ya
-- usa produccion, y para los cuatro servicios, no solo pileta.

ALTER TABLE reservation_groups
  ADD COLUMN IF NOT EXISTS adults_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS children_count INTEGER NOT NULL DEFAULT 0;

-- Los pases de pileta ya cargados tienen la cantidad en las columnas viejas.
-- Se copian antes de que el codigo deje de leerlas. Las viejas no se borran.
UPDATE reservation_groups
   SET adults_count = COALESCE(pool_adults_count, 0),
       children_count = COALESCE(pool_children_count, 0)
 WHERE service_type = 'pileta'
   AND adults_count = 0
   AND children_count = 0;
```

- [ ] **Step 2: Migración de producción**

Crear `backend/migrate-precios-pileta-prod.sql`:

```sql
-- Produccion nunca tuvo los precios por adulto y por nino del pase de pileta:
-- por eso hoy no se puede editar un pase ahi (los precios salen vacios).

ALTER TABLE reservation_groups
  ADD COLUMN IF NOT EXISTS pool_adult_price_per_day NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS pool_child_price_per_day NUMERIC(12, 2);
```

- [ ] **Step 3: Reflejarlo en el schema base**

En `backend/schema.sql`, dentro del bloque `ALTER TABLE reservation_groups ADD COLUMN IF NOT EXISTS ...` que ya existe, agregar:

```sql
  ADD COLUMN IF NOT EXISTS adults_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS children_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pool_adult_price_per_day NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS pool_child_price_per_day NUMERIC(12, 2),
```

- [ ] **Step 4: Aplicar la migración local**

```bash
cd backend && node -e "
require('dotenv').config();
const fs=require('fs');const {Pool}=require('pg');
const pool=new Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT)||5432,database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
(async()=>{
  await pool.query(fs.readFileSync('migrate-unificar-personas-local.sql','utf8'));
  const r=await pool.query(\"SELECT service_type, adults_count, children_count, pool_adults_count FROM reservation_groups WHERE service_type='pileta'\");
  console.table(r.rows);
  await pool.end();
})().catch(e=>{console.error(e.message);process.exit(1);});
"
```

Expected: en cada fila de pileta, `adults_count` igual a `pool_adults_count`.

- [ ] **Step 5: Verificar que es idempotente**

Correr el mismo comando del paso 4 otra vez. Expected: termina sin error y la tabla queda igual.

- [ ] **Step 6: Commit**

```bash
git add backend/migrate-unificar-personas-local.sql backend/migrate-precios-pileta-prod.sql backend/schema.sql
git commit -m "feat: migraciones para unificar las columnas de personas"
```

---

## Task 2: La API de producción guarda los precios de pileta

Esto es lo único de la Etapa 1 que arregla algo visible: hoy, editar un pase de pileta en producción muestra los precios vacíos.

**Files:**
- Modify: `api/index.test.js`
- Modify: `api/index.js` (líneas 846-847, 941-942, 968-970, 989, 1046-1047, 1068-1069, 1138, 1179-1187, 1212-1213)

**Interfaces:**
- Consumes: el helper `tokenPara(id)` y el mock `queryMock` que ya existen en `api/index.test.js`.
- Produces: `POST` y `PATCH /api/reservation-groups` aceptan `poolAdultPricePerDay` y `poolChildPricePerDay`; `GET` los devuelve.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `api/index.test.js`:

```js
describe('precios de pileta en /api/reservation-groups', () => {
  it('guarda los precios por adulto y por nino al crear un pase', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // establecimiento
    queryMock.mockResolvedValueOnce({ rows: [] });          // sin solapamiento
    queryMock.mockResolvedValueOnce({ rows: [{ id: 99, service_type: 'pileta', adults_count: 2, children_count: 1, pool_adult_price_per_day: '6000.00', pool_child_price_per_day: '3500.00' }] });

    const res = await request(handler)
      .post('/?route=reservation-groups')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({
        serviceType: 'pileta', resourceNumber: 1,
        startDate: '2026-09-22', endDate: '2026-09-22',
        customerName: 'Prueba', adultsCount: 2, childrenCount: 1,
        poolAdultPricePerDay: 6000, poolChildPricePerDay: 3500
      });

    expect(res.status).toBe(201);
    const insert = queryMock.mock.calls.find((c) => String(c[0]).includes('INSERT INTO reservation_groups'));
    expect(String(insert[0])).toContain('pool_adult_price_per_day');
    expect(insert[1]).toContain(6000);
    expect(insert[1]).toContain(3500);
  });

  it('los devuelve al leer la reserva', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 99, service_type: 'pileta', resource_number: 1, start_date: '2026-09-22', end_date: '2026-09-22', adults_count: 2, children_count: 1, pool_adult_price_per_day: '6000.00', pool_child_price_per_day: '3500.00', paid_amount: 0 }]
    });

    const res = await request(handler)
      .get('/?route=reservation-groups')
      .set('Authorization', `Bearer ${tokenPara(2)}`);

    expect(res.status).toBe(200);
    expect(res.body.reservationGroups[0].poolAdultPricePerDay).toBe('6000.00');
    expect(res.body.reservationGroups[0].poolChildPricePerDay).toBe('3500.00');
  });

  it('los actualiza al editar el pase', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 99, adults_count: 2, children_count: 1, pool_adult_price_per_day: '6000.00', pool_child_price_per_day: '3500.00' }] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 99, service_type: 'pileta', adults_count: 3, children_count: 1, pool_adult_price_per_day: '7000.00', pool_child_price_per_day: '3500.00' }] });

    const res = await request(handler)
      .patch('/?route=reservation-groups/99')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ adultsCount: 3, poolAdultPricePerDay: 7000 });

    expect(res.status).toBe(200);
    const update = queryMock.mock.calls.find((c) => String(c[0]).includes('UPDATE reservation_groups'));
    expect(String(update[0])).toContain('pool_adult_price_per_day');
    expect(res.body.reservationGroup.poolAdultPricePerDay).toBe('7000.00');
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `cd api && npm test`
Expected: los 3 fallan. El INSERT y el UPDATE no mencionan `pool_adult_price_per_day`, y el GET no devuelve esos campos.

- [ ] **Step 3: Agregar las columnas a los dos SELECT**

En `api/index.js`, después de `rg.children_count,` (líneas 847 y 942), agregar en ambos:

```js
            rg.pool_adult_price_per_day,
            rg.pool_child_price_per_day,
```

Y en el `GROUP BY` del segundo (después de `rg.children_count,`):

```js
            rg.pool_adult_price_per_day,
            rg.pool_child_price_per_day,
```

- [ ] **Step 4: Devolverlas en las tres respuestas**

En `api/index.js`, después de cada `childrenCount: row.children_count || 0,` (líneas 970, 1069 y 1213), agregar:

```js
            poolAdultPricePerDay: row.pool_adult_price_per_day,
            poolChildPricePerDay: row.pool_child_price_per_day,
```

- [ ] **Step 5: Aceptarlas al crear**

En la línea 989, agregar los dos campos al destructuring:

```js
        const { serviceType, resourceNumber, startDate, endDate, customerName, customerPhone, dailyPrice, totalPrice, notes, clientId, adultsCount, childrenCount, poolAdultPricePerDay, poolChildPricePerDay } = body;
```

Y en el INSERT (líneas 1046-1047), agregar las dos columnas al final de la lista, dos placeholders más y los dos valores:

```js
          `INSERT INTO reservation_groups (establishment_id, service_type, resource_number, start_date, end_date, customer_name, customer_phone, daily_price, total_price, notes, status, client_id, adults_count, children_count, pool_adult_price_per_day, pool_child_price_per_day) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
          [establishmentId, serviceType, resourceNumber, startDate, endDate, customerName, customerPhone || null, dailyPrice || null, totalPrice || null, notes || null, 'active', clientId || null, adultsCount || 0, childrenCount || 0, poolAdultPricePerDay || null, poolChildPricePerDay || null]
```

- [ ] **Step 6: Aceptarlas al editar**

En la línea 1138, agregar los dos campos al destructuring:

```js
        const { customerName, customerPhone, dailyPrice, totalPrice, notes, adultsCount, childrenCount, poolAdultPricePerDay, poolChildPricePerDay, resourceNumber, startDate, endDate } = body;
```

Y en el UPDATE (líneas 1179-1187), agregar las dos columnas antes del `WHERE`, corriendo los números de los placeholders:

```js
          `UPDATE reservation_groups SET customer_name = $1, customer_phone = $2, daily_price = $3, total_price = $4, notes = $5, adults_count = $6, children_count = $7, resource_number = $8, start_date = $9, end_date = $10, pool_adult_price_per_day = $11, pool_child_price_per_day = $12 WHERE id = $13 RETURNING *`,
```

Y en el array de parámetros, **después de `finalEndDate` y antes de `reservationGroupId`**, que es el último:

```js
            finalEndDate,
            poolAdultPricePerDay !== undefined ? poolAdultPricePerDay : current.pool_adult_price_per_day,
            poolChildPricePerDay !== undefined ? poolChildPricePerDay : current.pool_child_price_per_day,
            reservationGroupId
```

El orden del array tiene que coincidir con el de los placeholders: si los precios quedan antes de `finalResourceNumber`, la reserva se guarda con los datos corridos y sin ningún error visible.

- [ ] **Step 7: Correr y verificar que pasan**

Run: `cd api && npm test`
Expected: todos en verde, los 12 de antes más los 3 nuevos.

- [ ] **Step 8: Commit**

```bash
git add api/index.js api/index.test.js
git commit -m "fix: produccion guarda los precios por adulto y por nino del pase de pileta"
```

---

## Task 3: El backend local usa las columnas unificadas

**Files:**
- Modify: `backend/src/index.js` (líneas 946-947, 1038-1039, 1065-1066, 1093-1094, 1173-1192, 1253-1254, 1259, 1271-1272, 1302-1303, 1332-1333, 1359, 1387-1394, 1490, 1532-1533, 1999-2000, 2069)

**Interfaces:**
- Consumes: las columnas creadas en la Task 1.
- Produces: el backend local acepta `adultsCount` / `childrenCount` en `POST` y `PATCH` para cualquier servicio, y los devuelve con esos nombres en `GET`.

- [ ] **Step 1: Cambiar los nombres de columna en las consultas**

En `backend/src/index.js`, reemplazar en **todas** las consultas SQL:

- `pool_adults_count` → `adults_count`
- `pool_children_count` → `children_count`

Afecta: los dos `SELECT` de la lista (946-947, 1038-1039), el `INSERT` y su `RETURNING` (1253-1254, 1259), el `SELECT` previo al `PATCH` (1359), el `UPDATE` y su `RETURNING` (1490), y la consulta del reporte de ocupación (1999-2000).

Los precios `pool_adult_price_per_day` y `pool_child_price_per_day` **no se tocan**.

- [ ] **Step 2: Cambiar los nombres en las respuestas**

Reemplazar en las tres respuestas (1065-1066, 1302-1303, 1532-1533):

```js
        poolAdultsCount: row.pool_adults_count,
        poolChildrenCount: row.pool_children_count,
```

por:

```js
        adultsCount: row.adults_count,
        childrenCount: row.children_count,
```

En 1302-1303 la variable es `groupRow` y en 1532-1533 es `updatedRow`: ajustar el prefijo en cada caso.

Y en el reporte de ocupación (línea 2069):

```js
        Number(row.adults_count || 0) + Number(row.children_count || 0);
```

- [ ] **Step 3: Aceptar los nombres nuevos en el body**

En los destructuring del `POST` (1093-1094) y del `PATCH` (1332-1333), reemplazar:

```js
      poolAdultsCount,
      poolChildrenCount,
```

por:

```js
      adultsCount,
      childrenCount,
```

Y renombrar los usos: `poolAdultsCountParsed` → `adultsCountParsed`, `poolChildrenCountParsed` → `childrenCountParsed` (1173-1192, 1220-1221, 1271-1272), y en el `PATCH` las expresiones de 1387-1394, que pasan a comparar contra `current.adults_count` y `current.children_count`.

- [ ] **Step 4: Parsear la cantidad para todos los servicios**

En el `POST`, el bloque que parsea las cantidades (líneas 1173-1192) hoy está dentro del `if (isPool)`. Sacarlo fuera, para que valga para carpa, sombrilla y estacionamiento:

```js
    // La cantidad de personas vale para los cuatro servicios. Los precios por
    // persona, en cambio, son solo de la pileta y se siguen calculando adentro
    // del bloque de pileta.
    let adultsCountParsed =
      adultsCount !== undefined && adultsCount !== null && adultsCount !== ''
        ? Number.parseInt(adultsCount, 10)
        : 0;
    if (Number.isNaN(adultsCountParsed) || adultsCountParsed < 0) {
      adultsCountParsed = 0;
    }

    let childrenCountParsed =
      childrenCount !== undefined && childrenCount !== null && childrenCount !== ''
        ? Number.parseInt(childrenCount, 10)
        : 0;
    if (Number.isNaN(childrenCountParsed) || childrenCountParsed < 0) {
      childrenCountParsed = 0;
    }
```

El cálculo del total de la pileta (1220-1221) sigue dentro del `if (isPool)` y usa estas mismas variables.

- [ ] **Step 5: Reiniciar el backend local**

```bash
cd backend && npm start
```

Expected: `API listening on port 9000`, sin errores.

- [ ] **Step 6: Verificar el ida y vuelta contra la API local**

```bash
cd "E:/Balnearios 2026" && node -e "
(async()=>{
const A='http://localhost:9000';
const l=await (await fetch(A+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@balneario.com',password:'admin123'})})).json();
const h={'Content-Type':'application/json',Authorization:'Bearer '+l.token};
// Carpa con personas: antes el backend local ni miraba estos campos
const c=await (await fetch(A+'/api/reservation-groups',{method:'POST',headers:h,body:JSON.stringify({serviceType:'carpa',resourceNumber:99,startDate:'2026-11-01',endDate:'2026-11-03',customerName:'Prueba etapa1',dailyPrice:1000,totalPrice:3000,adultsCount:3,childrenCount:2,notes:'[etapa1]'})})).json();
const carpa=c.reservationGroup||c.group||c;
console.log('carpa ->', carpa.adultsCount, 'adultos,', carpa.childrenCount, 'menores');
// Pase de pileta con precios por persona
const p=await (await fetch(A+'/api/reservation-groups',{method:'POST',headers:h,body:JSON.stringify({serviceType:'pileta',resourceNumber:1,startDate:'2026-11-01',endDate:'2026-11-01',customerName:'Prueba etapa1',adultsCount:2,childrenCount:1,poolAdultPricePerDay:6000,poolChildPricePerDay:3500,notes:'[etapa1]'})})).json();
const pil=p.reservationGroup||p.group||p;
console.log('pileta ->', pil.adultsCount, 'adultos,', pil.childrenCount, 'menores, total', pil.totalPrice);
// Y que la lista los devuelva con los nombres nuevos
const g=(await (await fetch(A+'/api/reservation-groups',{headers:h})).json()).reservationGroups.find(x=>x.id===carpa.id);
console.log('en la lista ->', JSON.stringify({adultsCount:g.adultsCount, childrenCount:g.childrenCount}));
})().catch(e=>{console.error('FALLO:',e.message);process.exit(1);});
"
```

Expected: `carpa -> 3 adultos, 2 menores`, `pileta -> 2 adultos, 1 menores, total 15500` y la lista devolviendo `{"adultsCount":3,"childrenCount":2}`.

- [ ] **Step 7: Borrar las reservas de prueba**

```bash
cd backend && node -e "
require('dotenv').config();const {Pool}=require('pg');
const pool=new Pool({host:process.env.DB_HOST,port:5432,database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
(async()=>{const r=await pool.query(\"DELETE FROM reservation_groups WHERE notes LIKE '%[etapa1]%' RETURNING id\");console.log('borradas:',r.rowCount);await pool.end();})();
"
```

- [ ] **Step 8: Commit**

```bash
git add backend/src/index.js
git commit -m "refactor: el backend local usa adults_count y children_count para los cuatro servicios"
```

---

## Task 4: El frontend deja de mandar nombres duplicados

**Files:**
- Modify: `frontend/src/App.jsx` (payload del pase de pileta, ~954-959; lectura con alternativa, ~1773)
- Modify: `frontend/src/components/PiletaSection.jsx`
- Modify: `frontend/src/components/ReservationDetailsModal.jsx`
- Modify: `frontend/src/utils/generateReceipt.js`

**Interfaces:**
- Consumes: los dos backends devolviendo `adultsCount` / `childrenCount` (Tasks 2 y 3).
- Produces: nada que consuman tareas posteriores.

- [ ] **Step 1: Mandar un solo nombre en el pase de pileta**

En `frontend/src/App.jsx`, en el payload del pase de pileta, borrar las líneas de compatibilidad y dejar solo:

```js
          adultsCount: String(adults),
          childrenCount: String(children),
          poolAdultPricePerDay: ...,
          poolChildPricePerDay: ...,
```

Borrar el comentario `// Compatibilidad: backend serverless usa adultsCount/childrenCount` y las claves `poolAdultsCount` y `poolChildrenCount`.

- [ ] **Step 2: Sacar las lecturas con alternativa**

Reemplazar, en los cuatro archivos, las expresiones del tipo:

```js
group.poolAdultsCount ?? group.adultsCount ?? 0
```

por:

```js
group.adultsCount ?? 0
```

Lo mismo para `childrenCount`. En `generateReceipt.js` la expresión es `reservation.poolAdultsCount ?? reservation.adultsCount ?? '0'`, que pasa a `reservation.adultsCount ?? '0'`.

- [ ] **Step 3: Correr los tests y el build**

Run: `cd frontend && npm test && npm run build`
Expected: 73 tests en verde y el build compila.

- [ ] **Step 4: Verificar el pase de pileta en el navegador**

Con el backend local en 9000 y el frontend en 9001:

1. Crear un pase de pileta con 2 adultos y 1 niño, con precios por persona.
2. Reabrirlo: la composición y el total tienen que coincidir.
3. **Editarlo**: los precios por adulto y por niño tienen que aparecer cargados.
4. Descargar el comprobante: tiene que decir `Adultos: 2 · Niños: 1`.
5. Abrir un pase de pileta **de los que ya existían** y confirmar que sigue mostrando su composición: es lo que copió la migración.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/components/PiletaSection.jsx frontend/src/components/ReservationDetailsModal.jsx frontend/src/utils/generateReceipt.js
git commit -m "refactor: el frontend usa un solo nombre para la cantidad de personas"
```

---

## Cierre: producción

El orden importa. La migración va **antes** del despliegue.

- [ ] **Paso 1: Correr la migración en Supabase**

Pegar el contenido de `backend/migrate-precios-pileta-prod.sql` en el SQL Editor y ejecutarlo. Es idempotente.

- [ ] **Paso 2: Verificar que las columnas existen**

```sql
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'reservation_groups'
   AND column_name IN ('adults_count', 'children_count', 'pool_adult_price_per_day', 'pool_child_price_per_day')
 ORDER BY column_name;
```

Expected: las cuatro filas.

- [ ] **Paso 3: Desplegar**

```bash
git push origin main
```

- [ ] **Paso 4: Verificar en producción**

1. Que la lista de reservas siga cargando (es lo primero que se rompería si una consulta quedó mal).
2. Crear un pase de pileta con 2 adultos y 1 niño y precios por persona.
3. **Editarlo**: los precios tienen que aparecer cargados. Esto es lo que hoy falla.
4. Crear una carpa y confirmar que la reserva se guarda igual que antes.
