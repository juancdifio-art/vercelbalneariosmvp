-- Unifica donde se guarda la cantidad de personas: las mismas columnas que ya
-- usa produccion, y para los cuatro servicios, no solo pileta.

ALTER TABLE reservation_groups
  ADD COLUMN IF NOT EXISTS adults_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS children_count INTEGER NOT NULL DEFAULT 0;

-- Los pases de pileta ya cargados tienen la cantidad en las columnas viejas.
-- Se copian antes de que el codigo deje de leerlas. Las viejas no se borran.
UPDATE reservation_groups
   SET adults_count = COALESCE(pool_adults_count, 0),
       children_count = COALESCE(pool_children_count, 0)
 WHERE service_type = 'pileta'
   AND adults_count = 0
   AND children_count = 0;
