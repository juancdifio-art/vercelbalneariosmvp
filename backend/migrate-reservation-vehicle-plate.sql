-- Patente del vehiculo en las reservas de estacionamiento.
-- Corre igual en local y en Supabase. Es idempotente.
--
-- La patente es obligatoria para usar el estacionamiento: la API rechaza una
-- reserva de parking sin patente (error vehicle_plate_required). No va NOT NULL
-- en la columna porque carpas, sombrillas y pileta no la usan, y las reservas
-- de estacionamiento cargadas antes de este cambio no la tienen.
--
-- Va en la reserva y no solo en la ficha del cliente: el mismo cliente puede
-- venir con otro auto en otra estadia. La ficha (clients.vehicle_plate) se usa
-- para completarla sola al elegir el cliente.
--
-- Se guarda normalizada: mayusculas, sin espacios ni guiones (AB123CD).

ALTER TABLE reservation_groups
  ADD COLUMN IF NOT EXISTS vehicle_plate VARCHAR(20);
