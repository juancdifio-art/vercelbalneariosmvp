-- Produccion nunca tuvo los precios por adulto y por nino del pase de pileta:
-- por eso hoy no se puede editar un pase ahi (los precios salen vacios).

ALTER TABLE reservation_groups
  ADD COLUMN IF NOT EXISTS pool_adult_price_per_day NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS pool_child_price_per_day NUMERIC(12, 2);
