-- Plano por balneario: la clave del plano dibujado de cada establecimiento
-- (frontend/src/config/planos.js). Sin plano, las carpas y sombrillas van de 1
-- a la capacidad configurada. El dibujo lo hacemos nosotros en el onboarding.
-- Es idempotente.

BEGIN;

ALTER TABLE establishments
  ADD COLUMN IF NOT EXISTS plano VARCHAR(40);

COMMIT;

-- Los balnearios que usan el plano de Zeus se marcan a mano, por ejemplo:
-- UPDATE establishments SET plano = 'zeus'
--  WHERE user_id = (SELECT id FROM users WHERE email = '<email del encargado>');
