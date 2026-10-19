-- Chat de soporte: el establecimiento nos escribe desde la app (errores,
-- sugerencias, consultas) y respondemos desde la bandeja de soporte.
-- Un hilo por establecimiento. Corre igual en local y en Supabase. Es idempotente.
-- Va entera en una transaccion: si el ADD de la constraint fallara, el DROP
-- se vuelve atras y users no queda sin control de rol.
-- Requiere migrate-user-role.sql (la columna users.role): el login ahora la lee.

BEGIN;

-- Rol nuevo para quien atiende la bandeja. Drop + add deja la migracion
-- idempotente aunque la constraint ya exista con la lista vieja.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'operador', 'soporte'));

-- de_soporte: false = lo escribio el establecimiento, true = lo respondimos.
-- leido_at: cuando lo leyo el otro lado (soporte lee los del establecimiento
-- y viceversa). tipo y pantalla solo los cargan los mensajes del establecimiento.
CREATE TABLE IF NOT EXISTS soporte_mensajes (
  id SERIAL PRIMARY KEY,
  establishment_id INTEGER NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  de_soporte BOOLEAN NOT NULL DEFAULT FALSE,
  tipo VARCHAR(12) CHECK (tipo IS NULL OR tipo IN ('error', 'sugerencia', 'consulta')),
  texto TEXT NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 2000),
  pantalla VARCHAR(60),
  leido_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soporte_mensajes_establecimiento
  ON soporte_mensajes(establishment_id, created_at);

COMMIT;
