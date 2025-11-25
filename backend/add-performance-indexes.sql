-- ========================================
-- ÍNDICES DE RENDIMIENTO PARA RESERVAS
-- ========================================
-- Este script mejora el rendimiento de las queries más frecuentes
-- Ejecutar en Supabase SQL Editor una sola vez
-- Tiempo estimado: 2-5 segundos

-- 1. Índice para búsquedas por rango de fechas + servicio (MÁS USADO)
--    Mejora: Queries de reservas por servicio y rango de fechas
--    Usado en: GET /api/reservation-groups?service=X&from=Y&to=Z
CREATE INDEX IF NOT EXISTS idx_reservation_groups_establishment_service_dates
  ON reservation_groups(establishment_id, service_type, start_date, end_date);

-- 2. Índice para verificación de conflictos/solapamiento
--    Mejora: Validación de reservas duplicadas al crear nueva reserva
--    Usado en: POST /api/reservation-groups (check de conflictos)
CREATE INDEX IF NOT EXISTS idx_reservation_groups_conflict_check
  ON reservation_groups(establishment_id, service_type, resource_number, status, start_date, end_date);

-- 3. Índice para filtrado por cliente
--    Mejora: Búsquedas de reservas de un cliente específico
--    Usado en: GET /api/reservation-groups?clientId=X
CREATE INDEX IF NOT EXISTS idx_reservation_groups_client
  ON reservation_groups(client_id) WHERE client_id IS NOT NULL;

-- 4. Índice para status + establishment (búsquedas de activos/cancelados)
--    Mejora: Filtrado por estado de reserva
--    Usado en: GET /api/reservation-groups?status=active
CREATE INDEX IF NOT EXISTS idx_reservation_groups_status
  ON reservation_groups(establishment_id, status);

-- 5. Índice para JOIN de pagos (CRÍTICO para LEFT JOIN)
--    Mejora: LEFT JOIN entre reservation_groups y reservation_payments
--    Usado en: GET /api/reservation-groups (query principal con SUM de pagos)
CREATE INDEX IF NOT EXISTS idx_reservation_payments_lookup
  ON reservation_payments(reservation_group_id, establishment_id);

-- 6. Índice para búsquedas de pagos por fecha
--    Mejora: Reportes de pagos, ingresos del día
--    Usado en: GET /api/reservation-groups/payments?from=X&to=Y
CREATE INDEX IF NOT EXISTS idx_reservation_payments_establishment_date
  ON reservation_payments(establishment_id, payment_date);

-- 7. Índice para búsquedas de pagos ordenados por fecha de creación
--    Mejora: Últimos pagos en dashboard
--    Usado en: GET /api/reservation-groups/payments?limit=5
CREATE INDEX IF NOT EXISTS idx_reservation_payments_created_at
  ON reservation_payments(establishment_id, created_at DESC);

-- 8. Índice para clientes por establishment
--    Mejora: Listado de clientes
--    Usado en: GET /api/clients
CREATE INDEX IF NOT EXISTS idx_clients_establishment
  ON clients(establishment_id);

-- ========================================
-- VERIFICACIÓN Y ANÁLISIS (OPCIONAL)
-- ========================================

-- Verificar que los índices se crearon correctamente:
-- SELECT indexname, tablename FROM pg_indexes
-- WHERE tablename IN ('reservation_groups', 'reservation_payments', 'clients')
-- ORDER BY tablename, indexname;

-- Ver tamaño de tablas e índices:
-- SELECT
--   tablename,
--   pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
-- FROM pg_tables
-- WHERE tablename IN ('reservation_groups', 'reservation_payments', 'clients');

-- Analizar uso de índices en una query específica (ejemplo):
-- EXPLAIN ANALYZE
-- SELECT * FROM reservation_groups
-- WHERE establishment_id = 1
--   AND service_type = 'carpa'
--   AND start_date >= '2025-11-01'
--   AND end_date <= '2025-11-30';
