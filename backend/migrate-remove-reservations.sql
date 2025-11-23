-- Script de migración: Eliminar tabla reservations
-- Ejecutar este script para actualizar la base de datos existente

-- IMPORTANTE: Hacer backup antes de ejecutar este script!

-- 1. Eliminar la tabla reservations (ya no se usa)
DROP TABLE IF EXISTS reservations CASCADE;

-- 2. Verificar que reservation_groups tiene todos los datos necesarios
-- (Este script asume que ya migraste tus datos a reservation_groups)

-- 3. Opcional: Agregar índices para mejorar performance en reservation_groups
CREATE INDEX IF NOT EXISTS idx_reservation_groups_dates 
  ON reservation_groups(establishment_id, service_type, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_reservation_groups_resource 
  ON reservation_groups(establishment_id, service_type, resource_number);

CREATE INDEX IF NOT EXISTS idx_reservation_groups_status 
  ON reservation_groups(status);

-- Fin de la migración
