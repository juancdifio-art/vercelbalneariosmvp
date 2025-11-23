-- Script para crear un usuario admin
-- Este script crea un usuario admin con credenciales predeterminadas

-- IMPORTANTE: Cambia la contraseña después del primer login por seguridad

-- Insertar usuario admin
-- Email: admin@balneario.com
-- Password: admin123 (hash bcrypt con salt rounds = 10)
INSERT INTO users (email, password_hash, created_at)
VALUES (
  'admin@balneario.com',
  '$2b$10$YQ98PjVKY8K0RVLhWJqLZOqGZJX5xN5rN5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y',
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Verificar que se creó correctamente
SELECT id, email, created_at 
FROM users 
WHERE email = 'admin@balneario.com';

-- NOTA: Para generar un nuevo hash de contraseña, puedes usar este código Node.js:
-- const bcrypt = require('bcrypt');
-- const hash = await bcrypt.hash('tu_contraseña', 10);
-- console.log(hash);
