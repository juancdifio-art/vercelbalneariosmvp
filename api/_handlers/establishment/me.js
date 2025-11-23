const db = require('../lib/db');
const handleCors = require('../lib/cors');
const { authenticateToken } = require('../lib/auth');

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
    const result = await db.query(
      'SELECT id, name, has_parking, has_carpas, has_sombrillas, has_pileta, parking_capacity, carpas_capacity, sombrillas_capacity, pool_max_occupancy FROM establishments WHERE user_id = $1',
      [user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'not_found' });
    }

    const row = result.rows[0];

    return res.status(200).json({
      establishment: {
        id: row.id,
        name: row.name,
        hasParking: row.has_parking,
        hasCarpas: row.has_carpas,
        hasSombrillas: row.has_sombrillas,
        hasPileta: row.has_pileta,
        parkingCapacity: row.parking_capacity,
        carpasCapacity: row.carpas_capacity,
        sombrillasCapacity: row.sombrillas_capacity,
        poolMaxOccupancy: row.pool_max_occupancy
      }
    });
  } catch (error) {
    console.error('Error fetching establishment', error);
    return res.status(500).json({ error: 'server_error' });
  }
};
