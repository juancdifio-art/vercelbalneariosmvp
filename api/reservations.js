const db = require('./_lib/db');
const handleCors = require('./_lib/cors');
const { authenticateToken } = require('./_lib/auth');

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
    const service = url.searchParams.get('service');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    const allowedServices = ['carpa', 'sombrilla', 'parking'];

    if (!service || !allowedServices.includes(service)) {
      return res.status(400).json({ error: 'invalid_service' });
    }

    if (!from || !to) {
      return res.status(400).json({ error: 'missing_dates' });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return res.status(400).json({ error: 'invalid_dates' });
    }

    const estResult = await db.query(
      'SELECT id FROM establishments WHERE user_id = $1',
      [user.id]
    );

    if (estResult.rows.length === 0) {
      return res.status(404).json({ error: 'establishment_not_found' });
    }

    const establishmentId = estResult.rows[0].id;

    const result = await db.query(
      `SELECT id, service_type, resource_number, start_date, end_date, status 
       FROM reservation_groups 
       WHERE establishment_id = $1 
         AND service_type = $2 
         AND status = 'active'
         AND NOT (end_date < $3::date OR start_date > $4::date)
       ORDER BY start_date, resource_number`,
      [establishmentId, service, from, to]
    );

    return res.status(200).json({
      reservations: result.rows.map((row) => ({
        id: row.id,
        serviceType: row.service_type,
        resourceNumber: row.resource_number,
        startDate: row.start_date instanceof Date
          ? row.start_date.toISOString().slice(0, 10)
          : row.start_date,
        endDate: row.end_date instanceof Date
          ? row.end_date.toISOString().slice(0, 10)
          : row.end_date
      }))
    });
  } catch (error) {
    console.error('Error fetching reservations', error);
    return res.status(500).json({ error: 'server_error' });
  }
};
