-- Migración: nivel de acceso del usuario
-- El DEFAULT 'admin' deja correctos a los usuarios existentes sin migrar datos.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'admin';

-- Postgres no soporta ADD CONSTRAINT IF NOT EXISTS, así que se chequea a mano
-- para que la migración sea idempotente.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check') THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'operador'));
  END IF;
END $$;
