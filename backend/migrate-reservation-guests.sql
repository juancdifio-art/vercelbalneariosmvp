-- Etapa 2: los datos de cada persona que ocupa una reserva.
-- Corre igual en local y en Supabase. Es idempotente.
--
-- Solo full_name es obligatorio: si el operador tiene el nombre y nada mas,
-- lo carga igual.
--
-- age y birth_date conviven a proposito. En el mostrador se pregunta la edad,
-- no la fecha de nacimiento. Si esta la fecha, la edad se calcula de ahi; si
-- no, vale la que se escribio a mano. La edad guardada no se recalcula sola:
-- es la que tenia la persona cuando se cargo.

CREATE TABLE IF NOT EXISTS reservation_guests (
  id SERIAL PRIMARY KEY,
  establishment_id INTEGER NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  reservation_group_id INTEGER NOT NULL REFERENCES reservation_groups(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  document_number VARCHAR(50),
  age INTEGER,
  birth_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Siempre se consultan por reserva.
CREATE INDEX IF NOT EXISTS idx_reservation_guests_group
  ON reservation_guests(reservation_group_id);
