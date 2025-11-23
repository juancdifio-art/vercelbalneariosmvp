-- Migración: agregar campos para pases de pileta en reservation_groups
-- Este script agrega columnas específicas para modelar pases de pileta
-- Ejecutar una sola vez sobre la base de datos existente

ALTER TABLE reservation_groups
  ADD COLUMN IF NOT EXISTS pool_adults_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pool_children_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pool_adult_price_per_day NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS pool_child_price_per_day NUMERIC(12, 2);

-- Verificación rápida
-- SELECT pool_adults_count, pool_children_count, pool_adult_price_per_day, pool_child_price_per_day
-- FROM reservation_groups
-- LIMIT 5;
