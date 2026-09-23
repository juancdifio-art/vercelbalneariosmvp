CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS establishments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  has_parking BOOLEAN NOT NULL DEFAULT false,
  has_carpas BOOLEAN NOT NULL DEFAULT false,
  has_sombrillas BOOLEAN NOT NULL DEFAULT false,
  has_pileta BOOLEAN NOT NULL DEFAULT false,
  parking_capacity INTEGER,
  carpas_capacity INTEGER,
  sombrillas_capacity INTEGER,
  pool_max_occupancy INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  establishment_id INTEGER NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  notes TEXT,
  document_number VARCHAR(50),
  birth_date DATE,
  nationality VARCHAR(100),
  address_street VARCHAR(255),
  address_neighborhood VARCHAR(255),
  address_postal_code VARCHAR(20),
  address_city VARCHAR(100),
  address_state VARCHAR(100),
  address_country VARCHAR(100),
  vehicle_brand VARCHAR(100),
  vehicle_model VARCHAR(100),
  vehicle_plate VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla reservations eliminada - Ahora se usa solo reservation_groups
-- Las reservas se almacenan como bloques con start_date y end_date

CREATE TABLE IF NOT EXISTS reservation_groups (
  id SERIAL PRIMARY KEY,
  establishment_id INTEGER NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  service_type VARCHAR(20) NOT NULL,
  resource_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  customer_name VARCHAR(255),
  customer_phone VARCHAR(50),
  daily_price NUMERIC(12, 2),
  total_price NUMERIC(12, 2),
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE reservation_groups
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS daily_price NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS total_price NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS adults_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS children_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pool_adult_price_per_day NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS pool_child_price_per_day NUMERIC(12, 2),
  -- Patente del vehiculo: obligatoria en las reservas de estacionamiento
  -- (la API la exige). Se guarda en mayusculas y sin espacios: AB123CD.
  ADD COLUMN IF NOT EXISTS vehicle_plate VARCHAR(20),
  ADD COLUMN IF NOT EXISTS precio_tarifa NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS desglose JSONB,
  ADD COLUMN IF NOT EXISTS motivo_ajuste TEXT;

-- Las personas que ocupan una reserva. Solo full_name es obligatorio.
-- age y birth_date conviven: si esta la fecha, la edad se calcula de ahi.
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

CREATE INDEX IF NOT EXISTS idx_reservation_guests_group
  ON reservation_guests(reservation_group_id);

CREATE TABLE IF NOT EXISTS reservation_payments (
  id SERIAL PRIMARY KEY,
  establishment_id INTEGER NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  reservation_group_id INTEGER NOT NULL REFERENCES reservation_groups(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL,
  payment_date DATE NOT NULL,
  method VARCHAR(20),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
