import { createRequire } from 'node:module';
import { vi } from 'vitest';

/**
 * Doble de `pg` para los tests de la API.
 *
 * `api/index.js` arma su propio pool con `new Pool(...)` y no depende de
 * `lib/db`, asi que la unica forma de interceptar las consultas es reemplazar
 * el modulo entero.
 *
 * No alcanza con `vi.mock('pg')` ni con un alias de Vite: `api/` no declara
 * "type": "module", asi que index.js es CommonJS y su `require('pg')` lo
 * resuelve el require nativo de Node, que no pasa por el grafo de modulos de
 * vitest. Por eso se siembra directamente el require.cache con este doble,
 * antes de que index.js llegue a cargarse.
 *
 * Los tests importan `queryMock` de aca para preparar las respuestas de cada
 * consulta, en orden, con `mockResolvedValueOnce`.
 */
export const queryMock = vi.fn();

// Las sentencias de control de una transaccion (BEGIN, COMMIT, ROLLBACK y el
// bloqueo de una unidad) no consumen respuestas de queryMock: van a txMock.
// Asi los tests preparan solo las consultas de datos, en el mismo orden de
// siempre, aunque el endpoint corra dentro de una transaccion.
export const txMock = vi.fn(async () => ({ rows: [] }));
const esControl = (sql) => /^(BEGIN|COMMIT|ROLLBACK)$/.test(String(sql).trim()) || /pg_advisory_xact_lock/.test(String(sql));

// El control de roles (_permisos/permisos.js) pregunta el rol antes de cada
// ruta del balneario. Esa consulta tampoco consume respuestas de queryMock: va
// a rolMock, que por defecto contesta un encargado. Los tests de permisos le
// cambian la respuesta con mockResolvedValueOnce.
export const rolMock = vi.fn(async () => ({ rows: [{ role: 'admin' }] }));
const esRol = (sql) => String(sql).includes('/* permisos */');

export class Pool {
  query(sql, ...args) {
    return esRol(sql) ? rolMock(sql, ...args) : queryMock(sql, ...args);
  }

  connect() {
    return Promise.resolve({
      query: (sql, params) => (esControl(sql) ? txMock(sql, params) : queryMock(sql, params)),
      release() {}
    });
  }

  end() {
    return Promise.resolve();
  }
}

const require = createRequire(import.meta.url);
const pgPath = require.resolve('pg');

require.cache[pgPath] = {
  id: pgPath,
  filename: pgPath,
  path: pgPath,
  loaded: true,
  children: [],
  paths: [],
  exports: { Pool }
};
