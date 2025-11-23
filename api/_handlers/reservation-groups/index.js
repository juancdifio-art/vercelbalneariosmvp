const db = require('../_lib/db');
const handleCors = require('../_lib/cors');
const { authenticateToken } = require('../_lib/auth');

async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        const json = JSON.parse(data);
        resolve(json);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

async function handleGet(req, res, user) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const service = url.searchParams.get('service');
    const status = url.searchParams.get('status');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const clientId = url.searchParams.get('clientId');

    const allowedServices = ['carpa', 'sombrilla', 'parking', 'pileta'];
    const allowedStatus = ['active', 'cancelled'];

    const estResult = await db.query(
      'SELECT id FROM establishments WHERE user_id = $1',
      [user.id]
    );

    if (estResult.rows.length === 0) {
      return res.status(404).json({ error: 'establishment_not_found' });
    }

    const establishmentId = estResult.rows[0].id;

    let query = `
      SELECT
        rg.id,
        rg.service_type,
        rg.resource_number,
        rg.start_date,
        rg.end_date,
        rg.customer_name,
        rg.customer_phone,
        rg.daily_price,
        rg.total_price,
        rg.notes,
        rg.status,
        rg.client_id,
        rg.pool_adults_count,
        rg.pool_children_count,
        rg.pool_adult_price_per_day,
        rg.pool_child_price_per_day,
        COALESCE(SUM(rp.amount), 0) AS paid_amount
      FROM reservation_groups rg
      LEFT JOIN reservation_payments rp
        ON rp.establishment_id = rg.establishment_id
       AND rp.reservation_group_id = rg.id
      WHERE rg.establishment_id = $1`;

    const params = [establishmentId];

    if (service && allowedServices.includes(service)) {
      query += ` AND rg.service_type = $${params.length + 1}`;
      params.push(service);
    }

    if (status && allowedStatus.includes(status)) {
      query += ` AND rg.status = $${params.length + 1}`;
      params.push(status);
    }

    if (clientId) {
      const parsedClientId = Number.parseInt(clientId, 10);

      if (!parsedClientId || Number.isNaN(parsedClientId) || parsedClientId <= 0) {
        return res.status(400).json({ error: 'invalid_client_id' });
      }

      query += ` AND rg.client_id = $${params.length + 1}`;
      params.push(parsedClientId);
    }

    let fromStr = from || null;
    let toStr = to || null;

    if (fromStr) {
      const fromDate = new Date(fromStr);
      if (Number.isNaN(fromDate.getTime())) {
        return res.status(400).json({ error: 'invalid_from' });
      }
    }

    if (toStr) {
      const toDate = new Date(toStr);
      if (Number.isNaN(toDate.getTime())) {
        return res.status(400).json({ error: 'invalid_to' });
      }
    }

    if (fromStr && toStr) {
      const fromDate = new Date(fromStr);
      const toDate = new Date(toStr);

      if (toDate < fromDate) {
        const tmp = fromStr;
        fromStr = toStr;
        toStr = tmp;
      }

      query += ` AND rg.start_date <= $${params.length + 1} AND rg.end_date >= $${params.length + 2}`;
      params.push(toStr, fromStr);
    } else if (fromStr) {
      query += ` AND rg.end_date >= $${params.length + 1}`;
      params.push(fromStr);
    } else if (toStr) {
      query += ` AND rg.start_date <= $${params.length + 1}`;
      params.push(toStr);
    }

    query += `
      GROUP BY
        rg.id,
        rg.service_type,
        rg.resource_number,
        rg.start_date,
        rg.end_date,
        rg.customer_name,
        rg.customer_phone,
        rg.daily_price,
        rg.total_price,
        rg.notes,
        rg.status,
        rg.client_id,
        rg.pool_adults_count,
        rg.pool_children_count,
        rg.pool_adult_price_per_day,
        rg.pool_child_price_per_day
      ORDER BY rg.start_date ASC, rg.resource_number ASC`;

    const result = await db.query(query, params);

    return res.status(200).json({
      reservationGroups: result.rows.map((row) => ({
        id: row.id,
        serviceType: row.service_type,
        resourceNumber: row.resource_number,
        startDate: row.start_date instanceof Date
          ? row.start_date.toISOString().slice(0, 10)
          : row.start_date,
        endDate: row.end_date instanceof Date
          ? row.end_date.toISOString().slice(0, 10)
          : row.end_date,
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        dailyPrice: row.daily_price,
        totalPrice: row.total_price,
        notes: row.notes,
        status: row.status,
        clientId: row.client_id,
        poolAdultsCount: row.pool_adults_count,
        poolChildrenCount: row.pool_children_count,
        poolAdultPricePerDay: row.pool_adult_price_per_day,
        poolChildPricePerDay: row.pool_child_price_per_day,
        paidAmount: Number(row.paid_amount || 0)
      }))
    });
  } catch (error) {
    console.error('Error fetching reservation groups', error);
    return res.status(500).json({ error: 'server_error' });
  }
}

async function handlePost(req, res, user) {
  try {
    const {
      serviceType,
      resourceNumber,
      startDate,
      endDate,
      customerName,
      customerPhone,
      dailyPrice,
      totalPrice,
      notes,
      clientId,
      poolAdultsCount,
      poolChildrenCount,
      poolAdultPricePerDay,
      poolChildPricePerDay
    } = await parseJsonBody(req);

    const allowedServices = ['carpa', 'sombrilla', 'parking', 'pileta'];

    if (!serviceType || !allowedServices.includes(serviceType)) {
      return res.status(400).json({ error: 'invalid_service' });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'missing_dates' });
    }

    const startParsed = new Date(startDate);
    const endParsed = new Date(endDate);

    if (Number.isNaN(startParsed.getTime()) || Number.isNaN(endParsed.getTime())) {
      return res.status(400).json({ error: 'invalid_dates' });
    }

    let fromStr = startDate;
    let toStr = endDate;

    if (endParsed < startParsed) {
      const tmp = fromStr;
      fromStr = toStr;
      toStr = tmp;
    }

    const resourceNumParsed = Number.parseInt(resourceNumber, 10);

    if (!resourceNumParsed || Number.isNaN(resourceNumParsed) || resourceNumParsed <= 0) {
      return res.status(400).json({ error: 'invalid_resource_number' });
    }

    const estResult = await db.query(
      'SELECT id FROM establishments WHERE user_id = $1',
      [user.id]
    );

    if (estResult.rows.length === 0) {
      return res.status(404).json({ error: 'establishment_not_found' });
    }

    const establishmentId = estResult.rows[0].id;

    const isPool = serviceType === 'pileta';

    if (!isPool) {
      const overlapResult = await db.query(
        `SELECT 1
         FROM reservation_groups
         WHERE establishment_id = $1
           AND service_type = $2
           AND resource_number = $3
           AND status = 'active'
           AND NOT (end_date < $4::date OR start_date > $5::date)
         LIMIT 1`,
        [establishmentId, serviceType, resourceNumParsed, fromStr, toStr]
      );

      if (overlapResult.rows.length > 0) {
        return res.status(409).json({ error: 'no_availability' });
      }
    }

    let dailyPriceParsed =
      dailyPrice !== undefined && dailyPrice !== null && dailyPrice !== ''
        ? Number.parseFloat(dailyPrice)
        : null;

    let totalPriceParsed =
      totalPrice !== undefined && totalPrice !== null && totalPrice !== ''
        ? Number.parseFloat(totalPrice)
        : null;

    let poolAdultsCountParsed = 0;
    let poolChildrenCountParsed = 0;
    let poolAdultPricePerDayParsed = null;
    let poolChildPricePerDayParsed = null;

    if (isPool) {
      poolAdultsCountParsed =
        poolAdultsCount !== undefined && poolAdultsCount !== null && poolAdultsCount !== ''
          ? Number.parseInt(poolAdultsCount, 10)
          : 0;
      if (Number.isNaN(poolAdultsCountParsed) || poolAdultsCountParsed < 0) {
        poolAdultsCountParsed = 0;
      }

      poolChildrenCountParsed =
        poolChildrenCount !== undefined && poolChildrenCount !== null && poolChildrenCount !== ''
          ? Number.parseInt(poolChildrenCount, 10)
          : 0;
      if (Number.isNaN(poolChildrenCountParsed) || poolChildrenCountParsed < 0) {
        poolChildrenCountParsed = 0;
      }

      poolAdultPricePerDayParsed =
        poolAdultPricePerDay !== undefined && poolAdultPricePerDay !== null && poolAdultPricePerDay !== ''
          ? Number.parseFloat(poolAdultPricePerDay)
          : 0;
      if (Number.isNaN(poolAdultPricePerDayParsed) || poolAdultPricePerDayParsed < 0) {
        poolAdultPricePerDayParsed = 0;
      }

      poolChildPricePerDayParsed =
        poolChildPricePerDay !== undefined && poolChildPricePerDay !== null && poolChildPricePerDay !== ''
          ? Number.parseFloat(poolChildPricePerDay)
          : 0;
      if (Number.isNaN(poolChildPricePerDayParsed) || poolChildPricePerDayParsed < 0) {
        poolChildPricePerDayParsed = 0;
      }

      const msPerDay = 24 * 60 * 60 * 1000;
      const startForDiff = new Date(fromStr);
      const endForDiff = new Date(toStr);
      let daysCount = Math.floor((endForDiff - startForDiff) / msPerDay) + 1;
      if (!Number.isFinite(daysCount) || daysCount <= 0) {
        daysCount = 1;
      }

      const computedDaily =
        poolAdultsCountParsed * poolAdultPricePerDayParsed +
        poolChildrenCountParsed * poolChildPricePerDayParsed;
      const computedTotal = computedDaily * daysCount;

      dailyPriceParsed = Number.isNaN(computedDaily) ? null : computedDaily;
      totalPriceParsed = Number.isNaN(computedTotal) ? null : computedTotal;
    }

    let clientIdParsed = null;
    if (clientId !== undefined && clientId !== null && clientId !== '') {
      const parsed = Number.parseInt(clientId, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        clientIdParsed = parsed;
      }
    }

    if (isPool && !clientIdParsed) {
      return res.status(400).json({ error: 'pool_client_required' });
    }

    const groupInsert = await db.query(
      `INSERT INTO reservation_groups (
        establishment_id,
        service_type,
        resource_number,
        start_date,
        end_date,
        customer_name,
        customer_phone,
        daily_price,
        total_price,
        notes,
        pool_adults_count,
        pool_children_count,
        pool_adult_price_per_day,
        pool_child_price_per_day,
        client_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id, service_type, resource_number, start_date, end_date, customer_name, customer_phone, daily_price, total_price, notes, status, client_id, pool_adults_count, pool_children_count, pool_adult_price_per_day, pool_child_price_per_day`,
      [
        establishmentId,
        serviceType,
        resourceNumParsed,
        fromStr,
        toStr,
        customerName || null,
        customerPhone || null,
        Number.isNaN(dailyPriceParsed) ? null : dailyPriceParsed,
        Number.isNaN(totalPriceParsed) ? null : totalPriceParsed,
        notes || null,
        poolAdultsCountParsed,
        poolChildrenCountParsed,
        poolAdultPricePerDayParsed,
        poolChildPricePerDayParsed,
        clientIdParsed
      ]
    );

    const groupRow = groupInsert.rows[0];

    return res.status(201).json({
      status: 'created',
      group: {
        id: groupRow.id,
        serviceType: groupRow.service_type,
        resourceNumber: groupRow.resource_number,
        startDate: groupRow.start_date instanceof Date
          ? groupRow.start_date.toISOString().slice(0, 10)
          : groupRow.start_date,
        endDate: groupRow.end_date instanceof Date
          ? groupRow.end_date.toISOString().slice(0, 10)
          : groupRow.end_date,
        customerName: groupRow.customer_name,
        customerPhone: groupRow.customer_phone,
        dailyPrice: groupRow.daily_price,
        totalPrice: groupRow.total_price,
        notes: groupRow.notes,
        status: groupRow.status,
        clientId: groupRow.client_id,
        poolAdultsCount: groupRow.pool_adults_count,
        poolChildrenCount: groupRow.pool_children_count,
        poolAdultPricePerDay: groupRow.pool_adult_price_per_day,
        poolChildPricePerDay: groupRow.pool_child_price_per_day,
        paidAmount: 0
      }
    });
  } catch (error) {
    console.error('Error creating reservation group', error);
    return res.status(500).json({ error: 'server_error' });
  }
}

module.exports = async (req, res) => {
  if (handleCors(req, res)) {
    return;
  }

  const user = authenticateToken(req, res);
  if (!user) {
    return; // authenticateToken ya respondió con 401
  }

  if (req.method === 'GET') {
    return handleGet(req, res, user);
  }

  if (req.method === 'POST') {
    return handlePost(req, res, user);
  }

  return res.status(405).json({ error: 'method_not_allowed' });
};
