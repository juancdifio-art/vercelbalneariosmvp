-- Contrato imprimible: el titulo y las condiciones generales que cada
-- balneario carga en Panel de usuario > Contrato y que salen impresos en el
-- contrato de cada carpa o sombrilla. Es idempotente.

BEGIN;

ALTER TABLE establishments
  ADD COLUMN IF NOT EXISTS contrato_titulo VARCHAR(120),
  ADD COLUMN IF NOT EXISTS contrato_condiciones TEXT;

COMMIT;
