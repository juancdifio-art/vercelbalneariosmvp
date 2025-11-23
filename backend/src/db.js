const { Pool } = require('pg');

console.log('DB config loaded:', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  passwordType: typeof process.env.DB_PASSWORD,
  hasPassword: !!process.env.DB_PASSWORD
});

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'balnearios_mvp',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

module.exports = pool;
