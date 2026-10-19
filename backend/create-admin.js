// Script para crear un usuario admin en la base de datos
// Uso: node create-admin.js <email> <password>
//
// Las credenciales se pasan al correrlo: el repo es publico, asi que una
// clave escrita aca la conoce cualquiera. Si el email ya existe no se toca
// (antes le volvia a poner la clave por defecto).

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function createAdminUser() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password || password.length < 16) {
    console.error('Uso: node create-admin.js <email> <password>  (la clave, de 16 caracteres o más)');
    process.exit(1);
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, created_at`,
      [email, passwordHash]
    );

    if (result.rows.length > 0) {
      console.log('✅ Usuario admin creado:', result.rows[0].email, '(id', `${result.rows[0].id})`);
    } else {
      console.log('Ya existe un usuario con ese email; no se modificó.');
    }
  } catch (error) {
    console.error('❌ Error al crear usuario admin:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createAdminUser();
