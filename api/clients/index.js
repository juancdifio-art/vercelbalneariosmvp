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
    const estResult = await db.query(
      'SELECT id FROM establishments WHERE user_id = $1',
      [user.id]
    );

    if (estResult.rows.length === 0) {
      return res.status(404).json({ error: 'establishment_not_found' });
    }

    const establishmentId = estResult.rows[0].id;

    const result = await db.query(
      `SELECT
         id,
         full_name,
         phone,
         email,
         notes,
         document_number,
         birth_date,
         nationality,
         address_street,
         address_neighborhood,
         address_postal_code,
         address_city,
         address_state,
         address_country,
         vehicle_brand,
         vehicle_model,
         vehicle_plate,
         created_at,
         updated_at
       FROM clients
       WHERE establishment_id = $1
       ORDER BY full_name ASC`,
      [establishmentId]
    );

    return res.status(200).json({
      clients: result.rows.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        phone: row.phone,
        email: row.email,
        notes: row.notes,
        documentNumber: row.document_number,
        birthDate: row.birth_date,
        nationality: row.nationality,
        addressStreet: row.address_street,
        addressNeighborhood: row.address_neighborhood,
        addressPostalCode: row.address_postal_code,
        addressCity: row.address_city,
        addressState: row.address_state,
        addressCountry: row.address_country,
        vehicleBrand: row.vehicle_brand,
        vehicleModel: row.vehicle_model,
        vehiclePlate: row.vehicle_plate,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    });
  } catch (error) {
    console.error('Error fetching clients', error);
    return res.status(500).json({ error: 'server_error' });
  }
}

async function handlePost(req, res, user) {
  try {
    const {
      fullName,
      phone,
      email,
      notes,
      documentNumber,
      birthDate,
      nationality,
      addressStreet,
      addressNeighborhood,
      addressPostalCode,
      addressCity,
      addressState,
      addressCountry,
      vehicleBrand,
      vehicleModel,
      vehiclePlate
    } = await parseJsonBody(req);

    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return res.status(400).json({ error: 'invalid_full_name' });
    }

    const estResult = await db.query(
      'SELECT id FROM establishments WHERE user_id = $1',
      [user.id]
    );

    if (estResult.rows.length === 0) {
      return res.status(404).json({ error: 'establishment_not_found' });
    }

    const establishmentId = estResult.rows[0].id;
    const nameTrimmed = fullName.trim();

    const insertResult = await db.query(
      `INSERT INTO clients (
         establishment_id,
         full_name,
         phone,
         email,
         notes,
         document_number,
         birth_date,
         nationality,
         address_street,
         address_neighborhood,
         address_postal_code,
         address_city,
         address_state,
         address_country,
         vehicle_brand,
         vehicle_model,
         vehicle_plate
       )
       VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8,
         $9, $10, $11, $12, $13, $14,
         $15, $16, $17
       )
       RETURNING
         id,
         full_name,
         phone,
         email,
         notes,
         document_number,
         birth_date,
         nationality,
         address_street,
         address_neighborhood,
         address_postal_code,
         address_city,
         address_state,
         address_country,
         vehicle_brand,
         vehicle_model,
         vehicle_plate,
         created_at,
         updated_at`,
      [
        establishmentId,
        nameTrimmed,
        phone || null,
        email || null,
        notes || null,
        documentNumber || null,
        birthDate || null,
        nationality || null,
        addressStreet || null,
        addressNeighborhood || null,
        addressPostalCode || null,
        addressCity || null,
        addressState || null,
        addressCountry || null,
        vehicleBrand || null,
        vehicleModel || null,
        vehiclePlate || null
      ]
    );

    const row = insertResult.rows[0];

    return res.status(201).json({
      client: {
        id: row.id,
        fullName: row.full_name,
        phone: row.phone,
        email: row.email,
        notes: row.notes,
        documentNumber: row.document_number,
        birthDate: row.birth_date,
        nationality: row.nationality,
        addressStreet: row.address_street,
        addressNeighborhood: row.address_neighborhood,
        addressPostalCode: row.address_postal_code,
        addressCity: row.address_city,
        addressState: row.address_state,
        addressCountry: row.address_country,
        vehicleBrand: row.vehicle_brand,
        vehicleModel: row.vehicle_model,
        vehiclePlate: row.vehicle_plate,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });
  } catch (error) {
    console.error('Error creating client', error);
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
