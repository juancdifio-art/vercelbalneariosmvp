# Balnearios MVP — Contexto del proyecto

Sistema de gestión para balnearios: reservas de carpas, sombrillas, estacionamiento y pases de pileta, con clientes, pagos y reportes.

## Trampas del repo

Estas son las cosas que no se deducen leyendo el código y que ya hicieron perder tiempo al menos una vez.

### La API está implementada dos veces

| Archivo | Cuándo corre | Forma |
|---|---|---|
| `backend/src/index.js` | Desarrollo local (puerto 9000) | Express |
| `api/index.js` | Producción en Vercel | Handler serverless plano |

**Son implementaciones paralelas de los mismos endpoints.** Un endpoint nuevo hay que escribirlo en los dos lados o funciona en un entorno y en el otro no. Pasó al agregar los endpoints de perfil: andaban en producción y no en local.

### `api/index.js` es autocontenido

Define su propio `createPool()`, su propio objeto `db`, su propio `JWT_SECRET` y su propio `authenticateToken`.

**`api/lib/*` y `api/_handlers/*` son código muerto**, salvo los dos handlers de reportes que `index.js` sí importa. No los edites esperando que afecten producción.

### El ruteo va por query param, no por path

`vercel.json` manda `/api/(.*)` a `/api/index.js?route=$1`. El router lee `route`, lo parte en segmentos y compara `first` y `second`.

Una ruta nueva es un `if (first === 'auth' && second === 'xxx')`. Y para pegarle en un test: `/?route=auth/me`, no `/api/auth/me`.

### `register` no existe en producción

`api/index.js` solo implementa `login`. Los archivos `api/auth/register.js` y `api/_handlers/auth/register.js` nunca se ejecutan. El alta de usuarios es por script: `cd backend && npm run create-user -- <email> <password>`.

### Mockear `pg` en los tests de la API

`api/` no declara `"type": "module"`, así que `index.js` es CommonJS y su `require('pg')` lo resuelve el require **nativo de Node**, fuera del grafo de módulos de vitest.

**Ni `vi.mock('pg')` ni un alias de Vite lo interceptan** — se probaron los dos y el test termina pegándole al `pg` real. La forma que funciona es sembrar el `require.cache` antes de importar `index.js`: ver `api/test/pg-mock.js`.

## Entornos

**Local:** backend en 9000 (`cd backend && npm start`), frontend en 9001 (`cd frontend && npm run dev`). Postgres local, base `balnearios_mvp`.

**Producción:** https://vercelbalneariosmvp1.vercel.app — base en Supabase.

⚠️ Existe un segundo proyecto en Vercel, `balneariosmvp` (balneariosmvp.vercel.app), que es **viejo**: sirve un build anterior a la migración serverless y apunta a un backend de Railway que ya no existe. No es el deploy bueno.

La base de Supabase del plan gratuito **se pausa por inactividad** y se elimina a los ~90 días. Si `/api/health` devuelve `database_error`, revisar el dashboard de Supabase antes de buscar el problema en el código.

## Migraciones

No hay herramienta de migraciones. Son archivos sueltos en `backend/*.sql` que se aplican a mano. Las nuevas se escriben idempotentes (`IF NOT EXISTS`, y para constraints un bloque `DO $$` que consulte `pg_constraint`, porque Postgres no soporta `ADD CONSTRAINT IF NOT EXISTS`).

Al agregar una columna, reflejarla también en `backend/schema.sql` para instalaciones nuevas.

## Tests

```bash
cd api && npm test        # 198 tests del router serverless y de _incluidos / _tarifas
cd frontend && npm test   # 272 tests de componentes y utilidades
```

`backend/src/index.js` **no tiene tests**. Cuando se replica un endpoint ahí, la cobertura viene del test equivalente en `api/`.

`api/incluidos-integracion.test.js` prueba el SQL de `_incluidos` contra la base local y **no corre con `npm test`** (queda en skipped). Hace todo en una transacción y la deshace:

```bash
cd api && DB_INTEGRACION=1 npx vitest run incluidos-integracion.test.js
```

**Transacciones en los tests de `api/`:** `test/pg-mock.js` hace que `BEGIN`, `COMMIT`, `ROLLBACK` y `pg_advisory_xact_lock` no consuman respuestas de `queryMock` (van a `txMock`). Al preparar un test se mockean solo las consultas de datos, en orden.

## Convenciones propias

- **Iconos:** `frontend/src/components/icons.jsx` es la única fuente. Son de lucide-react, salvo la carpa, que es un SVG propio: ninguna librería dibuja la carpa de balneario (el `Tent` de lucide es de camping y se lee como toldo indígena).
- **Navegación:** `frontend/src/config/sections.js` define los grupos del menú y qué pantallas van a ancho completo. El menú de escritorio y el de mobile se arman de ahí.
- **Grillas de ocupación:** son `table-fixed`, así que **el ancho de columna lo define el `<th>`, no el `<td>`**. Ensanchar el `td` no hace nada.
- **Plano del balneario:** `frontend/src/config/planoZeus.js` es la fuente de verdad de qué carpas y sombrillas existen y dónde van. Con el plano activo, las listas de unidades salen de `numerosDeUnidades` (`frontend/src/lib/unidades.js`) y **no de 1..capacidad**: las carpas son 117 pero numeradas hasta la 134, con huecos (4-11, 26, 27, 77-83). Cualquier lista nueva de carpas o sombrillas tiene que usar ese helper. La capacidad configurada queda fija en lo que dice el plano. `docs/plano-zeus.html` es la versión suelta del mismo plano, con sus datos duplicados en `docs/plano-zeus.js`: si se corrige una unidad, corregirla en los dos.
- **Patente obligatoria en estacionamiento:** toda reserva `parking` lleva `vehicle_plate`. Las dos APIs la exigen (`vehicle_plate_required`) y la guardan normalizada (`AB123CD`), y los formularios no dejan guardar sin ella. Va en la reserva, no solo en la ficha del cliente, porque el mismo cliente puede venir con otro auto; la ficha solo sirve para completarla sola. Columna nueva: `backend/migrate-reservation-vehicle-plate.sql`.
- **Calendarios de Carpas y Sombrillas:** los dos usan `CalendarioOcupacion.jsx`. Un cambio en la grilla se hace ahí, no en las secciones.
- **`App.jsx` tiene ~2800 líneas.** Al agregar una sección, crear un componente aparte y pasarle las props agrupadas en un objeto en vez de sueltas.
- **Tarifas:** el precio de carpas, sombrillas y estacionamiento lo calcula el servidor con `api/_tarifas/` (`calculo.js` y `validaciones.js` puros, `servicio.js` con las consultas). Es el único código compartido por las dos APIs: `backend/src/index.js` lo requiere desde `../../api/_tarifas/servicio`, así que **un cambio de tarifas se hace ahí y no en cada API**. Lo que manda el navegador solo cuenta como "cobrado"; si difiere del precio de tarifa hace falta `motivoAjuste`. La reserva guarda el snapshot (`precio_tarifa`, `desglose`, `motivo_ajuste`) y no se recalcula si cambia una tarifa, salvo que se editen sus fechas o su unidad. Pileta no pasa por tarifas. Migración: `backend/migrate-tarifas.sql`.

## Servicios incluidos (pileta y cocheras de una carpa)

Spec: `docs/superpowers/specs/2026-09-26-servicios-incluidos-design.md`.

- **La lógica vive en `api/_incluidos/`**, compartida por las dos APIs igual que `_tarifas`: `reglas.js` (puro), `servicio.js` (recibe `query`) y `transaccion.js`. Un cambio de incluidos se hace ahí, no en cada API.
- **Un incluido es una reserva más** con `incluida_en_reserva_id` (la carpa) y `vinculo`: `'incluido'` se mueve y se cancela con la carpa; `'adicional'` (pase de pileta pago) solo se muestra junto a ella y no se toca solo. Los pases con nombre están en `pase_pileta_personas`. Migración: `backend/migrate-servicios-incluidos.sql`.
- **El alta y el PATCH de carpa, sombrilla y estacionamiento corren en una transacción** con `pg_advisory_xact_lock` por unidad (`bloquearUnidad`): el control de superposición sin bloqueo dejaba pasar dos altas simultáneas. En `api/index.js` la transacción usa `conTransaccion()` (cliente propio), nunca `db.query`, que abre un pool por consulta.
- **El pase de pileta incluido y la cochera incluida no se editan por su cuenta**: la API responde 409 `servicio_incluido_no_editable` (la cochera acepta plaza y patente).
- **Frontend:** `lib/incluidos.js` arma y valida lo que se manda; `ServiciosIncluidosFields` es el bloque de pileta y cocheras de los modales de carpa y sombrilla. Después de un cambio que toca varias reservas, `refrescarDatos()` en `App.jsx` vuelve a pedir grillas y listas.
- **Tope de personas y pases por unidad** son ajustes del establecimiento (`pases_pileta_por_carpa` 4, `pases_pileta_por_sombrilla` 0, `max_personas_por_unidad` 6).

## Seguridad

Antes de mergear cualquier feature que toque autenticación, autorización, upload de archivos u OAuth, pasar por `@security`.

Pendientes conocidos, fuera del alcance de lo hecho hasta ahora:

- `api/lib/auth.js` e `index.js` usan `process.env.JWT_SECRET || 'change_this_secret'`. El fallback hace que la app arranque sin secreto en vez de fallar ruidosamente.
- El token expira en 1 hora; la convención del equipo son 15 minutos de access token más refresh token.
- El login hashea con bcrypt rounds 10. Los endpoints nuevos de cambio de contraseña usan 12, así que cada usuario sube de rounds al cambiarla.

## Estado del modelo de datos

`establishments` tiene `UNIQUE (user_id)`: **un usuario = un establecimiento**. La columna `users.role` existe (`admin` | `operador`) pero por ahora es informativa — mientras esa restricción siga, no puede haber operadores. Romperla es el prerrequisito para usuarios múltiples por balneario.

Documentos de diseño en `docs/superpowers/specs/` y planes en `docs/superpowers/plans/`.
