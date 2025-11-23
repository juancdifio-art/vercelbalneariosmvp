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

module.exports = async (req, res) => {
  if (handleCors(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const user = authenticateToken(req, res);
  if (!user) {
    return; // authenticateToken ya respondió con 401
  }

  try {
    const {
      name,
      hasParking,
      hasCarpas,
      hasSombrillas,
      hasPileta,
      parkingCapacity,
      carpasCapacity,
      sombrillasCapacity,
      poolMaxOccupancy
    } = await parseJsonBody(req);

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'invalid_name' });
    }

    const estResult = await db.query(
      'SELECT id FROM establishments WHERE user_id = $1',
      [user.id]
    );

    let result;

    const parkingCap =
      parkingCapacity === null || parkingCapacity === undefined || parkingCapacity === ''
        ? null
        : Number.isNaN(Number.parseInt(parkingCapacity, 10))
          ? null
          : Number.parseInt(parkingCapacity, 10);

    const carpasCap =
      carpasCapacity === null || carpasCapacity === undefined || carpasCapacity === ''
        ? null
        : Number.isNaN(Number.parseInt(carpasCapacity, 10))
          ? null
          : Number.parseInt(carpasCapacity, 10);

    const sombrillasCap =
      sombrillasCapacity === null || sombrillasCapacity === undefined || sombrillasCapacity === ''
        ? null
        : Number.isNaN(Number.parseInt(sombrillasCapacity, 10))
          ? null
          : Number.parseInt(sombrillasCapacity, 10);

    const poolCap =
      poolMaxOccupancy === null || poolMaxOccupancy === undefined || poolMaxOccupancy === ''
        ? null
        : Number.isNaN(Number.parseInt(poolMaxOccupancy, 10))
          ? null
          : Number.parseInt(poolMaxOccupancy, 10);

    if (estResult.rows.length === 0) {
      result = await db.query(
        'INSERT INTO establishments (user_id, name, has_parking, has_carpas, has_sombrillas, has_pileta, parking_capacity, carpas_capacity, sombrillas_capacity, pool_max_occupancy) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, name, has_parking, has_carpas, has_sombrillas, has_pileta, parking_capacity, carpas_capacity, sombrillas_capacity, pool_max_occupancy',
        [
          user.id,
          name,
          Boolean(hasParking),
          Boolean(hasCarpas),
          Boolean(hasSombrillas),
          Boolean(hasPileta),
          parkingCap,
          carpasCap,
          sombrillasCap,
          poolCap
        ]
      );
    } else {
      result = await db.query(
        'UPDATE establishments SET name = $1, has_parking = $2, has_carpas = $3, has_sombrillas = $4, has_pileta = $5, parking_capacity = $6, carpas_capacity = $7, sombrillas_capacity = $8, pool_max_occupancy = $9 WHERE user_id = $10 RETURNING id, name, has_parking, has_carpas, has_sombrillas, has_pileta, parking_capacity, carpas_capacity, sombrillas_capacity, pool_max_occupancy',
        [
          name,
          Boolean(hasParking),
          Boolean(hasCarpas),
          Boolean(hasSombrillas),
          Boolean(hasPileta),
          parkingCap,
          carpasCap,
          sombrillasCap,
          poolCap,
          user.id
        ]
      );
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
    console.error('Error saving establishment', error);
    return res.status(500).json({ error: 'server_error' });
  }
};
