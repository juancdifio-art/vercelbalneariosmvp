const db = require('../_lib/db');
const handleCors = require('../_lib/cors');
const { authenticateToken } = require('../_lib/auth');

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
    const method = url.searchParams.get('method');

    if (!from || !to) {
      return res.status(400).json({ error: 'missing_date_range' });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return res.status(400).json({ error: 'invalid_date_range' });
    }

    const estResult = await db.query(
      'SELECT id FROM establishments WHERE user_id = $1',
      [user.id]
    );

    if (estResult.rows.length === 0) {
      return res.status(404).json({ error: 'establishment_not_found' });
    }

    const establishmentId = estResult.rows[0].id;

    const params = [establishmentId, from, to];
    let paramIndex = 4;
    let serviceClause = '';
    let methodClause = '';

    if (service) {
      serviceClause = ` AND rg.service_type = $${paramIndex}`;
      params.push(service);
      paramIndex += 1;
    }

    if (method) {
      methodClause = ` AND p.method = $${paramIndex}`;
      params.push(method);
      paramIndex += 1;
    }

    const query = `
      SELECT
        p.id,
        p.amount,
        p.payment_date,
        p.method,
        p.notes,
        p.client_id,
        rg.id AS reservation_group_id,
        rg.service_type,
        rg.resource_number,
        rg.customer_name,
        c.full_name AS client_full_name
      FROM reservation_payments p
      JOIN reservation_groups rg
        ON rg.id = p.reservation_group_id
      LEFT JOIN clients c
        ON c.id = p.client_id
      WHERE p.establishment_id = $1
        AND p.payment_date >= $2
        AND p.payment_date <= $3
        ${serviceClause}
        ${methodClause}
      ORDER BY p.payment_date ASC, p.id ASC
    `;

    const result = await db.query(query, params);

    const payments = result.rows.map((row) => ({
      id: row.id,
      amount: row.amount,
      paymentDate: row.payment_date instanceof Date
        ? row.payment_date.toISOString().slice(0, 10)
        : row.payment_date,
      method: row.method,
      notes: row.notes,
      clientId: row.client_id,
      reservationGroupId: row.reservation_group_id,
      serviceType: row.service_type,
      resourceNumber: row.resource_number,
      customerName: row.customer_name,
      clientFullName: row.client_full_name
    }));

    const totalsByDateMap = new Map();
    let totalAmount = 0;

    payments.forEach((payment) => {
      const dateKey = payment.paymentDate;
      const amountNum = Number(payment.amount || 0);

      totalAmount += amountNum;

      if (!totalsByDateMap.has(dateKey)) {
        totalsByDateMap.set(dateKey, {
          date: dateKey,
          totalAmount: 0,
          count: 0
        });
      }

      const entry = totalsByDateMap.get(dateKey);
      entry.totalAmount += amountNum;
      entry.count += 1;
    });

    const totalsByDate = Array.from(totalsByDateMap.values()).sort((a, b) => {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      return 0;
    });

    return res.status(200).json({
      from,
      to,
      service: service || null,
      method: method || null,
      totalAmount,
      totalsByDate,
      payments
    });
  } catch (error) {
    console.error('Error fetching payments report', error);
    return res.status(500).json({ error: 'server_error' });
  }
};
