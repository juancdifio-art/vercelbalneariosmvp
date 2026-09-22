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
  id: pgPath,
  filename: pgPath,
  path: pgPath,
  loaded: true,
  children: [],
  paths: [],
  exports: { Pool }
};
