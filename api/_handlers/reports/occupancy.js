const db = require('../_lib/db');
const handleCors = require('../_lib/cors');
const { authenticateToken } = require('../_lib/auth');

function parseDateOnly(str) {
  if (!str || typeof str !== 'string') return null;
  const parts = str.split('-');
  if (parts.length !== 3) return null;
  const [yearStr, monthStr, dayStr] = parts;
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

module.exports = async (req, res) => {
  if (handleCors(req, res)) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const user = authenticateToken(req, res);
  if (!user) {
    return; // authenticateToken ya respondió con 401
  }

  try {
    const url = new URL(req.url, 'http://localhost');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const service = url.searchParams.get('service');

    if (!from || !to) {
      return res.status(400).json({ error: 'missing_date_range' });
    }

    const fromDate = parseDateOnly(from);
    const toDate = parseDateOnly(to);

    if (!fromDate || !toDate) {
      return res.status(400).json({ error: 'invalid_date_range' });
    }

    let fromDateEffective = fromDate;
    let toDateEffective = toDate;
    let fromStr = from;
    let toStr = to;

    if (toDateEffective < fromDateEffective) {
      const tmpDate = fromDateEffective;
      fromDateEffective = toDateEffective;
      toDateEffective = tmpDate;

      const tmpStr = fromStr;
      fromStr = toStr;
      toStr = tmpStr;
    }

    const msInDay = 24 * 60 * 60 * 1000;
    const diffDays = Math.floor((toDateEffective - fromDateEffective) / msInDay) + 1;

    if (diffDays > 366) {
      return res.status(400).json({ error: 'range_too_large' });
    }

    const estResult = await db.query(
      'SELECT id, has_parking, has_carpas, has_sombrillas, has_pileta, parking_capacity, carpas_capacity, sombrillas_capacity, pool_max_occupancy FROM establishments WHERE user_id = $1',
      [user.id]
    );

    if (estResult.rows.length === 0) {
      return res.status(404).json({ error: 'establishment_not_found' });
    }

    const estRow = estResult.rows[0];

    const capacityByService = {
      carpa: estRow.has_carpas ? Number(estRow.carpas_capacity || 0) : 0,
      sombrilla: estRow.has_sombrillas ? Number(estRow.sombrillas_capacity || 0) : 0,
      parking: estRow.has_parking ? Number(estRow.parking_capacity || 0) : 0,
      pileta: estRow.has_pileta ? Number(estRow.pool_max_occupancy || 0) : 0
    };

    const allowedServices = ['carpa', 'sombrilla', 'parking', 'pileta'];

    let serviceFilter = null;
    if (service) {
      if (!allowedServices.includes(service)) {
        return res.status(400).json({ error: 'invalid_service' });
      }
      serviceFilter = service;
    }

    const servicesToInclude = serviceFilter
      ? [serviceFilter]
      : allowedServices.filter((s) => capacityByService[s] && capacityByService[s] > 0);

    if (servicesToInclude.length === 0) {
      return res.status(200).json({
        from: fromStr,
        to: toStr,
        service: serviceFilter || null,
        byDate: [],
        summary: { services: [] }
      });
    }

    const establishmentId = estRow.id;

    const params = [establishmentId, fromStr, toStr];
    let query = `
      SELECT
        service_type,
        resource_number,
        start_date,
        end_date,
        pool_adults_count,
        pool_children_count
      FROM reservation_groups
      WHERE establishment_id = $1
        AND status = 'active'
        AND end_date >= $2
        AND start_date <= $3
    `;

    if (serviceFilter) {
      params.push(serviceFilter);
      query += ' AND service_type = $4';
    }

    const groupsResult = await db.query(query, params);

    const formatDateOnly = (date) => {
      const year = date.getUTCFullYear();
      const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
      const day = `${date.getUTCDate()}`.padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const clampToRange = (date, min, max) => {
      if (date < min) return new Date(min.getTime());
      if (date > max) return new Date(max.getTime());
      return new Date(date.getTime());
    };

    const occupancyByDate = new Map();

    let cursor = new Date(fromDateEffective.getTime());
    while (cursor <= toDateEffective) {
      const key = formatDateOnly(cursor);
      occupancyByDate.set(key, new Map());
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const parsePgDate = (value) => {
      if (!value) return null;
      if (value instanceof Date) return new Date(value.getTime());
      return parseDateOnly(value);
    };

    for (const row of groupsResult.rows) {
      const serviceType = row.service_type;
      if (!allowedServices.includes(serviceType)) {
        continue;
      }

      const capacity = capacityByService[serviceType] || 0;
      if (!capacity || capacity <= 0) {
        continue;
      }

      const start = parsePgDate(row.start_date);
      const end = parsePgDate(row.end_date);

      if (!start || !end) {
        continue;
      }

      let effectiveStart = clampToRange(start, fromDateEffective, toDateEffective);
      let effectiveEnd = clampToRange(end, fromDateEffective, toDateEffective);

      if (effectiveEnd < effectiveStart) {
        continue;
      }

      const unitsForPool =
        Number(row.pool_adults_count || 0) + Number(row.pool_children_count || 0);
      const increment = serviceType === 'pileta'
        ? (Number.isFinite(unitsForPool) && unitsForPool > 0 ? unitsForPool : 0)
        : 1;

      if (increment <= 0) {
        continue;
      }

      let current = new Date(effectiveStart.getTime());
      while (current <= effectiveEnd) {
        const dateKey = formatDateOnly(current);
        const serviceMap = occupancyByDate.get(dateKey);
        if (serviceMap) {
          const prev = serviceMap.get(serviceType) || 0;
          serviceMap.set(serviceType, prev + increment);
        }
        current.setUTCDate(current.getUTCDate() + 1);
      }
    }

    const byDate = [];
    const summaryByService = new Map();

    cursor = new Date(fromDateEffective.getTime());
    while (cursor <= toDateEffective) {
      const dateKey = formatDateOnly(cursor);
      const serviceMap = occupancyByDate.get(dateKey) || new Map();

      const servicesArray = [];

      for (const s of servicesToInclude) {
        const capacity = capacityByService[s] || 0;
        if (!capacity || capacity <= 0) {
          continue;
        }

        const occupiedUnits = serviceMap.get(s) || 0;
        const occupancyPercent = capacity > 0 ? occupiedUnits / capacity : 0;

        servicesArray.push({
          serviceType: s,
          occupiedUnits,
          capacity,
          occupancyPercent
        });

        const existing = summaryByService.get(s) || {
          serviceType: s,
          totalOccupancyPercent: 0,
          daysCount: 0,
          maxOccupancyPercent: 0,
          maxOccupancyDate: null
        };

        existing.totalOccupancyPercent += occupancyPercent;
        existing.daysCount += 1;

        if (occupancyPercent > existing.maxOccupancyPercent) {
          existing.maxOccupancyPercent = occupancyPercent;
          existing.maxOccupancyDate = dateKey;
        }

        summaryByService.set(s, existing);
      }

      byDate.push({
        date: dateKey,
        services: servicesArray
      });

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const summaryServices = Array.from(summaryByService.values()).map((entry) => ({
      serviceType: entry.serviceType,
      avgOccupancyPercent:
        entry.daysCount > 0 ? entry.totalOccupancyPercent / entry.daysCount : 0,
      maxOccupancyPercent: entry.maxOccupancyPercent,
      maxOccupancyDate: entry.maxOccupancyDate
    }));

    return res.status(200).json({
      from: fromStr,
      to: toStr,
      service: serviceFilter || null,
      byDate,
      summary: {
        services: summaryServices
      }
    });
  } catch (error) {
    console.error('Error fetching occupancy report', error);
    return res.status(500).json({ error: 'server_error' });
  }
};
