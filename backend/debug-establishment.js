const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function debugEstablishment() {
  try {
    console.log('=== Verificando usuarios ===');
    const usersResult = await pool.query('SELECT id, email FROM users ORDER BY id');
    console.log('Usuarios encontrados:', usersResult.rows);

    console.log('\n=== Verificando establecimientos ===');
    const estResult = await pool.query('SELECT id, user_id, name FROM establishments ORDER BY id');
    console.log('Establecimientos encontrados:', estResult.rows);

    if (usersResult.rows.length > 0 && estResult.rows.length > 0) {
      const user = usersResult.rows[0];
      const est = estResult.rows[0];

      console.log('\n=== Análisis ===');
      console.log(`Usuario ID: ${user.id}, Email: ${user.email}`);
      console.log(`Establecimiento ID: ${est.id}, user_id: ${est.user_id}, Nombre: ${est.name}`);

      if (user.id !== est.user_id) {
        console.log('\n⚠️ PROBLEMA ENCONTRADO: El user_id del establecimiento no coincide con el usuario actual');
        console.log(`Corrigiendo: Actualizando establecimiento ${est.id} para que pertenezca al usuario ${user.id}...`);
        
        await pool.query('UPDATE establishments SET user_id = $1 WHERE id = $2', [user.id, est.id]);
        console.log('✅ Establecimiento actualizado correctamente');
      } else {
        console.log('\n✅ Todo está correcto: El establecimiento pertenece al usuario correcto');
      }
    } else if (usersResult.rows.length === 0) {
      console.log('\n⚠️ No hay usuarios en la base de datos');
    } else if (estResult.rows.length === 0) {
      console.log('\n⚠️ No hay establecimientos en la base de datos');
      console.log('Puedes crear uno desde la interfaz de configuración inicial');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

debugEstablishment();
