const jwt = require('jsonwebtoken');
require('dotenv').config();

// Lee el token desde los argumentos de línea de comandos
const token = process.argv[2];

if (!token) {
  console.log('Uso: node verify-token.js <TOKEN>');
  console.log('\nPor favor, copia el token desde localStorage del navegador:');
  console.log('1. Abre la consola del navegador (F12)');
  console.log('2. Ve a la pestaña "Application" o "Almacenamiento"');
  console.log('3. En "Local Storage", busca la clave "authToken"');
  console.log('4. Copia el valor y ejecútalo así: node verify-token.js <TOKEN>');
  process.exit(1);
}

try {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  console.log('✅ Token válido');
  console.log('Información del token:');
  console.log(JSON.stringify(decoded, null, 2));
} catch (error) {
  console.log('❌ Token inválido o expirado');
  console.log('Error:', error.message);
}
