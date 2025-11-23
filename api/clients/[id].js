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

async function handlePatch(req, res, user, clientId) {
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

    const estResult = await db.query(
      'SELECT id FROM establishments WHERE user_id = $1',
      [user.id]
    );

    if (estResult.rows.length === 0) {
      return res.status(404).json({ error: 'establishment_not_found' });
    }

    const establishmentId = estResult.rows[0].id;

    const existingResult = await db.query(
      `SELECT
         id,
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
       FROM clients
       WHERE id = $1 AND establishment_id = $2`,
      [clientId, establishmentId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'not_found' });
    }

    const current = existingResult.rows[0];

    const nextFullName =
      fullName !== undefined && fullName !== null ? fullName : current.full_name;
    const nextPhone = phone !== undefined ? phone : current.phone;
    const nextEmail = email !== undefined ? email : current.email;
    const nextNotes = notes !== undefined ? notes : current.notes;
    const nextDocumentNumber =
      documentNumber !== undefined ? documentNumber : current.document_number;
    const nextBirthDate = birthDate !== undefined ? birthDate : current.birth_date;
    const nextNationality =
      nationality !== undefined ? nationality : current.nationality;
    const nextAddressStreet =
      addressStreet !== undefined ? addressStreet : current.address_street;
    const nextAddressNeighborhood =
      addressNeighborhood !== undefined
        ? addressNeighborhood
        : current.address_neighborhood;
    const nextAddressPostalCode =
      addressPostalCode !== undefined
        ? addressPostalCode
        : current.address_postal_code;
    const nextAddressCity =
      addressCity !== undefined ? addressCity : current.address_city;
    const nextAddressState =
      addressState !== undefined ? addressState : current.address_state;
    const nextAddressCountry =
      addressCountry !== undefined ? addressCountry : current.address_country;
    const nextVehicleBrand =
      vehicleBrand !== undefined ? vehicleBrand : current.vehicle_brand;
    const nextVehicleModel =
      vehicleModel !== undefined ? vehicleModel : current.vehicle_model;
    const nextVehiclePlate =
      vehiclePlate !== undefined ? vehiclePlate : current.vehicle_plate;

    if (!nextFullName || typeof nextFullName !== 'string' || !nextFullName.trim()) {
      return res.status(400).json({ error: 'invalid_full_name' });
    }

    const updateResult = await db.query(
      `UPDATE clients
       SET
         full_name = $1,
         phone = $2,
         email = $3,
         notes = $4,
         document_number = $5,
         birth_date = $6,
         nationality = $7,
         address_street = $8,
         address_neighborhood = $9,
         address_postal_code = $10,
         address_city = $11,
         address_state = $12,
         address_country = $13,
         vehicle_brand = $14,
         vehicle_model = $15,
         vehicle_plate = $16,
         updated_at = NOW()
       WHERE id = $17
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
        nextFullName.trim(),
        nextPhone || null,
        nextEmail || null,
        nextNotes || null,
        nextDocumentNumber || null,
        nextBirthDate || null,
        nextNationality || null,
        nextAddressStreet || null,
        nextAddressNeighborhood || null,
        nextAddressPostalCode || null,
        nextAddressCity || null,
        nextAddressState || null,
        nextAddressCountry || null,
        nextVehicleBrand || null,
        nextVehicleModel || null,
        nextVehiclePlate || null,
        clientId
      ]
    );

    const row = updateResult.rows[0];

    return res.status(200).json({
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
    console.error('Error updating client', error);
    return res.status(500).json({ error: 'server_error' });
  }
}

async function handleDelete(req, res, user, clientId) {
  try {
    const estResult = await db.query(
      'SELECT id FROM establishments WHERE user_id = $1',
      [user.id]
    );

    if (estResult.rows.length === 0) {
      return res.status(404).json({ error: 'establishment_not_found' });
    }

    const establishmentId = estResult.rows[0].id;

    const deleteResult = await db.query(
      'DELETE FROM clients WHERE id = $1 AND establishment_id = $2 RETURNING id',
      [clientId, establishmentId]
    );

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({ error: 'not_found' });
    }

    return res.status(200).json({ status: 'deleted' });
  } catch (error) {
    console.error('Error deleting client', error);
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

  // Vercel pasa el segmento dinámico como parte de la URL, extraemos el último segmento
  const segments = req.url.split('?')[0].split('/').filter(Boolean);
  const idSegment = segments[segments.length - 1];
  const clientId = Number.parseInt(idSegment, 10);

  if (!clientId || Number.isNaN(clientId) || clientId <= 0) {
    return res.status(400).json({ error: 'invalid_id' });
  }

  if (req.method === 'PATCH') {
    return handlePatch(req, res, user, clientId);
  }

  if (req.method === 'DELETE') {
    return handleDelete(req, res, user, clientId);
  }

  return res.status(405).json({ error: 'method_not_allowed' });
};
