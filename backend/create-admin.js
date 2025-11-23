// Script para crear un usuario admin en la base de datos
// Uso: node create-admin.js

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
  const email = 'admin@balneario.com';
  const password = 'admin123'; // Contraseña por defecto
  
  try {
    console.log('🔐 Generando hash de contraseña...');
    const passwordHash = await bcrypt.hash(password, 10);
    
    console.log('📝 Insertando usuario admin en la base de datos...');
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (email) 
       DO UPDATE SET password_hash = $2
       RETURNING id, email, created_at`,
      [email, passwordHash]
    );
    
    if (result.rows.length > 0) {
      console.log('✅ Usuario admin creado/actualizado exitosamente:');
      console.log('   Email:', result.rows[0].email);
      console.log('   ID:', result.rows[0].id);
      console.log('   Creado:', result.rows[0].created_at);
      console.log('');
      console.log('📧 Credenciales:');
      console.log('   Email: admin@balneario.com');
      console.log('   Password: admin123');
      console.log('');
      console.log('⚠️  IMPORTANTE: Cambia la contraseña después del primer login');
    }
    
  } catch (error) {
    console.error('❌ Error al crear usuario admin:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createAdminUser();
