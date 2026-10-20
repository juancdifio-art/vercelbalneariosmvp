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

`api/index.js` solo implementa `login`. Los archivos `api/auth/register.js` y `api/_handlers/auth/register.js` nunca se ejecutan. El alta de usuarios la hace el administrador general desde la pantalla **Cuentas** (ver abajo); en local también sirve el script `cd backend && npm run create-user -- <email> <password>`.

### Mockear `pg` en los tests de la API

`api/` no declara `"type": "module"`, así que `index.js` es CommonJS y su `require('pg')` lo resuelve el require **nativo de Node**, fuera del grafo de módulos de vitest.

**Ni `vi.mock('pg')` ni un alias de Vite lo interceptan** — se probaron los dos y el test termina pegándole al `pg` real. La forma que funciona es sembrar el `require.cache` antes de importar `index.js`: ver `api/test/pg-mock.js`.

### El medio de pago se guarda en columnas distintas

En `reservation_payments`, la base local tiene la columna `method` (y `client_id`); `api/index.js` (producción) escribe y lee `payment_method`. Un `INSERT` de pagos escrito para una no anda en la otra.

Por eso el código compartido no inserta pagos por su cuenta: `_incluidos/servicio.js` recibe una función `insertarPago` que define cada API. Antes de desplegar algo que toque pagos, confirmar en Supabase qué columnas tiene la tabla.

En Supabase existen las dos columnas, pero `method` queda vacía. Al leer el medio de pago en producción, usar `COALESCE(p.payment_method, p.method)`: es lo que hace el reporte de pagos (`api/_handlers/reports/payments.js`), que antes leía `method` y mostraba todos los pagos sin medio, así que el filtro "solo efectivo" daba cero.

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
cd api && npm test        # 267 tests del router serverless y de _incluidos / _tarifas / _soporte / _cuentas / _contrato
cd frontend && npm test   # 365 tests de componentes y utilidades
```

`backend/src/index.js` **no tiene tests**. Cuando se replica un endpoint ahí, la cobertura viene del test equivalente en `api/`.

`api/incluidos-integracion.test.js` prueba el SQL de `_incluidos` contra la base local y **no corre con `npm test`** (queda en skipped). Hace todo en una transacción y la deshace:

```bash
cd api && DB_INTEGRACION=1 npx vitest run incluidos-integracion.test.js
```

`api/cuentas-integracion.test.js` hace lo mismo con el SQL de `_cuentas` (la copia de tarifas al crear una cuenta).

**Transacciones en los tests de `api/`:** `test/pg-mock.js` hace que `BEGIN`, `COMMIT`, `ROLLBACK` y `pg_advisory_xact_lock` no consuman respuestas de `queryMock` (van a `txMock`). Al preparar un test se mockean solo las consultas de datos, en orden.

## Convenciones propias

- **Iconos:** `frontend/src/components/icons.jsx` es la única fuente. Son de lucide-react, salvo la carpa, que es un SVG propio: ninguna librería dibuja la carpa de balneario (el `Tent` de lucide es de camping y se lee como toldo indígena).
- **Navegación:** `frontend/src/config/sections.js` define los grupos del menú y qué pantallas van a ancho completo. El menú de escritorio y el de mobile se arman de ahí.
- **Grillas de ocupación:** son `table-fixed`, así que **el ancho de columna lo define el `<th>`, no el `<td>`**. Ensanchar el `td` no hace nada.
- **Plano del balneario:** `frontend/src/config/planoZeus.js` es la fuente de verdad de qué carpas y sombrillas existen y dónde van. Con el plano activo, las listas de unidades salen de `numerosDeUnidades` (`frontend/src/lib/unidades.js`) y **no de 1..capacidad**: las carpas son 117 pero numeradas hasta la 134, con huecos (4-11, 26, 27, 77-83). Cualquier lista nueva de carpas o sombrillas tiene que usar ese helper. La capacidad configurada queda fija en lo que dice el plano. `docs/plano-zeus.html` es la versión suelta del mismo plano, con sus datos duplicados en `docs/plano-zeus.js`: si se corrige una unidad, corregirla en los dos.
- **Patente obligatoria en estacionamiento:** toda reserva `parking` lleva `vehicle_plate`. Las dos APIs la exigen (`vehicle_plate_required`) y la guardan normalizada (`AB123CD`), y los formularios no dejan guardar sin ella. Va en la reserva, no solo en la ficha del cliente, porque el mismo cliente puede venir con otro auto; la ficha solo sirve para completarla sola. Columna nueva: `backend/migrate-reservation-vehicle-plate.sql`.
- **Mostrar datos crudos:** montos con `formatPesos` (`lib/money.js`); medio de pago, fechas `YYYY-MM-DD` y nombre de la unidad con `lib/formato.js`. Nada de `toFixed` ni de `cash`/`transfer` en pantalla.
- **Manual de uso:** la fuente es `docs/manual/manual.html` con capturas en `docs/manual/img/`; el PDF se imprime con Edge headless (`msedge --headless=new --no-pdf-header-footer --print-to-pdf=...`). Si cambia una pantalla que sale en el manual, rehacer su captura.
- **Supabase no se pausa:** el cron de `vercel.json` llama a `/api/health` una vez por día. Si se quita, la base del plan gratis vuelve a pausarse tras una semana sin uso.
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
- **Personas en el alta:** el modal de carpa y sombrilla carga una fila por persona. Los acompañantes van a `reservation_guests` de **esa reserva**; solo el DNI y la fecha de nacimiento del titular vuelven a la ficha del cliente.
- **Cuenta única:** la carpa y todo lo suyo (cocheras, pase de pileta pago) se cobran con **un solo pago**, que `cobrarCuenta` reparte en orden (la carpa, las cocheras, la pileta paga) y guarda como un pago por reserva, así los reportes por rubro no cambian. En el alta va en `pagoInicial`, dentro de la transacción; después, por `POST /reservation-groups/:id/pago-cuenta`. El pase pago se vende en el alta con precio por día de adulto y de menor (`pasePago`).
- **Tope de personas y pases por unidad** son ajustes del establecimiento (`pases_pileta_por_carpa` 4, `pases_pileta_por_sombrilla` 0, `max_personas_por_unidad` 6).

## Chat de soporte

El balneario nos escribe desde la app (error, sugerencia o consulta) y respondemos desde una bandeja. Todo en la misma base, sin servicios externos: tabla `soporte_mensajes`, un hilo por establecimiento. Migración: `backend/migrate-soporte.sql`.

- **La lógica vive en `api/_soporte/servicio.js`** (`rutearSoporte`), compartida por las dos APIs como `_tarifas`. Rutas: `soporte/mensajes` y `soporte/no-leidos` para el establecimiento; `soporte/bandeja` y `soporte/bandeja/:estId` solo para el rol `soporte`.
- **Quién atiende la bandeja:** el rol `soporte` (cuenta que solo atiende, ve la bandeja a pantalla completa) o `users.atiende_soporte = true` (una cuenta con balneario que además atiende: suma "Bandeja de soporte" al menú). Las dos se habilitan solo por SQL. Migración: `backend/migrate-soporte-acceso.sql`.
- **Preguntas frecuentes:** el panel de Soporte abre en ellas (o en Mensajes si hay respuestas sin leer). El texto está en `frontend/src/config/preguntasFrecuentes.js` y sale del manual (`docs/manual/manual.html`, capítulo 14 y los "cómo hago" de cada capítulo): **si cambia el manual, revisar las respuestas**. Cada una lleva `secciones` para mostrarse primero en esa pantalla, y pasos con captura: las imágenes son copias de `docs/manual/img/` en `frontend/public/ayuda/`, así que **al rehacer una captura del manual hay que copiarla de nuevo ahí** (un test verifica que cada imagen nombrada exista).
- **El rol `soporte` se lee de la base en cada pedido**, no del token. El login devuelve `user.role` solo para que el frontend elija pantalla: con `soporte`, `App.jsx` muestra `BandejaSoporte` en vez del balneario. No hay alta por la app: se crea el usuario y se le pone `role = 'soporte'` por SQL, con una contraseña larga y aleatoria (esa cuenta ve todos los balnearios).
- **Frontend:** el botón Soporte del menú (`Sidebar` y el menú mobile, con contador de no leídos) abre `SoportePanel` encima de la pantalla actual, que se guarda con el mensaje. Componentes en `components/soporte/`, pedidos en `hooks/useSoporte.js`.
- **Envíos:** máximo 10 por minuto por lado, contados e insertados en una transacción con `pg_advisory_xact_lock` (`soporte:<estId>:<deSoporte>`). El hilo devuelve los últimos 200 mensajes.

## Contrato imprimible

Cada carpa y sombrilla imprime su contrato para firmar desde el detalle de la reserva (**Imprimir contrato**). El título y las condiciones generales los carga cada balneario en **Panel de usuario › Contrato**. Migración: `backend/migrate-contrato.sql` (`establishments.contrato_titulo`, `contrato_condiciones`, `contrato_datos`).

- **La API solo guarda el texto** (`api/_contrato/servicio.js`, ruta `contrato` GET/PUT, compartida por las dos APIs). El PDF lo arma el navegador: `lib/contrato.js` (puro: titular, unidad, período, importe de la cuenta, forma de pago, cocheras con su sector, nómina) y `utils/generateContrato.js` (jsPDF, A4).
- **La nómina deja `max_personas_por_unidad - 1` filas** (el titular va arriba). Lo que falta sale con puntos para completar a mano.
- **Formato de las condiciones:** cada renglón sale como está; uno escrito entre `**` y `**` sale en negrita.
- **Datos del contrato** (`establishments.contrato_datos`, JSONB `[{ nombre, valor }]`): fechas, horarios y cantidades. En el título y las condiciones, `{Nombre}` se cambia por el valor al imprimir (`reemplazarDatos` en `lib/contrato.js`; sin distinguir mayúsculas). `{Máximo de personas}` y `{Balneario}` los pone el sistema desde la configuración del establecimiento y le ganan a un dato cargado con el mismo nombre. Un dato sin valor sale con puntos; un `{Nombre}` que no es dato queda tal cual y la solapa lo avisa.
- **Las fuentes de jsPDF solo traen Latin-1:** `aTextoPdf` pasa guiones y comillas tipográficas a simples y quita lo que no entra. Acentos y eñes andan.
- El texto de Zeus, transcripto tal cual de `docs/Contrato zeus*.jpeg`, está en `backend/supabase-zeus-contrato.sql`.

## Administrador general de cuentas

Una cuenta con `users.administra_cuentas = true` ve todas las cuentas de la app, crea la de cada balneario y le genera una clave nueva a quien la olvidó. Se habilita solo por SQL. Migración: `backend/migrate-administra-cuentas.sql`.

- **La lógica vive en `api/_cuentas/servicio.js`** (`rutearCuentas`), compartida por las dos APIs como `_soporte`. Recibe `hashear` de cada API (bcrypt 12), así no importa bcrypt. Rutas: `cuentas/acceso` (cualquier cuenta: si administra), `cuentas` GET/POST y `cuentas/:id/clave` POST.
- **El permiso se lee de la base en cada pedido**, no del token, igual que el de soporte.
- **Alta:** el email se guarda en minúsculas y la clave la genera el servidor (`Kp7m-x4Qz-9tRw`) y se muestra una sola vez. Con un balneario modelo (`copiarDe`) se crea el establecimiento con su configuración, períodos, sectores (con sus unidades) y tarifas, sin clientes ni reservas, todo en una transacción. Sin modelo se crea solo el usuario y el cliente configura su balneario al entrar.
- **Clave nueva:** no para la cuenta propia (se cambia en Panel de usuario) ni para otro administrador general.
- **Frontend:** `hooks/useCuentas.js` y `components/cuentas/PanelCuentas.jsx`. Con balneario, el menú suma **Cuentas**; sin balneario, el panel ocupa la pantalla (como la bandeja del rol `soporte`).

## Seguridad

Antes de mergear cualquier feature que toque autenticación, autorización, upload de archivos u OAuth, pasar por `@security`.

**El repo de GitHub es público.** Nada de claves, hashes de claves reales ni credenciales en el código, los tests o los docs. La clave `admin123` de `admin@balneario.com` quedó en el historial: esa cuenta tiene que tener otra clave en cualquier base que se use en serio.

Pendientes conocidos, fuera del alcance de lo hecho hasta ahora:

- `api/lib/auth.js` e `index.js` usan `process.env.JWT_SECRET || 'change_this_secret'`. El fallback hace que la app arranque sin secreto en vez de fallar ruidosamente.
- El token expira en 1 hora; la convención del equipo son 15 minutos de access token más refresh token.
- El login hashea con bcrypt rounds 10. Los endpoints nuevos de cambio de contraseña usan 12, así que cada usuario sube de rounds al cambiarla.
- El login no tiene rate limiting por IP ni por cuenta, y con un email inexistente responde sin correr bcrypt (se puede averiguar qué emails existen). Pesa más desde que existe el rol `soporte`. En Vercel un límite en memoria no sirve: tiene que vivir en la base (tabla de intentos por `ip:` y `cuenta:`, 15 minutos).

## Estado del modelo de datos

`establishments` tiene `UNIQUE (user_id)`: **un usuario = un establecimiento**. La columna `users.role` existe (`admin` | `operador`) pero por ahora es informativa — mientras esa restricción siga, no puede haber operadores. Romperla es el prerrequisito para usuarios múltiples por balneario.

Documentos de diseño en `docs/superpowers/specs/` y planes en `docs/superpowers/plans/`.
