# Panel de usuario — Perfil y Establecimiento

**Fecha:** 2026-09-21
**Estado:** aprobado, listo para plan de implementación
**Alcance:** bloque A de tres (ver *Fuera de alcance*)

---

## 1. Contexto

El item de menú `panel-usuario` existe en la navegación desde hace tiempo pero **no renderiza nada**: clickearlo no produce ningún efecto. Esta feature lo convierte en una pantalla real con dos solapas, Perfil y Establecimiento.

El pedido original abarcaba también roles con permisos y configuración de precios. Se decidió partirlo en tres bloques independientes y diseñar uno por vez. Este documento cubre solo el bloque A.

## 2. Hallazgos del código actual

Cuatro cosas verificadas sobre el código antes de diseñar. Condicionan las decisiones que siguen.

**El email del JWT no se usa para autorizar.** `signToken` arma el payload `{ userId, email }`, pero todos los endpoints resuelven el establecimiento por `user.id` (`SELECT ... FROM establishments WHERE user_id = $1`). Se rastrearon todos los usos de `.email` en `api/index.js`: los únicos son emails de *clientes*, no del usuario logueado.

**Consecuencia:** cambiar el email no invalida la sesión. No hace falta reemitir el token ni forzar re-login.

**`register` no está ruteado en producción.** `vercel.json` manda todo `/api/*` a `api/index.js`, y ese router solo implementa `login`. Los archivos `api/auth/register.js` y `api/_handlers/auth/register.js` son código muerto. El alta de usuarios se hace por el script interno `npm run create-user`.

**Consecuencia:** el panel será la única vía por la que un usuario pueda cambiar sus propias credenciales.

**No existe validación de contraseña.** Ni longitud mínima ni complejidad, en ningún punto del código. El hashing usa bcrypt con rounds 10.

**`EstablishmentConfigForm` recibe 25 props** desde `App.jsx`, que ya tiene 2781 líneas. El formulario se usa en dos lugares: el onboarding y la sección de configuración.

## 3. Modelo de datos

Un solo cambio, en `users`:

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'admin';

ALTER TABLE users
  ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'operador'));
```

El `DEFAULT 'admin'` hace que los usuarios existentes queden correctos sin migración de datos.

El `UNIQUE (user_id)` de `establishments` **no se toca**. Mientras siga vigente, un establecimiento tiene exactamente un usuario, y por lo tanto el rol es informativo: no hay operadores que crear todavía. Romper esa restricción es el bloque B.

## 4. Endpoints

Los tres se agregan al router de `api/index.js`, siguiendo el patrón de los existentes. Todos requieren token válido.

### `GET /api/auth/me`

Sin body. Devuelve el usuario logueado.

```json
{ "id": 2, "email": "admin@balneario.com", "role": "admin", "createdAt": "2025-11-23T..." }
```

Existe porque el rol no está ni en el token ni en la respuesta del login, y el panel necesita mostrarlo.

| Situación | Código | Respuesta |
|---|---|---|
| Sin token o token inválido | 401 | `{ "error": "missing_token" }` / `invalid_token` |

### `PATCH /api/auth/email`

```json
{ "newEmail": "nuevo@balneario.com", "currentPassword": "..." }
```

Valida formato, verifica que la contraseña actual sea correcta, comprueba que el email no esté tomado, y actualiza. Devuelve el usuario actualizado con la misma forma que `GET /me`.

| Situación | Código | Respuesta |
|---|---|---|
| Falta algún campo | 400 | `{ "error": "missing_fields" }` |
| Formato de email inválido | 400 | `{ "error": "invalid_email" }` |
| El email ya pertenece a otro usuario | 409 | `{ "error": "email_taken" }` |
| Contraseña actual incorrecta | 401 | `{ "error": "invalid_password" }` |

El token vigente **sigue siendo válido** tras el cambio, por lo explicado en Hallazgos. El frontend actualiza su estado local con la respuesta; el `email` que quedó dentro del token viejo es un dato muerto que nadie lee.

### `POST /api/auth/password`

```json
{ "currentPassword": "...", "newPassword": "..." }
```

Verifica la actual, exige mínimo 8 caracteres para la nueva, y guarda el hash.

| Situación | Código | Respuesta |
|---|---|---|
| Falta algún campo | 400 | `{ "error": "missing_fields" }` |
| Nueva de menos de 8 caracteres | 400 | `{ "error": "password_too_short" }` |
| Contraseña actual incorrecta | 401 | `{ "error": "invalid_password" }` |

Éxito: `200` con `{ "success": true }`. No devuelve token nuevo: la sesión sigue viva.

### Decisiones transversales

**Las dos mutaciones exigen la contraseña actual.** Cuesta poco y cierra un escenario concreto: en un balneario la sesión queda abierta en una computadora compartida, y sin ese pedido cualquiera que pase se apropia de la cuenta cambiando el mail.

**Mínimo 8 caracteres.** Hoy no hay ninguna validación — `admin123` entró sin chequeo. Es el piso, no un ideal.

**Los hashes nuevos usan rounds 12**, que es la convención del equipo. Los existentes (rounds 10) no se migran: bcrypt guarda el costo dentro del hash, así que `compare` sigue funcionando y cada usuario sube de rounds solo cuando cambia su contraseña.

## 5. Frontend

Componente nuevo `frontend/src/components/PanelUsuarioSection.jsx`. El estado de la solapa activa es local: no necesita subir a `App.jsx`.

**Solapa Perfil.** Email con acción de cambio, formulario de cambio de contraseña, y el nivel de acceso como badge de solo lectura. Ambas operaciones piden la contraseña actual, así que cada una es un formulario con dos campos como mínimo.

**Solapa Establecimiento.** Reusa `EstablishmentConfigForm` sin modificarlo.

### El problema de las 25 props

Si el panel envuelve el formulario, `App.jsx` tendría que pasarle las 25 props al panel para que las reenvíe — 25 líneas nuevas de cableado en un archivo que ya tiene 2781.

La solución es agrupar del lado de `App.jsx`: arma un único objeto y el panel lo desparrama.

```jsx
// App.jsx
const establecimiento = { estName, setEstName, estHasParking, /* ...las 25 */ };
<PanelUsuarioSection establecimiento={establecimiento} /* props de perfil */ />

// PanelUsuarioSection.jsx
<EstablishmentConfigForm {...establecimiento} />
```

**La firma de `EstablishmentConfigForm` no se toca**, así que el onboarding —el otro lugar que lo usa— sigue funcionando sin cambios. `App.jsx` pasa 1 prop en vez de 25.

Esto no arregla el tamaño de `App.jsx`, solo evita empeorarlo. Reducirlo de verdad es trabajo aparte, fuera de esta feature.

### Navegación

- `config-establecimiento` sale de `navItems` y de `sectionTitleMap`, y deja de renderizarse como sección propia.
- `panel-usuario` pasa a renderizar `PanelUsuarioSection` y gana su entrada en `sectionTitleMap` (hoy no la tiene).

## 6. Testing

### Backend — harness nuevo

El backend no tiene hoy ni un test ni infraestructura para correrlos. Esta feature toca autenticación, que es donde un bug no se nota mirando la pantalla, así que se monta el harness acá.

Vitest más supertest, mockeando `api/lib/db` para no depender de una base real.

```
api/
  index.test.js
  test/setup.js      # mock de lib/db
```

Casos:

- `GET /auth/me` — 401 sin token; devuelve el rol con token válido.
- `PATCH /auth/email` — rechaza contraseña actual incorrecta; rechaza email ya tomado; rechaza formato inválido; en el camino feliz persiste el nuevo email.
- `POST /auth/password` — rechaza contraseña actual incorrecta; rechaza menos de 8 caracteres; en el camino feliz guarda un hash con rounds 12 y el anterior deja de validar.

El costo de montarlo se estima en cerca de la mitad del trabajo total de la feature. Se acepta porque queda disponible para todo el backend de acá en adelante.

### Frontend

Test de componente para `PanelUsuarioSection`, siguiendo el patrón de `ReservasSection.test.jsx`: cambio de solapa, y los mensajes de validación de cada formulario.

## 7. Revisión de seguridad

El CLAUDE.md del equipo define un trigger event-based: llamar a `@security` antes de mergear a `develop` cualquier feature que toque autenticación. **Esta feature lo dispara.** La revisión va antes del merge, no al final del proyecto.

Dos cosas encontradas de paso, que **no** forman parte de esta feature pero conviene anotar:

- `api/lib/auth.js` usa `process.env.JWT_SECRET || 'change_this_secret'`. El fallback hace que la app arranque sin secreto configurado en vez de fallar ruidosamente.
- El token expira en 1 hora; la convención del equipo son 15 minutos de access token más refresh token.

## 8. Fuera de alcance

Los otros dos bloques, cada uno con su propio spec cuando llegue el momento:

**B — Usuarios y roles.** Varios usuarios por establecimiento, alta de operadores, permisos recortados por rol. Requiere romper el `UNIQUE (user_id)` de `establishments` y tocar la resolución de establecimiento en todos los endpoints.

**C — Precios.** Tarifa por servicio, tarifa de temporada completa, y tarifas personalizadas por rango de fechas con resolución de prioridad entre reglas superpuestas. Hoy no existe ninguna configuración de precios: el `daily_price` se tipea a mano en cada reserva.

También queda afuera reducir el tamaño de `App.jsx`.
