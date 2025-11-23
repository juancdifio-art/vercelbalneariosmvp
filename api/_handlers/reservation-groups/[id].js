const db = require('../lib/db');
const handleCors = require('../lib/cors');
const { authenticateToken } = require('../lib/auth');

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

async function handlePatch(req, res, user, groupId) {
  try {
    const {
      customerName,
      customerPhone,
      dailyPrice,
      totalPrice,
      notes,
      status,
      clientId,
      poolAdultsCount,
      poolChildrenCount,
      poolAdultPricePerDay,
      poolChildPricePerDay
    } = await parseJsonBody(req);

    const allowedStatus = ['active', 'cancelled'];

    if (status !== undefined && status !== null && !allowedStatus.includes(status)) {
      return res.status(400).json({ error: 'invalid_status' });
    }

    const estResult = await db.query(
      'SELECT id FROM establishments WHERE user_id = $1',
      [user.id]
    );

    if (estResult.rows.length === 0) {
      return res.status(404).json({ error: 'establishment_not_found' });
    }

    const establishmentId = estResult.rows[0].id;

    const existingResult = await db.query(
      'SELECT id, establishment_id, service_type, resource_number, start_date, end_date, customer_name, customer_phone, daily_price, total_price, notes, status, client_id, pool_adults_count, pool_children_count, pool_adult_price_per_day, pool_child_price_per_day FROM reservation_groups WHERE id = $1 AND establishment_id = $2',
      [groupId, establishmentId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'not_found' });
    }

    const current = existingResult.rows[0];

    const nextCustomerName = customerName !== undefined ? customerName : current.customer_name;
    const nextCustomerPhone = customerPhone !== undefined ? customerPhone : current.customer_phone;
    const nextDailyPrice =
      dailyPrice !== undefined
        ? (dailyPrice === null || dailyPrice === ''
          ? null
          : Number.parseFloat(dailyPrice))
        : current.daily_price;
    const nextTotalPrice =
      totalPrice !== undefined
        ? (totalPrice === null || totalPrice === ''
          ? null
          : Number.parseFloat(totalPrice))
        : current.total_price;
    const nextNotes = notes !== undefined ? notes : current.notes;
    const nextStatus = status !== undefined && status !== null ? status : current.status;

    const nextPoolAdultsCount =
      poolAdultsCount !== undefined && poolAdultsCount !== null && poolAdultsCount !== ''
        ? Number.parseInt(poolAdultsCount, 10)
        : current.pool_adults_count;

    const nextPoolChildrenCount =
      poolChildrenCount !== undefined && poolChildrenCount !== null && poolChildrenCount !== ''
        ? Number.parseInt(poolChildrenCount, 10)
        : current.pool_children_count;

    const nextPoolAdultPricePerDay =
      poolAdultPricePerDay !== undefined
        ? (poolAdultPricePerDay === null || poolAdultPricePerDay === ''
          ? null
          : Number.parseFloat(poolAdultPricePerDay))
        : current.pool_adult_price_per_day;

    const nextPoolChildPricePerDay =
      poolChildPricePerDay !== undefined
        ? (poolChildPricePerDay === null || poolChildPricePerDay === ''
          ? null
          : Number.parseFloat(poolChildPricePerDay))
        : current.pool_child_price_per_day;

    let nextClientId;
    if (clientId !== undefined) {
      if (clientId === null || clientId === '') {
        nextClientId = null;
      } else {
        const parsed = Number.parseInt(clientId, 10);
        nextClientId = !Number.isNaN(parsed) && parsed > 0 ? parsed : null;
      }
    } else {
      nextClientId = current.client_id;
    }

    const updateResult = await db.query(
      'UPDATE reservation_groups SET customer_name = $1, customer_phone = $2, daily_price = $3, total_price = $4, notes = $5, status = $6, client_id = $7, pool_adults_count = $8, pool_children_count = $9, pool_adult_price_per_day = $10, pool_child_price_per_day = $11, updated_at = NOW() WHERE id = $12 RETURNING id, service_type, resource_number, start_date, end_date, customer_name, customer_phone, daily_price, total_price, notes, status, client_id, pool_adults_count, pool_children_count, pool_adult_price_per_day, pool_child_price_per_day',
      [
        nextCustomerName || null,
        nextCustomerPhone || null,
        nextDailyPrice,
        nextTotalPrice,
        nextNotes || null,
        nextStatus,
        nextClientId,
        nextPoolAdultsCount,
        nextPoolChildrenCount,
        nextPoolAdultPricePerDay,
        nextPoolChildPricePerDay,
        groupId
      ]
    );

    const updatedRow = updateResult.rows[0];

    return res.status(200).json({
      group: {
        id: updatedRow.id,
        serviceType: updatedRow.service_type,
        resourceNumber: updatedRow.resource_number,
        startDate: updatedRow.start_date instanceof Date
          ? updatedRow.start_date.toISOString().slice(0, 10)
          : updatedRow.start_date,
        endDate: updatedRow.end_date instanceof Date
          ? updatedRow.end_date.toISOString().slice(0, 10)
          : updatedRow.end_date,
        customerName: updatedRow.customer_name,
        customerPhone: updatedRow.customer_phone,
        dailyPrice: updatedRow.daily_price,
        totalPrice: updatedRow.total_price,
        notes: updatedRow.notes,
        status: updatedRow.status,
        clientId: updatedRow.client_id,
        poolAdultsCount: updatedRow.pool_adults_count,
        poolChildrenCount: updatedRow.pool_children_count,
        poolAdultPricePerDay: updatedRow.pool_adult_price_per_day,
        poolChildPricePerDay: updatedRow.pool_child_price_per_day
      }
    });
  } catch (error) {
    console.error('Error updating reservation group', error);
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

  const segments = req.url.split('?')[0].split('/').filter(Boolean);
  const idSegment = segments[segments.length - 1];
  const groupId = Number.parseInt(idSegment, 10);

  if (!groupId || Number.isNaN(groupId) || groupId <= 0) {
    return res.status(400).json({ error: 'invalid_id' });
  }

  if (req.method === 'PATCH') {
    return handlePatch(req, res, user, groupId);
  }

  return res.status(405).json({ error: 'method_not_allowed' });
};
