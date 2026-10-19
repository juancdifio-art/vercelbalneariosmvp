-- Acceso a la bandeja de soporte para una cuenta que ademas tiene su balneario
-- (la de Juan): ve su balneario como siempre y suma "Bandeja de soporte" al
-- menu. El rol 'soporte' sigue existiendo para cuentas que solo atienden.
-- Requiere migrate-soporte.sql. Es idempotente.

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS atiende_soporte BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;

-- Se habilita por cuenta, a mano:
-- UPDATE users SET atiende_soporte = TRUE WHERE email = '...';
