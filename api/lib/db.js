const { Pool } = require('pg');

let pool;

function createPool() {
  if (process.env.DATABASE_URL) {
    // Entorno serverless/producción (Neon, Railway, etc.)
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });
  }

  // Entorno local: mismas variables que usa el backend actual
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'balnearios_mvp',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });
}

function getPool() {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

module.exports = {
  query: (text, params) => getPool().query(text, params),
  getClient: () => getPool().connect()
};
