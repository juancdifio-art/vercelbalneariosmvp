const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ============= DB Utilities =============
// Para serverless, no mantener pool global sino crear conexiones efímeras
function createPool() {
  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 1,
      min: 0,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 30000,
      allowExitOnIdle: true
    });
  }
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'balnearios_mvp',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 1,
    min: 0,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 30000,
    allowExitOnIdle: true
  });
}

const db = {
  query: async (text, params) => {
    const pool = createPool();
    try {
      const result = await pool.query(text, params);
      return result;
    } finally {
      await pool.end();
    }
  }
};

// ============= Auth Utilities =============
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

function signToken(user) {
  const payload = { userId: user.id, email: user.email };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

function authenticateToken(req, res) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'missing_token' }));
    return null;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return {
      id: payload.userId,
      email: payload.email
    };
  } catch (err) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'invalid_token' }));
    return null;
  }
}

// ============= CORS Utilities =============
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:9001'
].filter(Boolean);

function handleCors(req, res) {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return true;
  }

  return false;
}

// ============= Helper Functions =============
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

// ============= Main Handler =============
module.exports = async (req, res) => {
  try {
    // Handle CORS
    if (handleCors(req, res)) {
      return;
    }

    const originalUrl = req.url || '/';
    const url = new URL(originalUrl, 'http://localhost');

    const routeParam = url.searchParams.get('route') || '';
    url.searchParams.delete('route');
    const remainingQuery = url.searchParams.toString();

    const normalizedRoute = routeParam.replace(/^\/+/, '').replace(/\/+$/, '');
    const path = normalizedRoute ? `/api/${normalizedRoute}` : '/api';
    req.url = remainingQuery ? `${path}?${remainingQuery}` : path;

    const segments = path.split('?')[0].split('/').filter(Boolean);
    const first = segments[1] || '';
    const second = segments[2] || '';
    const method = (req.method || 'GET').toUpperCase();

    if (!first) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'not_found' }));
    }

    // ============= /api/debug =============
    if (first === 'debug') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({
        success: true,
        env: {
          hasDatabaseUrl: !!process.env.DATABASE_URL,
          hasJwtSecret: !!process.env.JWT_SECRET,
          nodeEnv: process.env.NODE_ENV
        },
        request: {
          method: req.method,
          url: req.url
        }
      }));
    }

    // ============= /api/health =============
    if (first === 'health') {
      if (method !== 'GET') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'method_not_allowed' }));
      }
      try {
        await db.query('SELECT 1');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ status: 'ok' }));
      } catch (error) {
        console.error('DB healthcheck error:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'database_error' }));
      }
    }

    // ============= /api/auth/login =============
    if (first === 'auth' && second === 'login') {
      if (method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'method_not_allowed' }));
      }

      try {
        const { email, password } = await parseJsonBody(req);

        if (!email || !password) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'missing_fields' }));
        }

        const result = await db.query(
          'SELECT id, email, password_hash FROM users WHERE email = $1',
          [email]
        );

        if (result.rows.length === 0) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'invalid_credentials' }));
        }

        const user = result.rows[0];
        const passwordMatches = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatches) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'invalid_credentials' }));
        }

        const token = signToken({ id: user.id, email: user.email });

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({
          token,
          user: {
            id: user.id,
            email: user.email
          }
        }));
      } catch (error) {
        console.error('Error in /api/auth/login:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'server_error' }));
      }
    }

    // ============= /api/establishment (POST) =============
    if (first === 'establishment' && !second && method === 'POST') {
      const user = authenticateToken(req, res);
      if (!user) return;

      try {
        const body = await parseJsonBody(req);
        const { name, hasParking, hasCarpas, hasSombrillas, hasPileta, parkingCapacity, carpasCapacity, sombrillasCapacity, poolMaxOccupancy } = body;

        if (!name || typeof name !== 'string') {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'invalid_name' }));
        }

        const estResult = await db.query('SELECT id FROM establishments WHERE user_id = $1', [user.id]);

        const parkingCap = (parkingCapacity === null || parkingCapacity === undefined || parkingCapacity === '') ? null : parseInt(parkingCapacity, 10);
        const carpasCap = (carpasCapacity === null || carpasCapacity === undefined || carpasCapacity === '') ? null : parseInt(carpasCapacity, 10);
        const sombrillasCap = (sombrillasCapacity === null || sombrillasCapacity === undefined || sombrillasCapacity === '') ? null : parseInt(sombrillasCapacity, 10);
        const poolCap = (poolMaxOccupancy === null || poolMaxOccupancy === undefined || poolMaxOccupancy === '') ? null : parseInt(poolMaxOccupancy, 10);

        let result;
        if (estResult.rows.length === 0) {
          result = await db.query(
            'INSERT INTO establishments (user_id, name, has_parking, has_carpas, has_sombrillas, has_pileta, parking_capacity, carpas_capacity, sombrillas_capacity, pool_max_occupancy) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
            [user.id, name, Boolean(hasParking), Boolean(hasCarpas), Boolean(hasSombrillas), Boolean(hasPileta), parkingCap, carpasCap, sombrillasCap, poolCap]
          );
        } else {
          result = await db.query(
            'UPDATE establishments SET name = $1, has_parking = $2, has_carpas = $3, has_sombrillas = $4, has_pileta = $5, parking_capacity = $6, carpas_capacity = $7, sombrillas_capacity = $8, pool_max_occupancy = $9 WHERE user_id = $10 RETURNING *',
            [name, Boolean(hasParking), Boolean(hasCarpas), Boolean(hasSombrillas), Boolean(hasPileta), parkingCap, carpasCap, sombrillasCap, poolCap, user.id]
          );
        }

        const row = result.rows[0];
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({
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
        }));
      } catch (error) {
        console.error('Error saving establishment:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'server_error' }));
      }
    }

    // ============= /api/establishment/me (GET) =============
    if (first === 'establishment' && second === 'me' && method === 'GET') {
      const user = authenticateToken(req, res);
      if (!user) return;

      try {
        const result = await db.query(
          'SELECT * FROM establishments WHERE user_id = $1',
          [user.id]
        );

        if (result.rows.length === 0) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'not_found' }));
        }

        const row = result.rows[0];
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({
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
        }));
      } catch (error) {
        console.error('Error fetching establishment:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'server_error' }));
      }
    }

    // ============= /api/clients/:id (PATCH/DELETE) =============
    if (first === 'clients' && second && second !== 'undefined') {
      const user = authenticateToken(req, res);
      if (!user) return;

      const clientId = parseInt(second, 10);
      if (isNaN(clientId) || clientId <= 0) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'invalid_id' }));
      }

      try {
        const estResult = await db.query('SELECT id FROM establishments WHERE user_id = $1', [user.id]);
        if (estResult.rows.length === 0) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'establishment_not_found' }));
        }

        const establishmentId = estResult.rows[0].id;

        if (method === 'PATCH') {
          const body = await parseJsonBody(req);
          const { fullName, phone, email, notes, documentNumber, birthDate, nationality, addressStreet, addressNeighborhood, addressPostalCode, addressCity, addressState, addressCountry, vehicleBrand, vehicleModel, vehiclePlate } = body;

          const existingResult = await db.query('SELECT * FROM clients WHERE id = $1 AND establishment_id = $2', [clientId, establishmentId]);
          if (existingResult.rows.length === 0) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'not_found' }));
          }

          const current = existingResult.rows[0];
          const nextFullName = fullName !== undefined ? fullName : current.full_name;

          if (!nextFullName || !nextFullName.trim()) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'invalid_full_name' }));
          }

          const updateResult = await db.query(
            `UPDATE clients SET full_name = $1, phone = $2, email = $3, notes = $4, document_number = $5, birth_date = $6, nationality = $7, address_street = $8, address_neighborhood = $9, address_postal_code = $10, address_city = $11, address_state = $12, address_country = $13, vehicle_brand = $14, vehicle_model = $15, vehicle_plate = $16, updated_at = NOW() WHERE id = $17 RETURNING *`,
            [nextFullName.trim(), phone !== undefined ? phone : current.phone, email !== undefined ? email : current.email, notes !== undefined ? notes : current.notes, documentNumber !== undefined ? documentNumber : current.document_number, birthDate !== undefined ? birthDate : current.birth_date, nationality !== undefined ? nationality : current.nationality, addressStreet !== undefined ? addressStreet : current.address_street, addressNeighborhood !== undefined ? addressNeighborhood : current.address_neighborhood, addressPostalCode !== undefined ? addressPostalCode : current.address_postal_code, addressCity !== undefined ? addressCity : current.address_city, addressState !== undefined ? addressState : current.address_state, addressCountry !== undefined ? addressCountry : current.address_country, vehicleBrand !== undefined ? vehicleBrand : current.vehicle_brand, vehicleModel !== undefined ? vehicleModel : current.vehicle_model, vehiclePlate !== undefined ? vehiclePlate : current.vehicle_plate, clientId]
          );

          const row = updateResult.rows[0];
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({
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
          }));
        }

        if (method === 'DELETE') {
          const deleteResult = await db.query('DELETE FROM clients WHERE id = $1 AND establishment_id = $2 RETURNING id', [clientId, establishmentId]);
          if (deleteResult.rows.length === 0) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'not_found' }));
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ status: 'deleted' }));
        }
      } catch (error) {
        console.error('Error with client by ID:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'server_error' }));
      }
    }

    // ============= /api/clients (GET/POST) =============
    if (first === 'clients' && !second) {
      const user = authenticateToken(req, res);
      if (!user) return;

      try {
        const estResult = await db.query('SELECT id FROM establishments WHERE user_id = $1', [user.id]);
        if (estResult.rows.length === 0) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'establishment_not_found' }));
        }

        const establishmentId = estResult.rows[0].id;

        if (method === 'GET') {
          const result = await db.query(
            'SELECT * FROM clients WHERE establishment_id = $1 ORDER BY full_name ASC',
            [establishmentId]
          );

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({
            clients: result.rows.map(row => ({
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
          }));
        }

        if (method === 'POST') {
          const body = await parseJsonBody(req);
          const { fullName, phone, email, notes, documentNumber, birthDate, nationality, addressStreet, addressNeighborhood, addressPostalCode, addressCity, addressState, addressCountry, vehicleBrand, vehicleModel, vehiclePlate } = body;

          if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'invalid_full_name' }));
          }

          const insertResult = await db.query(
            `INSERT INTO clients (establishment_id, full_name, phone, email, notes, document_number, birth_date, nationality, address_street, address_neighborhood, address_postal_code, address_city, address_state, address_country, vehicle_brand, vehicle_model, vehicle_plate) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`,
            [establishmentId, fullName.trim(), phone || null, email || null, notes || null, documentNumber || null, birthDate || null, nationality || null, addressStreet || null, addressNeighborhood || null, addressPostalCode || null, addressCity || null, addressState || null, addressCountry || null, vehicleBrand || null, vehicleModel || null, vehiclePlate || null]
          );

          const row = insertResult.rows[0];
          res.statusCode = 201;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({
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
          }));
        }
      } catch (error) {
        console.error('Error with clients:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'server_error' }));
      }
    }

    // ============= /api/reservations (GET) =============
    if (first === 'reservations' && !second && method === 'GET') {
      const user = authenticateToken(req, res);
      if (!user) return;

      try {
        const url = new URL(req.url, 'http://localhost');
        const service = url.searchParams.get('service');
        const from = url.searchParams.get('from');
        const to = url.searchParams.get('to');

        const allowedServices = ['carpa', 'sombrilla', 'parking'];

        if (!service || !allowedServices.includes(service)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'invalid_service' }));
        }

        if (!from || !to) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'missing_dates' }));
        }

        const fromDate = new Date(from);
        const toDate = new Date(to);

        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'invalid_dates' }));
        }

        const estResult = await db.query('SELECT id FROM establishments WHERE user_id = $1', [user.id]);
        if (estResult.rows.length === 0) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'establishment_not_found' }));
        }

        const establishmentId = estResult.rows[0].id;

        const result = await db.query(
          `SELECT id, service_type, resource_number, start_date, end_date, status FROM reservation_groups WHERE establishment_id = $1 AND service_type = $2 AND status = 'active' AND NOT (end_date < $3::date OR start_date > $4::date) ORDER BY start_date, resource_number`,
          [establishmentId, service, from, to]
        );

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({
          reservations: result.rows.map(row => ({
            id: row.id,
            serviceType: row.service_type,
            resourceNumber: row.resource_number,
            startDate: row.start_date instanceof Date ? row.start_date.toISOString().slice(0, 10) : row.start_date,
            endDate: row.end_date instanceof Date ? row.end_date.toISOString().slice(0, 10) : row.end_date
          }))
        }));
      } catch (error) {
        console.error('Error fetching reservations:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'server_error' }));
      }
    }

    // ============= /api/reservation-groups (GET) =============
    if (first === 'reservation-groups' && !second && method === 'GET') {
      const user = authenticateToken(req, res);
      if (!user) return;

      try {
        const url = new URL(req.url, 'http://localhost');
        const status = url.searchParams.get('status');

        const estResult = await db.query('SELECT id FROM establishments WHERE user_id = $1', [user.id]);
        if (estResult.rows.length === 0) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'establishment_not_found' }));
        }

        const establishmentId = estResult.rows[0].id;
        let query = `SELECT rg.*, COALESCE(SUM(rp.amount), 0) AS paid_amount FROM reservation_groups rg LEFT JOIN reservation_payments rp ON rp.establishment_id = rg.establishment_id AND rp.reservation_group_id = rg.id WHERE rg.establishment_id = $1`;
        const params = [establishmentId];

        if (status) {
          query += ` AND rg.status = $2`;
          params.push(status);
        }

        query += ' GROUP BY rg.id ORDER BY rg.start_date ASC';

        const result = await db.query(query, params);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({
          reservationGroups: result.rows.map(row => ({
            id: row.id,
            serviceType: row.service_type,
            resourceNumber: row.resource_number,
            startDate: row.start_date instanceof Date ? row.start_date.toISOString().slice(0, 10) : row.start_date,
            endDate: row.end_date instanceof Date ? row.end_date.toISOString().slice(0, 10) : row.end_date,
            customerName: row.customer_name,
            customerPhone: row.customer_phone,
            dailyPrice: row.daily_price,
            totalPrice: row.total_price,
            notes: row.notes,
            status: row.status,
            clientId: row.client_id,
            adultsCount: row.adults_count || 0,
            childrenCount: row.children_count || 0,
            paidAmount: Number(row.paid_amount || 0)
          }))
        }));
      } catch (error) {
        console.error('Error fetching reservation groups:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'server_error' }));
      }
    }

    // ============= /api/reservation-groups (POST) =============
    if (first === 'reservation-groups' && !second && method === 'POST') {
      const user = authenticateToken(req, res);
      if (!user) return;

      try {
        const body = await parseJsonBody(req);
        const { serviceType, resourceNumber, startDate, endDate, customerName, customerPhone, dailyPrice, totalPrice, notes, clientId, adultsCount, childrenCount } = body;

        // Validate required fields
        if (!serviceType || !resourceNumber || !startDate || !endDate || !customerName) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'missing_required_fields' }));
        }

        // Validate service type
        const allowedServices = ['carpa', 'sombrilla', 'parking', 'pileta'];
        if (!allowedServices.includes(serviceType)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'invalid_service_type' }));
        }

        // Validate dates
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'invalid_dates' }));
        }

        if (start > end) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'start_date_after_end_date' }));
        }

        const estResult = await db.query('SELECT id FROM establishments WHERE user_id = $1', [user.id]);
        if (estResult.rows.length === 0) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'establishment_not_found' }));
        }

        const establishmentId = estResult.rows[0].id;

        // Check for overlapping reservations
        const overlapCheck = await db.query(
          `SELECT id FROM reservation_groups WHERE establishment_id = $1 AND service_type = $2 AND resource_number = $3 AND status = 'active' AND NOT (end_date < $4::date OR start_date > $5::date)`,
          [establishmentId, serviceType, resourceNumber, startDate, endDate]
        );

        if (overlapCheck.rows.length > 0) {
          res.statusCode = 409;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'reservation_conflict' }));
        }

        // Insert reservation group
        const insertResult = await db.query(
          `INSERT INTO reservation_groups (establishment_id, service_type, resource_number, start_date, end_date, customer_name, customer_phone, daily_price, total_price, notes, status, client_id, adults_count, children_count) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
          [establishmentId, serviceType, resourceNumber, startDate, endDate, customerName, customerPhone || null, dailyPrice || null, totalPrice || null, notes || null, 'active', clientId || null, adultsCount || 0, childrenCount || 0]
        );

        const row = insertResult.rows[0];
        res.statusCode = 201;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({
          reservationGroup: {
            id: row.id,
            serviceType: row.service_type,
            resourceNumber: row.resource_number,
            startDate: row.start_date instanceof Date ? row.start_date.toISOString().slice(0, 10) : row.start_date,
            endDate: row.end_date instanceof Date ? row.end_date.toISOString().slice(0, 10) : row.end_date,
            customerName: row.customer_name,
            customerPhone: row.customer_phone,
            dailyPrice: row.daily_price,
            totalPrice: row.total_price,
            notes: row.notes,
            status: row.status,
            clientId: row.client_id,
            adultsCount: row.adults_count || 0,
            childrenCount: row.children_count || 0,
            createdAt: row.created_at
          }
        }));
      } catch (error) {
        console.error('Error creating reservation group:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'server_error' }));
      }
    }

    // ============= /api/reservation-groups/:id (PATCH) =============
    if (first === 'reservation-groups' && second && !segments[3] && method === 'PATCH') {
      const user = authenticateToken(req, res);
      if (!user) return;

      const reservationGroupId = parseInt(second, 10);
      if (isNaN(reservationGroupId) || reservationGroupId <= 0) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'invalid_id' }));
      }

      try {
        const estResult = await db.query('SELECT id FROM establishments WHERE user_id = $1', [user.id]);
        if (estResult.rows.length === 0) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'establishment_not_found' }));
        }

        const establishmentId = estResult.rows[0].id;

        // Verify reservation group belongs to this establishment
        const existingResult = await db.query(
          'SELECT * FROM reservation_groups WHERE id = $1 AND establishment_id = $2',
          [reservationGroupId, establishmentId]
        );

        if (existingResult.rows.length === 0) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'reservation_group_not_found' }));
        }

        const current = existingResult.rows[0];
        const body = await parseJsonBody(req);

        // Allow updating status to cancelled
        if (body.status === 'cancelled') {
          const updateResult = await db.query(
            'UPDATE reservation_groups SET status = $1 WHERE id = $2 RETURNING *',
            ['cancelled', reservationGroupId]
          );

          const row = updateResult.rows[0];
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({
            reservationGroup: {
              id: row.id,
              status: row.status
            }
          }));
        }

        // Update other fields
        const { customerName, customerPhone, dailyPrice, totalPrice, notes, adultsCount, childrenCount } = body;

        const updateResult = await db.query(
          `UPDATE reservation_groups SET customer_name = $1, customer_phone = $2, daily_price = $3, total_price = $4, notes = $5, adults_count = $6, children_count = $7 WHERE id = $8 RETURNING *`,
          [
            customerName !== undefined ? customerName : current.customer_name,
            customerPhone !== undefined ? customerPhone : current.customer_phone,
            dailyPrice !== undefined ? dailyPrice : current.daily_price,
            totalPrice !== undefined ? totalPrice : current.total_price,
            notes !== undefined ? notes : current.notes,
            adultsCount !== undefined ? adultsCount : current.adults_count,
            childrenCount !== undefined ? childrenCount : current.children_count,
            reservationGroupId
          ]
        );

        const row = updateResult.rows[0];
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({
          reservationGroup: {
            id: row.id,
            serviceType: row.service_type,
            resourceNumber: row.resource_number,
            startDate: row.start_date instanceof Date ? row.start_date.toISOString().slice(0, 10) : row.start_date,
            endDate: row.end_date instanceof Date ? row.end_date.toISOString().slice(0, 10) : row.end_date,
            customerName: row.customer_name,
            customerPhone: row.customer_phone,
            dailyPrice: row.daily_price,
            totalPrice: row.total_price,
            notes: row.notes,
            status: row.status,
            clientId: row.client_id,
            adultsCount: row.adults_count || 0,
            childrenCount: row.children_count || 0
          }
        }));
      } catch (error) {
        console.error('Error updating reservation group:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'server_error' }));
      }
    }

    // ============= /api/reservation-groups/:id/payments (GET) =============
    if (first === 'reservation-groups' && second && segments[3] === 'payments' && method === 'GET') {
      const user = authenticateToken(req, res);
      if (!user) return;

      const reservationGroupId = parseInt(second, 10);
      if (isNaN(reservationGroupId) || reservationGroupId <= 0) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'invalid_id' }));
      }

      try {
        const estResult = await db.query('SELECT id FROM establishments WHERE user_id = $1', [user.id]);
        if (estResult.rows.length === 0) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'establishment_not_found' }));
        }

        const establishmentId = estResult.rows[0].id;

        // Verify reservation group belongs to this establishment
        const rgCheck = await db.query(
          'SELECT id FROM reservation_groups WHERE id = $1 AND establishment_id = $2',
          [reservationGroupId, establishmentId]
        );

        if (rgCheck.rows.length === 0) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'reservation_group_not_found' }));
        }

        // Get payments
        const result = await db.query(
          'SELECT * FROM reservation_payments WHERE establishment_id = $1 AND reservation_group_id = $2 ORDER BY payment_date DESC',
          [establishmentId, reservationGroupId]
        );

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({
          payments: result.rows.map(row => ({
            id: row.id,
            amount: row.amount,
            paymentDate: row.payment_date,
            paymentMethod: row.payment_method,
            notes: row.notes,
            createdAt: row.created_at
          }))
        }));
      } catch (error) {
        console.error('Error fetching payments:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'server_error' }));
      }
    }

    // Default: not found
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'not_found' }));
  } catch (error) {
    console.error('Error in unified /api router:', error);
    try {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'server_error', message: error.message }));
    } catch (innerError) {
      // ignore
    }
  }
};
