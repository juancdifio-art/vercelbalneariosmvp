-- Administrador general: una cuenta que ve todas las cuentas de la app, crea
-- la de un balneario nuevo y le genera una clave nueva a quien la olvido.
-- Puede tener su balneario o no tenerlo. Es idempotente.

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS administra_cuentas BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;

-- Se habilita por cuenta, a mano, y solo en una cuenta con clave larga:
-- UPDATE users SET administra_cuentas = TRUE WHERE email = '...';
