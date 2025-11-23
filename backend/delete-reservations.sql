-- Script para limpiar TODA la base de datos dejando solo el usuario admin
-- ADVERTENCIA: Este script eliminará TODOS los datos excepto el usuario admin
-- Usar con EXTREMA precaución, preferiblemente en entorno de desarrollo/testing

-- IMPORTANTE: Cambia 'admin@example.com' por el email real del usuario admin que quieres conservar
-- Si no tienes un usuario admin específico, este script eliminará TODOS los usuarios

-- 1. Eliminar todos los pagos de reservas
DELETE FROM reservation_payments;

-- 2. Eliminar todas las reservas
DELETE FROM reservation_groups;

-- 3. Eliminar todos los clientes
DELETE FROM clients;

-- 4. Eliminar todos los establecimientos (excepto el del admin)
DELETE FROM establishments 
WHERE user_id NOT IN (
  SELECT id FROM users WHERE email = 'admin@balneario.com'
);

-- 5. Eliminar todos los usuarios (excepto el admin)
DELETE FROM users 
WHERE email != 'admin@balneario.com';

-- 6. Resetear los contadores de IDs (opcional)
-- Esto reinicia los IDs para las próximas inserciones
ALTER SEQUENCE reservation_payments_id_seq RESTART WITH 1;
ALTER SEQUENCE reservation_groups_id_seq RESTART WITH 1;
ALTER SEQUENCE clients_id_seq RESTART WITH 1;
-- NO reseteamos establishments_id_seq ni users_id_seq porque conservamos registros

-- 7. Verificar que se limpió correctamente
SELECT 'Usuarios restantes:' as tabla, COUNT(*) as cantidad FROM users
UNION ALL
SELECT 'Establecimientos restantes:' as tabla, COUNT(*) as cantidad FROM establishments
UNION ALL
SELECT 'Clientes restantes:' as tabla, COUNT(*) as cantidad FROM clients
UNION ALL
SELECT 'Reservas restantes:' as tabla, COUNT(*) as cantidad FROM reservation_groups
UNION ALL
SELECT 'Pagos restantes:' as tabla, COUNT(*) as cantidad FROM reservation_payments;
