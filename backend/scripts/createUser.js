const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');

const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const pool = require('../src/db');

async function main() {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.log('Uso: npm run create-user -- <email> <password>');
    process.exit(1);
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

    if (existing.rows.length > 0) {
      console.log('Ya existe un usuario con ese email:', email);
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, passwordHash]
    );

    console.log('Usuario creado correctamente:');
    console.log(result.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('Error creando usuario:', err);
    process.exit(1);
  }
}

main();
