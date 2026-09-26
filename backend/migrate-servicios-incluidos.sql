-- Servicios incluidos en la carpa o sombrilla: pileta y cocheras.
-- Corre igual en local y en Supabase. Es idempotente.
-- Spec: docs/superpowers/specs/2026-09-26-servicios-incluidos-design.md
--
-- Un servicio incluido es una reserva mas (pase de pileta o cochera) que
-- apunta a la carpa que lo incluye:
--   vinculo = 'incluido'  -> nace, se mueve y se cancela con la carpa.
--   vinculo = 'adicional' -> pase de pileta pago, asociado a la carpa solo
--                            para mostrarlo junto a ella. No se sincroniza.

ALTER TABLE reservation_groups
  ADD COLUMN IF NOT EXISTS incluida_en_reserva_id INTEGER
    REFERENCES reservation_groups(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS vinculo VARCHAR(10);

-- Postgres no soporta ADD CONSTRAINT IF NOT EXISTS: se consulta pg_constraint.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservation_groups_vinculo_valido') THEN
    ALTER TABLE reservation_groups ADD CONSTRAINT reservation_groups_vinculo_valido
      CHECK (vinculo IS NULL OR vinculo IN ('incluido', 'adicional'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservation_groups_vinculo_coherente') THEN
    ALTER TABLE reservation_groups ADD CONSTRAINT reservation_groups_vinculo_coherente
      CHECK ((vinculo IS NULL) = (incluida_en_reserva_id IS NULL));
  END IF;
END $$;

-- Un solo pase de pileta incluido por carpa. Cocheras incluidas puede haber varias.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pileta_incluida_unica
  ON reservation_groups(incluida_en_reserva_id)
  WHERE vinculo = 'incluido' AND service_type = 'pileta';

CREATE INDEX IF NOT EXISTS idx_reservation_groups_incluida
  ON reservation_groups(incluida_en_reserva_id)
  WHERE incluida_en_reserva_id IS NOT NULL;

-- Personas de cada pase de pileta con nombre: un acompanante de la carpa
-- (guest_id) o el titular (client_id), nunca las dos cosas. Los datos no se
-- copian: nombre, DNI y edad se leen de reservation_guests o de clients.
CREATE TABLE IF NOT EXISTS pase_pileta_personas (
  id SERIAL PRIMARY KEY,
  establishment_id INTEGER NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  pase_id INTEGER NOT NULL REFERENCES reservation_groups(id) ON DELETE CASCADE,
  guest_id INTEGER REFERENCES reservation_guests(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT pase_persona_una_sola CHECK ((guest_id IS NULL) <> (client_id IS NULL))
);

-- Un acompanante tiene como mucho un pase (incluido o pago).
CREATE UNIQUE INDEX IF NOT EXISTS idx_pase_persona_guest
  ON pase_pileta_personas(guest_id) WHERE guest_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pase_persona_client
  ON pase_pileta_personas(pase_id, client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pase_pileta_personas_pase
  ON pase_pileta_personas(pase_id);

-- Ajustes del establecimiento. Las sombrillas no incluyen pases por ahora
-- (a confirmar con el balneario); el tope de personas sale del contrato.
ALTER TABLE establishments
  ADD COLUMN IF NOT EXISTS pases_pileta_por_carpa INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS pases_pileta_por_sombrilla INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_personas_por_unidad INTEGER NOT NULL DEFAULT 6;
