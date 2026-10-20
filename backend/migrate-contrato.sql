-- Contrato imprimible: el titulo, las condiciones generales y los datos del
-- contrato (horarios, fechas, cantidades) que cada balneario carga en Panel de
-- usuario > Contrato y que salen impresos en el contrato de cada carpa o
-- sombrilla. Es idempotente: se puede volver a correr.

BEGIN;

ALTER TABLE establishments
  ADD COLUMN IF NOT EXISTS contrato_titulo VARCHAR(120),
  ADD COLUMN IF NOT EXISTS contrato_condiciones TEXT,
  -- [{ "nombre": "Horario de la pileta", "valor": "13.30 a 19.30 hs" }, ...]
  ADD COLUMN IF NOT EXISTS contrato_datos JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMIT;
