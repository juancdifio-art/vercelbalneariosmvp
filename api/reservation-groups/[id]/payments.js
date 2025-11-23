const db = require('../../_lib/db');
const handleCors = require('../../_lib/cors');
const { authenticateToken } = require('../../_lib/auth');

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

async function handleGet(req, res, user, groupId) {
  try {
    const estResult = await db.query(
      'SELECT id FROM establishments WHERE user_id = $1',
      [user.id]
    );

    if (estResult.rows.length === 0) {
      return res.status(404).json({ error: 'establishment_not_found' });
    }

    const establishmentId = estResult.rows[0].id;

    const groupResult = await db.query(
      'SELECT id, client_id FROM reservation_groups WHERE id = $1 AND establishment_id = $2',
      [groupId, establishmentId]
    );

    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: 'not_found' });
    }

    const paymentsResult = await db.query(
      'SELECT id, amount, payment_date, method, notes, client_id FROM reservation_payments WHERE establishment_id = $1 AND reservation_group_id = $2 ORDER BY payment_date ASC, id ASC',
      [establishmentId, groupId]
    );

    return res.status(200).json({
      payments: paymentsResult.rows.map((row) => ({
        id: row.id,
        amount: row.amount,
        paymentDate: row.payment_date instanceof Date
          ? row.payment_date.toISOString().slice(0, 10)
          : row.payment_date,
        method: row.method,
        notes: row.notes,
        clientId: row.client_id
      }))
    });
  } catch (error) {
    console.error('Error fetching reservation payments', error);
    return res.status(500).json({ error: 'server_error' });
  }
}

async function handlePost(req, res, user, groupId) {
  try {
    const { amount, paymentDate, method, notes } = await parseJsonBody(req);

    if (amount === undefined || amount === null || amount === '') {
      return res.status(400).json({ error: 'missing_amount' });
    }

    const amountParsed = Number.parseFloat(amount);

    if (Number.isNaN(amountParsed) || amountParsed <= 0) {
      return res.status(400).json({ error: 'invalid_amount' });
    }

    if (!paymentDate) {
      return res.status(400).json({ error: 'missing_payment_date' });
    }

    const paymentDateParsed = new Date(paymentDate);

    if (Number.isNaN(paymentDateParsed.getTime())) {
      return res.status(400).json({ error: 'invalid_payment_date' });
    }

    const estResult = await db.query(
      'SELECT id FROM establishments WHERE user_id = $1',
      [user.id]
    );

    if (estResult.rows.length === 0) {
      return res.status(404).json({ error: 'establishment_not_found' });
    }

    const establishmentId = estResult.rows[0].id;

    const groupResult = await db.query(
      'SELECT id, client_id FROM reservation_groups WHERE id = $1 AND establishment_id = $2',
      [groupId, establishmentId]
    );

    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: 'not_found' });
    }

    const groupRow = groupResult.rows[0];

    const insertResult = await db.query(
      'INSERT INTO reservation_payments (establishment_id, reservation_group_id, client_id, amount, payment_date, method, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, amount, payment_date, method, notes, client_id, created_at, updated_at',
      [
        establishmentId,
        groupId,
        groupRow.client_id,
        amountParsed,
        paymentDate,
        method || null,
        notes || null
      ]
    );

    const row = insertResult.rows[0];

    return res.status(201).json({
      payment: {
        id: row.id,
        amount: row.amount,
        paymentDate: row.payment_date instanceof Date
          ? row.payment_date.toISOString().slice(0, 10)
          : row.payment_date,
        method: row.method,
        notes: row.notes,
        clientId: row.client_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });
  } catch (error) {
    console.error('Error creating reservation payment', error);
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
  // URL esperada: /api/reservation-groups/:id/payments
  const idIndex = segments.indexOf('reservation-groups') + 1;
  const idSegment = segments[idIndex];
  const groupId = Number.parseInt(idSegment, 10);

  if (!groupId || Number.isNaN(groupId) || groupId <= 0) {
    return res.status(400).json({ error: 'invalid_id' });
  }

  if (req.method === 'GET') {
    return handleGet(req, res, user, groupId);
  }

  if (req.method === 'POST') {
    return handlePost(req, res, user, groupId);
  }

  return res.status(405).json({ error: 'method_not_allowed' });
};
