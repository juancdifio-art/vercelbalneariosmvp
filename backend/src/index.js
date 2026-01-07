const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

const pool = require('./db');

const app = express();

// Configurar CORS para soportar múltiples orígenes (desarrollo y producción)
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174'
].filter(Boolean); // Remover valores undefined/null

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (como Postman, curl, apps móviles)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'missing_token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.userId,
      email: payload.email
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('DB healthcheck error:', error);
    res.status(500).json({ error: 'database_error' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'email_in_use' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, passwordHash]
    );

    const user = result.rows[0];

    res.status(201).json({ user });
  } catch (error) {
    res.status(500).json({ error: 'server_error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    const result = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    const user = result.rows[0];

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/establishment/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      'SELECT id, name, has_parking, has_carpas, has_sombrillas, has_pileta, parking_capacity, carpas_capacity, sombrillas_capacity, pool_max_occupancy FROM establishments WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'not_found' });
    }

    const row = result.rows[0];

    res.json({
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
    res.status(500).json({ error: 'server_error' });
  }
});

app.post('/api/establishment', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
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
    } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'invalid_name' });
    }

    const existing = await pool.query(
      'SELECT id FROM establishments WHERE user_id = $1',
      [userId]
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

    if (existing.rows.length === 0) {
      result = await pool.query(
        'INSERT INTO establishments (user_id, name, has_parking, has_carpas, has_sombrillas, has_pileta, parking_capacity, carpas_capacity, sombrillas_capacity, pool_max_occupancy) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, name, has_parking, has_carpas, has_sombrillas, has_pileta, parking_capacity, carpas_capacity, sombrillas_capacity, pool_max_occupancy',
        [
          userId,
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
      result = await pool.query(
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
          userId
        ]
      );
    }

    const row = result.rows[0];

    res.json({
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
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/clients', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const estResult = await pool.query(
      'SELECT id FROM establishments WHERE user_id = $1',
      [userId]
    );

    if (estResult.rows.length === 0) {
      return res.status(404).json({ error: 'establishment_not_found' });
    }

    const establishmentId = estResult.rows[0].id;

    const result = await pool.query(
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

    return res.json({
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
    res.status(500).json({ error: 'server_error' });
  }
});

app.post('/api/clients', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
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
    } = req.body;

    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return res.status(400).json({ error: 'invalid_full_name' });
    }

    const estResult = await pool.query(
      'SELECT id FROM establishments WHERE user_id = $1',
      [userId]
    );

    if (estResult.rows.length === 0) {
      return res.status(404).json({ error: 'establishment_not_found' });
    }

    const establishmentId = estResult.rows[0].id;
    const nameTrimmed = fullName.trim();

    const insertResult = await pool.query(
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
    res.status(500).json({ error: 'server_error' });
  }
});

app.patch('/api/clients/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const clientId = Number.parseInt(req.params.id, 10);

    if (!clientId || Number.isNaN(clientId) || clientId <= 0) {
      return res.status(400).json({ error: 'invalid_id' });
    }

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
    } = req.body;

    const estResult = await pool.query(
      'SELECT id FROM establishments WHERE user_id = $1',
      [userId]
    );

    if (estResult.rows.length === 0) {
      return res.status(404).json({ error: 'establishment_not_found' });
    }

    const establishmentId = estResult.rows[0].id;

    const existingResult = await pool.query(
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

    const updateResult = await pool.query(
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

    return res.json({
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
    res.status(500).json({ error: 'server_error' });
  }
});

app.delete('/api/clients/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const clientId = Number.parseInt(req.params.id, 10);

    if (!clientId || Number.isNaN(clientId) || clientId <= 0) {
      return res.status(400).json({ error: 'invalid_id' });
    }

    const estResult = await pool.query(
      'SELECT id FROM establishments WHERE user_id = $1',
      [userId]
    );

    if (estResult.rows.length === 0) {
      return res.status(404).json({ error: 'establishment_not_found' });
    }

    const establishmentId = estResult.rows[0].id;

    const deleteResult = await pool.query(
      'DELETE FROM clients WHERE id = $1 AND establishment_id = $2 RETURNING id',
      [clientId, establishmentId]
    );

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({ error: 'not_found' });
    }

    return res.json({ status: 'deleted' });
  } catch (error) {
    console.error('Error deleting client', error);
    res.status(500).json({ error: 'server_error' });
  }
});

// Endpoint modificado para devolver bloques de reservation_groups
// Ahora devuelve rangos completos en vez de días individuales
app.get('/api/reservations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { service, from, to } = req.query;

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

    const estResult = await pool.query(
      'SELECT id FROM establishments WHERE user_id = $1',
      [userId]
    );

    if (estResult.rows.length === 0) {
      return res.status(404).json({ error: 'establishment_not_found' });
    }

    const establishmentId = estResult.rows[0].id;

    // Obtener reservation_groups que se solapan con el rango solicitado
    const result = await pool.query(
      `SELECT id, service_type, resource_number, start_date, end_date, status 
       FROM reservation_groups 
       WHERE establishment_id = $1 
         AND service_type = $2 
         AND status = 'active'
         AND NOT (end_date < $3::date OR start_date > $4::date)
       ORDER BY start_date, resource_number`,
      [establishmentId, service, from, to]
    );

    res.json({
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
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/reservation-groups', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { service, status, from, to, clientId } = req.query;

    const allowedServices = ['carpa', 'sombrilla', 'parking', 'pileta'];
    const allowedStatus = ['active', 'cancelled'];

    const estResult = await pool.query(
      'SELECT id FROM establishments WHERE user_id = $1',
      [userId]
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

    // Filtro por rango de fechas (reservas que se solapan con [from, to])
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

      // Reservas que se superponen con el rango [fromStr, toStr]
      query += ` AND rg.start_date <= $${params.length + 1} AND rg.end_date >= $${params.length + 2}`;
      params.push(toStr, fromStr);
    } else if (fromStr) {
      // Reservas que terminan después o el mismo día de from
      query += ` AND rg.end_date >= $${params.length + 1}`;
      params.push(fromStr);
    } else if (toStr) {
      // Reservas que comienzan antes o el mismo día de to
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

    const result = await pool.query(query, params);

    return res.json({
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
    res.status(500).json({ error: 'server_error' });
  }
});

app.post('/api/reservation-groups', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
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
    } = req.body;

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

    const estResult = await pool.query(
      'SELECT id FROM establishments WHERE user_id = $1',
      [userId]
    );

    if (estResult.rows.length === 0) {
      return res.status(404).json({ error: 'establishment_not_found' });
    }

    const establishmentId = estResult.rows[0].id;

    const isPool = serviceType === 'pileta';

    // Para carpas/sombrillas/estacionamiento, no permitimos solapamientos por recurso
    if (!isPool) {
      const overlapResult = await pool.query(
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

    // Para pases de pileta, siempre debe haber un cliente asociado
    if (isPool && !clientIdParsed) {
      return res.status(400).json({ error: 'pool_client_required' });
    }

    const groupInsert = await pool.query(
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

    // Ya no insertamos en tabla reservations - trabajamos solo con reservation_groups

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
    res.status(500).json({ error: 'server_error' });
  }
});

app.patch('/api/reservation-groups/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const groupId = Number.parseInt(req.params.id, 10);

    if (!groupId || Number.isNaN(groupId) || groupId <= 0) {
      return res.status(400).json({ error: 'invalid_id' });
    }

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
      poolChildPricePerDay,
      resourceNumber,
      startDate,
      endDate
    } = req.body;

    const allowedStatus = ['active', 'cancelled'];

    if (status !== undefined && status !== null && !allowedStatus.includes(status)) {
      return res.status(400).json({ error: 'invalid_status' });
    }

    const estResult = await pool.query(
      'SELECT id FROM establishments WHERE user_id = $1',
      [userId]
    );

    if (estResult.rows.length === 0) {
      return res.status(404).json({ error: 'establishment_not_found' });
    }

    const establishmentId = estResult.rows[0].id;

    const existingResult = await pool.query(
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
    let nextTotalPrice =
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

    // Manejar cambio de resourceNumber o fechas
    let nextResourceNumber = current.resource_number;
    let nextStartDate = startDate !== undefined ? startDate : current.start_date;
    let nextEndDate = endDate !== undefined ? endDate : current.end_date;

    const resourceChanged = resourceNumber !== undefined && resourceNumber !== null && resourceNumber !== current.resource_number;
    const startDateChanged = startDate !== undefined && startDate !== current.start_date;
    const endDateChanged = endDate !== undefined && endDate !== current.end_date;

    if (resourceChanged || startDateChanged || endDateChanged) {
      const finalResourceNumber = resourceNumber !== undefined && resourceNumber !== null ? resourceNumber : current.resource_number;
      const finalStartDate = startDate !== undefined ? startDate : current.start_date;
      const finalEndDate = endDate !== undefined ? endDate : current.end_date;

      // Verificar que no haya conflicto con otra reserva
      const conflictCheck = await pool.query(
        `SELECT id FROM reservation_groups
         WHERE establishment_id = $1
         AND service_type = $2
         AND resource_number = $3
         AND status = 'active'
         AND id != $4
         AND start_date <= $5
         AND end_date >= $6`,
        [
          establishmentId,
          current.service_type,
          finalResourceNumber,
          groupId,
          finalEndDate,
          finalStartDate
        ]
      );

      if (conflictCheck.rows.length > 0) {
        return res.status(409).json({
          error: 'resource_conflict',
          message: 'La unidad seleccionada ya está ocupada en ese rango de fechas'
        });
      }

      nextResourceNumber = finalResourceNumber;
      nextStartDate = finalStartDate;
      nextEndDate = finalEndDate;

      // Recalcular el precio total si cambiaron las fechas y hay un precio por día
      if ((startDateChanged || endDateChanged) && nextDailyPrice !== null && nextDailyPrice > 0) {
        // Normalizar fechas a solo año-mes-día para evitar problemas de timezone
        const normalizeDate = (d) => {
          if (d instanceof Date) {
            return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
          }
          // Si es string "2026-01-10", parsear manualmente
          const parts = String(d).split('-');
          return new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
        };
        const startForCalc = normalizeDate(nextStartDate);
        const endForCalc = normalizeDate(nextEndDate);
        const msPerDay = 24 * 60 * 60 * 1000;
        let daysCount = Math.round((endForCalc - startForCalc) / msPerDay) + 1;
        if (!Number.isFinite(daysCount) || daysCount <= 0) {
          daysCount = 1;
        }
        nextTotalPrice = nextDailyPrice * daysCount;
      }
    }

    const updateResult = await pool.query(
      'UPDATE reservation_groups SET customer_name = $1, customer_phone = $2, daily_price = $3, total_price = $4, notes = $5, status = $6, client_id = $7, pool_adults_count = $8, pool_children_count = $9, pool_adult_price_per_day = $10, pool_child_price_per_day = $11, resource_number = $12, start_date = $13, end_date = $14, updated_at = NOW() WHERE id = $15 RETURNING id, service_type, resource_number, start_date, end_date, customer_name, customer_phone, daily_price, total_price, notes, status, client_id, pool_adults_count, pool_children_count, pool_adult_price_per_day, pool_child_price_per_day',
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
        nextResourceNumber,
        nextStartDate,
        nextEndDate,
        groupId
      ]
    );

    const updatedRow = updateResult.rows[0];

    // Ya no eliminamos de tabla reservations - solo actualizamos status en reservation_groups

    return res.json({
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
    res.status(500).json({ error: 'server_error' });
  }
});

// Endpoint para obtener pagos agregados (dashboard, reportes)
// IMPORTANTE: Este endpoint debe estar ANTES de /api/reservation-groups/:id/payments
app.get('/api/reservation-groups/payments', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit, from, to } = req.query;

    const estResult = await pool.query(
      'SELECT id FROM establishments WHERE user_id = $1',
      [userId]
    );

    if (estResult.rows.length === 0) {
      return res.status(404).json({ error: 'establishment_not_found' });
    }

    const establishmentId = estResult.rows[0].id;

    let query = `
      SELECT
        p.id,
        p.amount,
        p.payment_date,
        p.method AS payment_method,
        p.notes,
        p.created_at,
        rg.id AS reservation_group_id,
        rg.service_type,
        rg.resource_number,
        rg.customer_name
      FROM reservation_payments p
      JOIN reservation_groups rg ON rg.id = p.reservation_group_id
      WHERE p.establishment_id = $1`;

    const params = [establishmentId];

    // Filtro por rango de fechas
    if (from) {
      query += ` AND p.payment_date >= $${params.length + 1}`;
      params.push(from);
    }
    if (to) {
      query += ` AND p.payment_date <= $${params.length + 1}`;
      params.push(to);
    }

    query += ` ORDER BY p.created_at DESC`;

    // Límite de resultados
    if (limit) {
      const limitNum = Number.parseInt(limit, 10);
      if (!Number.isNaN(limitNum) && limitNum > 0) {
        query += ` LIMIT $${params.length + 1}`;
        params.push(limitNum);
      }
    }

    const result = await pool.query(query, params);

    return res.json({
      payments: result.rows.map((row) => ({
        id: row.id,
        amount: row.amount,
        paymentDate: row.payment_date instanceof Date
          ? row.payment_date.toISOString().slice(0, 10)
          : row.payment_date,
        method: row.payment_method,
        notes: row.notes,
        createdAt: row.created_at,
        groupId: row.reservation_group_id,
        serviceType: row.service_type,
        resourceNumber: row.resource_number,
        customerName: row.customer_name
      }))
    });
  } catch (error) {
    console.error('Error fetching aggregated payments:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/reservation-groups/:id/payments', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const groupId = Number.parseInt(req.params.id, 10);

    if (!groupId || Number.isNaN(groupId) || groupId <= 0) {
      return res.status(400).json({ error: 'invalid_id' });
    }

    const estResult = await pool.query(
      'SELECT id FROM establishments WHERE user_id = $1',
      [userId]
    );

    if (estResult.rows.length === 0) {
      return res.status(404).json({ error: 'establishment_not_found' });
    }

    const establishmentId = estResult.rows[0].id;

    const groupResult = await pool.query(
      'SELECT id, client_id FROM reservation_groups WHERE id = $1 AND establishment_id = $2',
      [groupId, establishmentId]
    );

    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: 'not_found' });
    }

    const paymentsResult = await pool.query(
      'SELECT id, amount, payment_date, method, notes, client_id FROM reservation_payments WHERE establishment_id = $1 AND reservation_group_id = $2 ORDER BY payment_date ASC, id ASC',
      [establishmentId, groupId]
    );

    return res.json({
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
    res.status(500).json({ error: 'server_error' });
  }
});

app.post('/api/reservation-groups/:id/payments', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const groupId = Number.parseInt(req.params.id, 10);

    if (!groupId || Number.isNaN(groupId) || groupId <= 0) {
      return res.status(400).json({ error: 'invalid_id' });
    }

    const { amount, paymentDate, method, notes } = req.body;

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

    const estResult = await pool.query(
      'SELECT id FROM establishments WHERE user_id = $1',
      [userId]
    );

    if (estResult.rows.length === 0) {
      return res.status(404).json({ error: 'establishment_not_found' });
    }

    const establishmentId = estResult.rows[0].id;

    const groupResult = await pool.query(
      'SELECT id, client_id FROM reservation_groups WHERE id = $1 AND establishment_id = $2',
      [groupId, establishmentId]
    );

    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: 'not_found' });
    }

    const groupRow = groupResult.rows[0];

    const insertResult = await pool.query(
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
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/reports/payments', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { from, to, service, method } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'missing_date_range' });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return res.status(400).json({ error: 'invalid_date_range' });
    }

    const estResult = await pool.query(
      'SELECT id FROM establishments WHERE user_id = $1',
      [userId]
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

    const result = await pool.query(query, params);

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

    return res.json({
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
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/reports/occupancy', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { from, to, service } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'missing_date_range' });
    }

    const parseDateOnly = (str) => {
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
    };

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

    const estResult = await pool.query(
      'SELECT id, has_parking, has_carpas, has_sombrillas, has_pileta, parking_capacity, carpas_capacity, sombrillas_capacity, pool_max_occupancy FROM establishments WHERE user_id = $1',
      [userId]
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
      return res.json({
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

    const groupsResult = await pool.query(query, params);

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

    return res.json({
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
    res.status(500).json({ error: 'server_error' });
  }
});

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});
