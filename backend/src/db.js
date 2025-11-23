const { Pool } = require('pg');

// Soportar tanto DATABASE_URL (Neon/Railway/Render) como variables individuales
const databaseConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'balnearios_mvp',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    };

console.log('DB config loaded:', {
  usingDatabaseUrl: !!process.env.DATABASE_URL,
  host: databaseConfig.host || 'from connection string',
  database: databaseConfig.database || 'from connection string'
});

const pool = new Pool(databaseConfig);

module.exports = pool;
