-- Tarifas: periodos recurrentes, sectores de unidades y precios.
-- Idempotente: se puede correr mas de una vez.

CREATE TABLE IF NOT EXISTS periodos_tarifarios (
  id SERIAL PRIMARY KEY,
  establishment_id INTEGER NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  -- Sin anio: se repiten todas las temporadas. Si el inicio es mayor que el
  -- fin, el periodo cruza el fin de anio (15/12 -> 15/03).
  mes_inicio SMALLINT NOT NULL CHECK (mes_inicio BETWEEN 1 AND 12),
  dia_inicio SMALLINT NOT NULL CHECK (dia_inicio BETWEEN 1 AND 31),
  mes_fin SMALLINT NOT NULL CHECK (mes_fin BETWEEN 1 AND 12),
  dia_fin SMALLINT NOT NULL CHECK (dia_fin BETWEEN 1 AND 31),
  prioridad INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sectores (
  id SERIAL PRIMARY KEY,
  establishment_id INTEGER NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  service_type VARCHAR(20) NOT NULL CHECK (service_type IN ('carpa', 'sombrilla', 'parking')),
  nombre VARCHAR(100) NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#0EA5E9',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT sectores_nombre_unico UNIQUE (establishment_id, service_type, nombre)
);

-- Una unidad esta en un solo sector de su tipo: lo garantiza el UNIQUE.
CREATE TABLE IF NOT EXISTS sector_unidades (
  sector_id INTEGER NOT NULL REFERENCES sectores(id) ON DELETE CASCADE,
  establishment_id INTEGER NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  service_type VARCHAR(20) NOT NULL,
  resource_number INTEGER NOT NULL CHECK (resource_number > 0),
  CONSTRAINT sector_unidades_unica UNIQUE (establishment_id, service_type, resource_number)
);

CREATE INDEX IF NOT EXISTS idx_sector_unidades_sector ON sector_unidades(sector_id);

CREATE TABLE IF NOT EXISTS tarifas (
  id SERIAL PRIMARY KEY,
  establishment_id INTEGER NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  service_type VARCHAR(20) NOT NULL CHECK (service_type IN ('carpa', 'sombrilla', 'parking')),
  alcance VARCHAR(10) NOT NULL CHECK (alcance IN ('tipo', 'sector', 'unidad')),
  sector_id INTEGER REFERENCES sectores(id) ON DELETE CASCADE,
  resource_number INTEGER,
  clase VARCHAR(10) NOT NULL CHECK (clase IN ('fecha', 'estadia')),
  periodo_id INTEGER REFERENCES periodos_tarifarios(id) ON DELETE CASCADE,
  nombre VARCHAR(100),
  dias_min INTEGER,
  dias_max INTEGER,
  modo VARCHAR(10) CHECK (modo IN ('cerrado', 'por_dia')),
  -- Por dia (clase fecha, o estadia por_dia) o total (estadia cerrado).
  precio NUMERIC(12, 2) NOT NULL CHECK (precio >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tarifas_alcance_coherente CHECK (
    (alcance = 'tipo' AND sector_id IS NULL AND resource_number IS NULL) OR
    (alcance = 'sector' AND sector_id IS NOT NULL AND resource_number IS NULL) OR
    (alcance = 'unidad' AND sector_id IS NULL AND resource_number IS NOT NULL)
  ),
  CONSTRAINT tarifas_clase_coherente CHECK (
    (clase = 'fecha' AND periodo_id IS NOT NULL AND dias_min IS NULL AND dias_max IS NULL AND modo IS NULL) OR
    (clase = 'estadia' AND dias_min >= 1 AND (dias_max IS NULL OR dias_max >= dias_min) AND modo IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_tarifas_establecimiento_servicio ON tarifas(establishment_id, service_type);

-- Snapshot del precio al reservar. total_price sigue siendo lo cobrado.
ALTER TABLE reservation_groups
  ADD COLUMN IF NOT EXISTS precio_tarifa NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS desglose JSONB,
  ADD COLUMN IF NOT EXISTS motivo_ajuste TEXT;
