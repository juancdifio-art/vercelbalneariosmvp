# Panel de usuario — Perfil y Establecimiento — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Convertir el item de menú `panel-usuario` —hoy vacío— en una pantalla con dos solapas: Perfil (cambiar mail, cambiar contraseña, ver nivel de acceso) y Establecimiento.

**Architecture:** Tres endpoints nuevos en el router de `api/index.js`, una columna `role` en `users`, y un componente `PanelUsuarioSection` con estado de solapa local. La sección `config-establecimiento` desaparece del sidebar y su formulario se reusa dentro de la solapa Establecimiento, sin modificar su firma.

**Tech Stack:** Node (handler serverless plano, sin Express) · PostgreSQL · React 18 + Vite + Tailwind · Vitest + Testing Library (frontend) · Vitest + Supertest (API, se monta en la Tarea 1)

**Spec:** [`docs/superpowers/specs/2026-09-21-panel-usuario-perfil-design.md`](../specs/2026-09-21-panel-usuario-perfil-design.md)

## Global Constraints

- **`api/index.js` es autocontenido.** Define su propio `createPool()`, su propio `db` (línea 35), su propio `JWT_SECRET` (línea 48) y su propio `authenticateToken` (línea 55). **No usa `api/lib/*`** — esos archivos son código muerto en producción. Todo el código nuevo de API va dentro de `api/index.js`.
- **Ruteo por query param.** `vercel.json` manda `/api/(.*)` a `/api/index.js?route=$1`. El router lee `route`, lo parte, y compara `first` (segmento 1) y `second` (segmento 2). Una ruta nueva es un `if (first === 'auth' && second === 'xxx')`.
- **Sin framework.** No hay `res.send` ni middlewares. El patrón es `res.statusCode = N; res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({...}))`.
- **`db.query(text, params)`** abre un pool, consulta y lo cierra. Devuelve el result de `pg` (`result.rows`).
- **bcrypt** está importado como `bcrypt` (paquete `bcryptjs`), línea 3.
- **Hashes nuevos con rounds 12.** El login existente usa 10; no se migran los hashes viejos.
- **Mínimo 8 caracteres** para contraseña nueva.
- **Las dos mutaciones exigen `currentPassword`.**
- **Verificar la contraseña ANTES de consultar si el email está tomado**, para no filtrar qué emails existen a alguien con una sesión robada.
- **El token sigue válido tras cambiar el email.** El `email` del payload JWT no se usa para autorizar en ningún endpoint; todo resuelve por `userId`.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `backend/migrate-user-role.sql` | *Crear.* Migración de la columna `role`. |
| `backend/schema.sql` | *Modificar.* Agregar `role` para instalaciones nuevas. |
| `api/vitest.config.mjs` | *Crear.* Config de tests de API (entorno node). Extensión .mjs porque api/ es CommonJS. |
| `api/test/pg-mock.js` | *Crear.* Doble de `pg` sembrado en el require.cache. |
| `api/index.test.js` | *Crear.* Tests de los tres endpoints. |
| `api/package.json` | *Modificar.* Script `test` y devDependencies. |
| `api/index.js` | *Modificar.* Tres bloques de ruta nuevos. |
| `frontend/src/components/PanelUsuarioSection.jsx` | *Crear.* Panel con solapas. |
| `frontend/src/components/PanelUsuarioSection.test.jsx` | *Crear.* Test de componente. |
| `frontend/src/App.jsx` | *Modificar.* Cableado y navegación. |

---

## Task 1: Harness de tests de API + `GET /api/auth/me`

Monta la infraestructura de tests del backend (hoy inexistente) y la estrena con el endpoint más simple. La columna `role` entra acá porque `/me` es quien la devuelve.

**Files:**
- Create: `backend/migrate-user-role.sql`
- Modify: `backend/schema.sql`
- Create: `api/vitest.config.mjs`
- Create: `api/test/pg-mock.js`
- Create: `api/index.test.js`
- Modify: `api/package.json`
- Modify: `api/index.js` (insertar antes del bloque `/api/auth/login`, línea ~214)

**Interfaces:**
- Consumes: nada.
- Produces: `GET /api/auth/me` → `200 { id, email, role, createdAt }`. El helper de test `tokenPara(id)` y el mock `queryMock`, que las Tareas 2 y 3 reusan.

- [x] **Step 1: Escribir la migración**

Crear `backend/migrate-user-role.sql`:

```sql
-- Migración: nivel de acceso del usuario
-- El DEFAULT 'admin' deja correctos a los usuarios existentes sin migrar datos.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'admin';

-- Postgres no soporta ADD CONSTRAINT IF NOT EXISTS, así que se chequea a mano
-- para que la migración sea idempotente.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check') THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'operador'));
  END IF;
END $$;
```

- [x] **Step 2: Reflejarlo en el schema base**

En `backend/schema.sql`, en el `CREATE TABLE IF NOT EXISTS users`, agregar la columna después de `password_hash`:

```sql
  role VARCHAR(20) NOT NULL DEFAULT 'admin',
```

- [x] **Step 3: Instalar las dependencias de test**

```bash
cd api && npm install --save-dev vitest supertest
```

- [x] **Step 4: Agregar el script de test**

En `api/package.json`, agregar la clave `scripts` (hoy el archivo no la tiene):

```json
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

- [x] **Step 5: Crear la config de vitest**

Crear `api/vitest.config.mjs` (la extensión .mjs evita el warning de ESM en un paquete CommonJS):

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['*.test.js']
  }
});
```

- [x] **Step 6: Escribir el test que falla**

Crear `api/index.test.js`. El mock es de `pg`, no de `lib/db`, porque `api/index.js` arma su propio pool.

Primero el doble de `pg`, en `api/test/pg-mock.js`:

```js
import { createRequire } from 'node:module';
import { vi } from 'vitest';

export const queryMock = vi.fn();

export class Pool {
  query(...args) {
    return queryMock(...args);
  }
  end() {
    return Promise.resolve();
  }
}

const require = createRequire(import.meta.url);
const pgPath = require.resolve('pg');

require.cache[pgPath] = {
  id: pgPath, filename: pgPath, path: pgPath,
  loaded: true, children: [], paths: [],
  exports: { Pool }
};
```

> **Por qué así y no con `vi.mock('pg')`.** Se probaron las dos alternativas obvias y ninguna funciona: `api/` no declara `"type": "module"`, así que `index.js` es CommonJS y su `require('pg')` lo resuelve el require **nativo de Node**, que no pasa por el grafo de módulos de vitest. Ni `vi.mock` ni un alias de Vite lo interceptan — el test llega al `pg` real e intenta resolver el host de `DATABASE_URL`. Sembrar el `require.cache` antes de que `index.js` se cargue sí lo intercepta. El orden funciona porque los `import` estáticos del test se evalúan antes del `await import('./index.js')`.

Y el test en `api/index.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { queryMock } from './test/pg-mock.js';

// index.js lee JWT_SECRET al cargarse, así que hay que fijarlo antes de importarlo.
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgres://test';

const handler = (await import('./index.js')).default;

function tokenPara(userId, email = 'admin@balneario.com') {
  return jwt.sign({ userId, email }, 'test-secret', { expiresIn: '1h' });
}

beforeEach(() => {
  queryMock.mockReset();
});

describe('GET /api/auth/me', () => {
  it('rechaza el pedido sin token', async () => {
    const res = await request(handler).get('/?route=auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('missing_token');
  });

  it('rechaza un token invalido', async () => {
    const res = await request(handler)
      .get('/?route=auth/me')
      .set('Authorization', 'Bearer no-es-un-token');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_token');
  });

  it('devuelve el usuario con su nivel de acceso', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 2, email: 'admin@balneario.com', role: 'admin', created_at: '2025-11-23T10:00:00.000Z' }]
    });

    const res = await request(handler)
      .get('/?route=auth/me')
      .set('Authorization', `Bearer ${tokenPara(2)}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 2,
      email: 'admin@balneario.com',
      role: 'admin',
      createdAt: '2025-11-23T10:00:00.000Z'
    });
  });
});
```

- [x] **Step 7: Correr el test y verificar que falla**

Run: `cd api && npm test`
Expected: **los 3 fallan con `404 not_found`**. Sin el bloque de ruta, `auth/me` no matchea ningún `if` y cae al 404 del final del router — incluso los dos casos que esperan 401, porque el chequeo de token todavía no llega a ejecutarse.

- [x] **Step 8: Implementar el endpoint**

En `api/index.js`, insertar este bloque **antes** del comentario `// ============= /api/auth/login =============`:

```js
    // ============= /api/auth/me =============
    if (first === 'auth' && second === 'me') {
      if (method !== 'GET') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'method_not_allowed' }));
      }

      const auth = authenticateToken(req, res);
      if (!auth) return;

      try {
        const result = await db.query(
          'SELECT id, email, role, created_at FROM users WHERE id = $1',
          [auth.id]
        );

        if (result.rows.length === 0) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'user_not_found' }));
        }

        const row = result.rows[0];
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({
          id: row.id,
          email: row.email,
          role: row.role,
          createdAt: row.created_at
        }));
      } catch (error) {
        console.error('Error in /api/auth/me:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'server_error' }));
      }
    }
```

- [x] **Step 9: Correr los tests y verificar que pasan**

Run: `cd api && npm test`
Expected: 3 tests en verde.

- [x] **Step 10: Aplicar la migración en la base local**

```bash
psql -U balneariosmvp_user -d balnearios_mvp -f backend/migrate-user-role.sql
```

Verificar: `psql -U balneariosmvp_user -d balnearios_mvp -c "SELECT id, email, role FROM users;"` debe mostrar `admin` en la columna `role`.

- [x] **Step 11: Commit**

```bash
git add backend/migrate-user-role.sql backend/schema.sql api/vitest.config.mjs api/test/pg-mock.js api/index.test.js api/package.json api/package-lock.json api/index.js
git commit -m "feat: agregar columna role y endpoint GET /api/auth/me con harness de tests"
```

---

## Task 2: `POST /api/auth/password`

**Files:**
- Modify: `api/index.test.js`
- Modify: `api/index.js` (insertar después del bloque `/api/auth/me`)

**Interfaces:**
- Consumes: `tokenPara(id)` y `queryMock` de la Tarea 1.
- Produces: `POST /api/auth/password` con body `{ currentPassword, newPassword }` → `200 { success: true }`.

- [x] **Step 1: Escribir los tests que fallan**

Agregar al final de `api/index.test.js`. Requiere importar bcrypt arriba del archivo, junto a los otros imports:

```js
import bcrypt from 'bcryptjs';
```

Y el bloque de tests:

```js
describe('POST /api/auth/password', () => {
  it('rechaza si falta algun campo', async () => {
    const res = await request(handler)
      .post('/?route=auth/password')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ currentPassword: 'admin123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('missing_fields');
  });

  it('rechaza una contrasena nueva de menos de 8 caracteres', async () => {
    const res = await request(handler)
      .post('/?route=auth/password')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ currentPassword: 'admin123', newPassword: 'corta' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('password_too_short');
  });

  it('rechaza si la contrasena actual no coincide', async () => {
    const hash = await bcrypt.hash('admin123', 10);
    queryMock.mockResolvedValueOnce({ rows: [{ password_hash: hash }] });

    const res = await request(handler)
      .post('/?route=auth/password')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ currentPassword: 'equivocada', newPassword: 'unaClaveLarga' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_password');
  });

  it('guarda el hash nuevo con rounds 12', async () => {
    const hash = await bcrypt.hash('admin123', 10);
    queryMock.mockResolvedValueOnce({ rows: [{ password_hash: hash }] });
    queryMock.mockResolvedValueOnce({ rows: [] });

    const res = await request(handler)
      .post('/?route=auth/password')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ currentPassword: 'admin123', newPassword: 'unaClaveLarga' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    // Segunda llamada = el UPDATE. El hash viaja como primer parametro.
    const [sql, params] = queryMock.mock.calls[1];
    expect(sql).toContain('UPDATE users');
    expect(params[0]).toMatch(/^\$2[aby]\$12\$/);
    expect(await bcrypt.compare('unaClaveLarga', params[0])).toBe(true);
  });
});
```

- [x] **Step 2: Correr y verificar que fallan**

Run: `cd api && npm test`
Expected: los 4 tests nuevos fallan con `404 not_found`.

- [x] **Step 3: Implementar el endpoint**

En `api/index.js`, insertar después del bloque `/api/auth/me`:

```js
    // ============= /api/auth/password =============
    if (first === 'auth' && second === 'password') {
      if (method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'method_not_allowed' }));
      }

      const auth = authenticateToken(req, res);
      if (!auth) return;

      try {
        const { currentPassword, newPassword } = await parseJsonBody(req);

        if (!currentPassword || !newPassword) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'missing_fields' }));
        }

        if (String(newPassword).length < 8) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'password_too_short' }));
        }

        const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [auth.id]);

        if (result.rows.length === 0) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'user_not_found' }));
        }

        const matches = await bcrypt.compare(currentPassword, result.rows[0].password_hash);

        if (!matches) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'invalid_password' }));
        }

        const nextHash = await bcrypt.hash(newPassword, 12);
        await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [nextHash, auth.id]);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ success: true }));
      } catch (error) {
        console.error('Error in /api/auth/password:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'server_error' }));
      }
    }
```

- [x] **Step 4: Correr y verificar que pasan**

Run: `cd api && npm test`
Expected: 7 tests en verde.

- [x] **Step 5: Commit**

```bash
git add api/index.js api/index.test.js
git commit -m "feat: endpoint POST /api/auth/password con verificacion de clave actual"
```

---

## Task 3: `PATCH /api/auth/email`

**Files:**
- Modify: `api/index.test.js`
- Modify: `api/index.js` (insertar después del bloque `/api/auth/password`)

**Interfaces:**
- Consumes: `tokenPara(id)` y `queryMock` de la Tarea 1.
- Produces: `PATCH /api/auth/email` con body `{ newEmail, currentPassword }` → `200 { id, email, role, createdAt }`.

- [x] **Step 1: Escribir los tests que fallan**

Agregar al final de `api/index.test.js`:

```js
describe('PATCH /api/auth/email', () => {
  it('rechaza un formato de email invalido', async () => {
    const res = await request(handler)
      .patch('/?route=auth/email')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ newEmail: 'no-es-un-mail', currentPassword: 'admin123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_email');
  });

  it('rechaza si la contrasena actual no coincide', async () => {
    const hash = await bcrypt.hash('admin123', 10);
    queryMock.mockResolvedValueOnce({ rows: [{ password_hash: hash }] });

    const res = await request(handler)
      .patch('/?route=auth/email')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ newEmail: 'nuevo@balneario.com', currentPassword: 'equivocada' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_password');
  });

  it('rechaza un email que ya pertenece a otro usuario', async () => {
    const hash = await bcrypt.hash('admin123', 10);
    queryMock.mockResolvedValueOnce({ rows: [{ password_hash: hash }] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 9 }] });

    const res = await request(handler)
      .patch('/?route=auth/email')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ newEmail: 'ocupado@balneario.com', currentPassword: 'admin123' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('email_taken');
  });

  it('normaliza el email y lo guarda', async () => {
    const hash = await bcrypt.hash('admin123', 10);
    queryMock.mockResolvedValueOnce({ rows: [{ password_hash: hash }] });
    queryMock.mockResolvedValueOnce({ rows: [] });
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 2, email: 'nuevo@balneario.com', role: 'admin', created_at: '2025-11-23T10:00:00.000Z' }]
    });

    const res = await request(handler)
      .patch('/?route=auth/email')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ newEmail: '  NUEVO@Balneario.com  ', currentPassword: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('nuevo@balneario.com');

    // Segunda llamada = el chequeo de unicidad, con el mail ya normalizado.
    expect(queryMock.mock.calls[1][1][0]).toBe('nuevo@balneario.com');
  });

  it('chequea la contrasena antes que la unicidad del email', async () => {
    const hash = await bcrypt.hash('admin123', 10);
    queryMock.mockResolvedValueOnce({ rows: [{ password_hash: hash }] });

    await request(handler)
      .patch('/?route=auth/email')
      .set('Authorization', `Bearer ${tokenPara(2)}`)
      .send({ newEmail: 'ocupado@balneario.com', currentPassword: 'equivocada' });

    // Solo la consulta del hash: nunca se pregunto si el email existe.
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});
```

- [x] **Step 2: Correr y verificar que fallan**

Run: `cd api && npm test`
Expected: los 5 tests nuevos fallan con `404 not_found`.

- [x] **Step 3: Implementar el endpoint**

En `api/index.js`, insertar después del bloque `/api/auth/password`:

```js
    // ============= /api/auth/email =============
    if (first === 'auth' && second === 'email') {
      if (method !== 'PATCH') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'method_not_allowed' }));
      }

      const auth = authenticateToken(req, res);
      if (!auth) return;

      try {
        const { newEmail, currentPassword } = await parseJsonBody(req);

        if (!newEmail || !currentPassword) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'missing_fields' }));
        }

        const normalized = String(newEmail).trim().toLowerCase();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'invalid_email' }));
        }

        const userResult = await db.query('SELECT password_hash FROM users WHERE id = $1', [auth.id]);

        if (userResult.rows.length === 0) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'user_not_found' }));
        }

        const matches = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);

        // Se verifica la clave antes de consultar la unicidad para no filtrar
        // que emails existen a alguien que se encontro la sesion abierta.
        if (!matches) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'invalid_password' }));
        }

        const taken = await db.query(
          'SELECT id FROM users WHERE email = $1 AND id <> $2',
          [normalized, auth.id]
        );

        if (taken.rows.length > 0) {
          res.statusCode = 409;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'email_taken' }));
        }

        const updated = await db.query(
          'UPDATE users SET email = $1 WHERE id = $2 RETURNING id, email, role, created_at',
          [normalized, auth.id]
        );

        const row = updated.rows[0];
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({
          id: row.id,
          email: row.email,
          role: row.role,
          createdAt: row.created_at
        }));
      } catch (error) {
        console.error('Error in /api/auth/email:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'server_error' }));
      }
    }
```

- [x] **Step 4: Correr y verificar que pasan**

Run: `cd api && npm test`
Expected: 12 tests en verde.

- [x] **Step 5: Commit**

```bash
git add api/index.js api/index.test.js
git commit -m "feat: endpoint PATCH /api/auth/email con normalizacion y chequeo de unicidad"
```

---

## Task 4: Componente `PanelUsuarioSection`

**Files:**
- Create: `frontend/src/components/PanelUsuarioSection.jsx`
- Create: `frontend/src/components/PanelUsuarioSection.test.jsx`

**Interfaces:**
- Consumes: los tres endpoints de las Tareas 1–3. `EstablishmentConfigForm` (existente, 25 props, **firma sin cambios**).
- Produces: `PanelUsuarioSection` con props `{ authToken, userEmail, onEmailChanged, establecimiento }`. `onEmailChanged` es `(nuevoEmail: string) => void`. `establecimiento` es el objeto con las 25 props del formulario.

- [x] **Step 1: Escribir el test que falla**

Crear `frontend/src/components/PanelUsuarioSection.test.jsx`:

```jsx
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PanelUsuarioSection from './PanelUsuarioSection';

const ESTABLECIMIENTO = {
  estName: 'Zeus',
  setEstName: vi.fn(),
  estHasParking: true,
  setEstHasParking: vi.fn(),
  estParkingCapacity: 300,
  setEstParkingCapacity: vi.fn(),
  estHasCarpas: true,
  setEstHasCarpas: vi.fn(),
  estCarpasCapacity: 103,
  setEstCarpasCapacity: vi.fn(),
  estHasSombrillas: true,
  setEstHasSombrillas: vi.fn(),
  estSombrillasCapacity: 218,
  setEstSombrillasCapacity: vi.fn(),
  estHasPileta: false,
  setEstHasPileta: vi.fn(),
  estPoolMaxOccupancy: null,
  setEstPoolMaxOccupancy: vi.fn(),
  onSubmit: vi.fn((e) => e.preventDefault()),
  estSaving: false,
  error: '',
  success: ''
};

function renderPanel(props = {}) {
  return render(
    <PanelUsuarioSection
      authToken="token-de-prueba"
      userEmail="admin@balneario.com"
      onEmailChanged={vi.fn()}
      establecimiento={ESTABLECIMIENTO}
      {...props}
    />
  );
}

beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ id: 2, email: 'admin@balneario.com', role: 'admin', createdAt: '2025-11-23T10:00:00.000Z' })
    })
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PanelUsuarioSection', () => {
  it('arranca en la solapa Perfil y muestra el email', async () => {
    renderPanel();

    expect(await screen.findByText('admin@balneario.com')).toBeInTheDocument();
  });

  it('muestra el nivel de acceso que devuelve la API', async () => {
    renderPanel();

    expect(await screen.findByText('Administrador')).toBeInTheDocument();
  });

  it('cambia a la solapa Establecimiento al clickearla', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Establecimiento' }));

    expect(screen.getByDisplayValue('Zeus')).toBeInTheDocument();
  });

  it('avisa si la contrasena nueva tiene menos de 8 caracteres', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Cambiar contraseña' }));
    await user.type(screen.getByLabelText('Contraseña actual'), 'admin123');
    await user.type(screen.getByLabelText('Contraseña nueva'), 'corta');
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

    expect(await screen.findByText('La contraseña nueva necesita al menos 8 caracteres.')).toBeInTheDocument();
  });

  it('no llama a la API si la validacion local falla', async () => {
    const user = userEvent.setup();
    renderPanel();

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1)); // el GET /me del montaje

    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    await user.type(screen.getByLabelText('Contraseña actual'), 'admin123');
    await user.type(screen.getByLabelText('Contraseña nueva'), 'corta');
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
```

- [x] **Step 2: Correr y verificar que falla**

Run: `cd frontend && npx vitest run src/components/PanelUsuarioSection.test.jsx`
Expected: FAIL — el módulo `./PanelUsuarioSection` no existe.

- [x] **Step 3: Implementar el componente**

Crear `frontend/src/components/PanelUsuarioSection.jsx`:

```jsx
import React, { useEffect, useState } from 'react';
import { getApiBaseUrl } from '../apiConfig';
import EstablishmentConfigForm from './EstablishmentConfigForm';

const API_BASE_URL = getApiBaseUrl();

const ETIQUETA_ROL = {
  admin: 'Administrador',
  operador: 'Operador'
};

/**
 * Panel de usuario: perfil y configuracion del establecimiento.
 *
 * Son dos solapas y no una pagina apilada porque mas adelante entran Precios y
 * Usuarios; con solapas, sumar una es agregar un item a SOLAPAS.
 *
 * El establecimiento llega como un unico objeto `establecimiento` en vez de 25
 * props sueltas: asi App.jsx —que ya tiene 2781 lineas— no suma 25 lineas de
 * cableado, y la firma de EstablishmentConfigForm queda intacta para que el
 * onboarding la siga usando igual.
 */
const SOLAPAS = [
  { id: 'perfil', label: 'Perfil' },
  { id: 'establecimiento', label: 'Establecimiento' }
];

function PanelUsuarioSection({ authToken, userEmail, onEmailChanged, establecimiento }) {
  const [solapa, setSolapa] = useState('perfil');
  const [perfil, setPerfil] = useState(null);

  const [editandoEmail, setEditandoEmail] = useState(false);
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailOk, setEmailOk] = useState('');
  const [emailGuardando, setEmailGuardando] = useState(false);

  const [editandoPassword, setEditandoPassword] = useState(false);
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordOk, setPasswordOk] = useState('');
  const [passwordGuardando, setPasswordGuardando] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function traerPerfil() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelado) setPerfil(data);
      } catch (err) {
        // Sin perfil solo se pierde el badge de nivel de acceso; el resto del
        // panel sigue usable, asi que no se muestra error.
      }
    }

    if (authToken) traerPerfil();
    return () => {
      cancelado = true;
    };
  }, [authToken]);

  const emailMostrado = (perfil && perfil.email) || userEmail;

  async function guardarEmail(e) {
    e.preventDefault();
    setEmailError('');
    setEmailOk('');

    if (!nuevoEmail || !emailPassword) {
      setEmailError('Completá el email nuevo y tu contraseña.');
      return;
    }

    setEmailGuardando(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/email`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ newEmail: nuevoEmail, currentPassword: emailPassword })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const mensajes = {
          invalid_email: 'Ese email no tiene un formato válido.',
          email_taken: 'Ese email ya está en uso.',
          invalid_password: 'La contraseña no es correcta.',
          missing_fields: 'Faltan datos.'
        };
        setEmailError((data && mensajes[data.error]) || 'No se pudo cambiar el email.');
        return;
      }

      setPerfil(data);
      setEmailOk('Email actualizado.');
      setEditandoEmail(false);
      setNuevoEmail('');
      setEmailPassword('');
      if (typeof onEmailChanged === 'function') onEmailChanged(data.email);
    } catch (err) {
      setEmailError('No se pudo conectar con el servidor.');
    } finally {
      setEmailGuardando(false);
    }
  }

  async function guardarPassword(e) {
    e.preventDefault();
    setPasswordError('');
    setPasswordOk('');

    if (!passwordActual || !passwordNueva) {
      setPasswordError('Completá las dos contraseñas.');
      return;
    }

    // Se valida acá antes de salir a la red: el error es el mismo y el usuario
    // lo ve al instante.
    if (passwordNueva.length < 8) {
      setPasswordError('La contraseña nueva necesita al menos 8 caracteres.');
      return;
    }

    setPasswordGuardando(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ currentPassword: passwordActual, newPassword: passwordNueva })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const mensajes = {
          invalid_password: 'La contraseña actual no es correcta.',
          password_too_short: 'La contraseña nueva necesita al menos 8 caracteres.',
          missing_fields: 'Faltan datos.'
        };
        setPasswordError((data && mensajes[data.error]) || 'No se pudo cambiar la contraseña.');
        return;
      }

      setPasswordOk('Contraseña actualizada.');
      setEditandoPassword(false);
      setPasswordActual('');
      setPasswordNueva('');
    } catch (err) {
      setPasswordError('No se pudo conectar con el servidor.');
    } finally {
      setPasswordGuardando(false);
    }
  }

  return (
    <div className="rounded-xl bg-sky-50 border border-cyan-100 px-4 py-4 text-sm">
      <div className="flex gap-1 border-b border-cyan-200 mb-4">
        {SOLAPAS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSolapa(s.id)}
            className={
              'px-4 py-2 text-[13px] font-medium rounded-t-lg transition ' +
              (solapa === s.id
                ? 'bg-white text-cyan-900 border border-cyan-200 border-b-white -mb-px'
                : 'text-slate-600 hover:text-cyan-800')
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {solapa === 'perfil' && (
        <div className="space-y-5 max-w-lg">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Email</p>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-900 font-medium">{emailMostrado}</span>
              <button
                type="button"
                onClick={() => setEditandoEmail((v) => !v)}
                className="text-[12px] px-3 py-1 rounded-full border border-cyan-400 bg-white hover:bg-cyan-50"
              >
                Cambiar email
              </button>
            </div>
            {emailOk && <p className="text-[12px] text-emerald-700 mt-1">{emailOk}</p>}

            {editandoEmail && (
              <form onSubmit={guardarEmail} className="mt-3 space-y-2">
                <label className="block text-[12px] text-slate-700">
                  Email nuevo
                  <input
                    type="email"
                    value={nuevoEmail}
                    onChange={(e) => setNuevoEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block text-[12px] text-slate-700">
                  Tu contraseña
                  <input
                    type="password"
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                {emailError && <p className="text-[12px] text-rose-700">{emailError}</p>}
                <button
                  type="submit"
                  disabled={emailGuardando}
                  className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-[13px] disabled:opacity-60"
                >
                  {emailGuardando ? 'Guardando…' : 'Guardar email'}
                </button>
              </form>
            )}
          </div>

          <div className="border-t border-cyan-100 pt-4">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Contraseña</p>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">••••••••</span>
              <button
                type="button"
                onClick={() => setEditandoPassword((v) => !v)}
                className="text-[12px] px-3 py-1 rounded-full border border-cyan-400 bg-white hover:bg-cyan-50"
              >
                Cambiar contraseña
              </button>
            </div>
            {passwordOk && <p className="text-[12px] text-emerald-700 mt-1">{passwordOk}</p>}

            {editandoPassword && (
              <form onSubmit={guardarPassword} className="mt-3 space-y-2">
                <label className="block text-[12px] text-slate-700">
                  Contraseña actual
                  <input
                    type="password"
                    value={passwordActual}
                    onChange={(e) => setPasswordActual(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block text-[12px] text-slate-700">
                  Contraseña nueva
                  <input
                    type="password"
                    value={passwordNueva}
                    onChange={(e) => setPasswordNueva(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                {passwordError && <p className="text-[12px] text-rose-700">{passwordError}</p>}
                <button
                  type="submit"
                  disabled={passwordGuardando}
                  className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-[13px] disabled:opacity-60"
                >
                  {passwordGuardando ? 'Guardando…' : 'Guardar contraseña'}
                </button>
              </form>
            )}
          </div>

          <div className="border-t border-cyan-100 pt-4">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Nivel de acceso</p>
            <span className="inline-block px-3 py-1 rounded-full bg-cyan-100 text-cyan-900 text-[12px] font-medium">
              {(perfil && ETIQUETA_ROL[perfil.role]) || '—'}
            </span>
          </div>
        </div>
      )}

      {solapa === 'establecimiento' && (
        <div>
          <p className="text-[11px] text-slate-600 mb-4">
            Actualizá el nombre y los servicios del establecimiento. Los cambios impactan en todas las secciones.
          </p>
          <EstablishmentConfigForm variant="light" {...establecimiento} />
        </div>
      )}
    </div>
  );
}

export default PanelUsuarioSection;
```

- [x] **Step 4: Correr y verificar que pasan**

Run: `cd frontend && npx vitest run src/components/PanelUsuarioSection.test.jsx`
Expected: 5 tests en verde.

- [x] **Step 5: Correr toda la suite del frontend**

Run: `cd frontend && npm test`
Expected: 18 tests en verde (13 previos + 5 nuevos).

- [x] **Step 6: Commit**

```bash
git add frontend/src/components/PanelUsuarioSection.jsx frontend/src/components/PanelUsuarioSection.test.jsx
git commit -m "feat: componente PanelUsuarioSection con solapas Perfil y Establecimiento"
```

---

## Task 5: Cablear el panel y sacar Establecimiento del sidebar

**Files:**
- Modify: `frontend/src/App.jsx` (import ~línea 19, navItems ~2380, sectionTitleMap ~2390, render ~2640)

**Interfaces:**
- Consumes: `PanelUsuarioSection` de la Tarea 4.
- Produces: nada que consuman tareas posteriores.

- [x] **Step 1: Importar el componente**

En `frontend/src/App.jsx`, junto a los otros imports de componentes:

```jsx
import PanelUsuarioSection from './components/PanelUsuarioSection';
```

- [x] **Step 2: Sacar Establecimiento del menú**

Borrar esta línea del bloque de `navItems.push(...)`:

```jsx
navItems.push({ id: 'config-establecimiento', label: 'Establecimiento', group: 'admin' });
```

- [x] **Step 3: Actualizar el mapa de títulos**

En `sectionTitleMap`, borrar la entrada `'config-establecimiento'` y agregar la de `panel-usuario` (hoy no existe):

```jsx
      'panel-usuario': 'Panel de usuario',
```

- [x] **Step 4: Armar el objeto de establecimiento**

Cerca de donde se arma `propsVistaRapida`, agregar:

```jsx
    // Las 25 props del formulario viajan agrupadas para no sumar 25 lineas de
    // cableado en un archivo que ya tiene 2781.
    const propsEstablecimiento = {
      estName,
      setEstName,
      estHasParking,
      setEstHasParking,
      estParkingCapacity,
      setEstParkingCapacity,
      estHasCarpas,
      setEstHasCarpas,
      estCarpasCapacity,
      setEstCarpasCapacity,
      estHasSombrillas,
      setEstHasSombrillas,
      estSombrillasCapacity,
      setEstSombrillasCapacity,
      estHasPileta,
      setEstHasPileta,
      estPoolMaxOccupancy,
      setEstPoolMaxOccupancy,
      onSubmit: handleSaveEstablishment,
      estSaving,
      error,
      success
    };
```

- [x] **Step 5: Reemplazar el render**

Borrar todo el bloque `{activeSection === 'config-establecimiento' && ( ... )}` y agregar:

```jsx
            {activeSection === 'panel-usuario' && (
              <PanelUsuarioSection
                authToken={authToken}
                userEmail={userEmail}
                onEmailChanged={(nuevo) => {
                  // La sesion sigue valida: el email del token no se usa para
                  // autorizar. Solo hay que refrescar lo que se muestra.
                  setUserEmail(nuevo);
                  sessionStorage.setItem('authEmail', nuevo);
                }}
                establecimiento={propsEstablecimiento}
              />
            )}
```

- [x] **Step 6: Verificar que no quedan referencias**

Run: `cd "E:/Balnearios 2026" && grep -rn "config-establecimiento" frontend/src/`
Expected: sin resultados.

- [x] **Step 7: Correr la suite del frontend**

Run: `cd frontend && npm test`
Expected: 18 tests en verde.

- [x] **Step 8: Verificar en el navegador**

Con backend en 9000 y frontend en 9001, entrar con `admin@balneario.com` / `admin123` y comprobar:

1. **Establecimiento ya no está en el sidebar.**
2. **Panel de usuario** abre en la solapa Perfil, muestra el email y el badge "Administrador".
3. La solapa **Establecimiento** muestra el formulario con los datos de Zeus.
4. **Contraseña nueva de menos de 8 caracteres** → mensaje de error sin pegarle a la API.
5. **Contraseña actual incorrecta** → "La contraseña actual no es correcta."
6. **Cambiar el email de verdad** → el sidebar y el perfil muestran el nuevo, **y la sesión sigue viva** (navegar a Reservas debe seguir cargando datos, sin 401).
7. Volver a dejar el email en `admin@balneario.com`.

- [x] **Step 9: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: cablear Panel de usuario y mover Establecimiento adentro"
```

---

## Cierre

- [x] **Correr todo junto**

```bash
cd api && npm test && cd ../frontend && npm test && npm run build
```
Expected: 12 tests de API, 18 de frontend, build sin errores.

- [x] **Aplicar la migración en producción**

`backend/migrate-user-role.sql` contra la base de Supabase de `vercelbalneariosmvp1`. Es idempotente: se puede correr dos veces sin romper.

- [x] **Revisión de seguridad**

El CLAUDE.md del equipo exige llamar a `@security` antes de mergear cualquier feature que toque autenticación. Esta califica. Pasarle el diff de `api/index.js`.

Anotar en esa revisión los dos hallazgos del spec que quedaron fuera de alcance: el fallback `JWT_SECRET || 'change_this_secret'` y el token de 1 hora contra los 15 minutos de la convención.
