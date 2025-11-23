CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
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
  ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL;

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
