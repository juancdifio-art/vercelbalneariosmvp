-- Usuarios por balneario: el dueño y su personal apuntan al mismo
-- establecimiento con users.establishment_id. establishments.user_id sigue
-- siendo el dueño (uno por balneario). El rol dice qué puede hacer cada uno:
--   admin     el encargado o dueño: todo
--   operador  un empleado: reservas, clientes, pagos y reportes
--   pileta    el personal de pileta: solo mira
--   soporte   cuenta que atiende la bandeja de soporte (sin balneario)
-- Es idempotente. Correr antes de publicar el código que la usa.

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS establishment_id INTEGER REFERENCES establishments(id) ON DELETE CASCADE;

-- Cada dueño queda apuntando a su balneario.
UPDATE users u
   SET establishment_id = e.id
  FROM establishments e
 WHERE e.user_id = u.id
   AND u.establishment_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_establishment ON users(establishment_id);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'operador', 'pileta', 'soporte'));

COMMIT;
