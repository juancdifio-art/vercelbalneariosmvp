const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const reportPaymentsHandler = require('./_handlers/reports/payments');
const reportOccupancyHandler = require('./_handlers/reports/occupancy');
const tarifas = require('./_tarifas/servicio');
const incluidos = require('./_incluidos/servicio');
const reglasIncluidos = require('./_incluidos/reglas');
const { enTransaccion } = require('./_incluidos/transaccion');
const soporte = require('./_soporte/servicio');
const cuentas = require('./_cuentas/servicio');
const contrato = require('./_contrato/servicio');

// Patente en mayusculas y sin espacios ni guiones: "ab 123-cd" -> "AB123CD".
// Es obligatoria en toda reserva de estacionamiento.
function normalizarPatente(valor) {
  return String(valor ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

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

// Transaccion con un cliente propio: db.query abre y cierra un pool por
// consulta, asi que dos db.query seguidos no comparten transaccion.
async function conTransaccion(fn) {
  const pool = createPool();
  const client = await pool.connect();
  try {
    return await enTransaccion(client, fn);
  } finally {
    client.release();
    await pool.end();
  }
}

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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
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

// Una fila de reservation_guests como la devuelve la API.
function mapGuest(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    documentNumber: row.document_number,
    age: row.age,
    birthDate: row.birth_date,
    createdAt: row.created_at
  };
}

function responder(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify(body));
}

// Un error de _incluidos ({ status, error, message }) como respuesta.
function responderFalla(res, r) {
  const body = { error: r.error };
  if (r.message) body.message = r.message;
  if (r.personas) body.personas = r.personas;
  if (r.max !== undefined) body.max = r.max;
  if (r.saldo !== undefined) body.saldo = r.saldo;
  return responder(res, r.status || 400, body);
}

// Un pago de reserva. Produccion guarda el medio en `payment_method`; el
// backend local, en `method`. Por eso _incluidos recibe esta funcion.
function insertarPago(query, d) {
  return query(
    'INSERT INTO reservation_payments (establishment_id, reservation_group_id, amount, payment_date, payment_method, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [d.estId, d.reservationGroupId, d.amount, d.paymentDate, d.method, d.notes || null]
  );
}

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Ajustes del establecimiento que usan los servicios incluidos.
function ajustesIncluidos(row) {
  return {
    pasesPiletaPorCarpa: reglasIncluidos.pasesIncluidos(row, 'carpa'),
    pasesPiletaPorSombrilla: reglasIncluidos.pasesIncluidos(row, 'sombrilla'),
    maxPersonasPorUnidad: reglasIncluidos.maxPersonas(row)
  };
}

const enteroONull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) || n < 0 ? null : n;
};

// La edad se escribe a mano en el mostrador: un texto vacio no es cero.
function parseGuestAge(age) {
  if (age === undefined || age === null || age === '') return null;
  const parsed = Number.parseInt(age, 10);
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return parsed;
}

// ============= Main Handler =============
module.exports = async (req, res) => {
  try {
    // Attach Express-like helpers for shared handlers
    if (typeof res.status !== 'function') {
      res.status = (code) => {
        res.statusCode = code;
        return res;
      };
    }
    if (typeof res.json !== 'function') {
      res.json = (data) => {
        if (!res.headersSent) {
          res.setHeader('Content-Type', 'application/json');
        }
        res.end(JSON.stringify(data));
      };
    }

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

    // ============= /api/auth/me =============
    if (first === 'auth' && second === 'me') {
      if (method !== 'GET') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'method_not_allowed' }));
      }

      const auth = authenticateToken(req, res);
      if (!auth) return;

      try {
        const result = await db.query(
          'SELECT id, email, role, created_at FROM users WHERE id = $1',
          [auth.id]
        );

        if (result.rows.length === 0) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'user_not_found' }));
        }

        const row = result.rows[0];
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({
          id: row.id,
          email: row.email,
          role: row.role,
          createdAt: row.created_at
        }));
      } catch (error) {
        console.error('Error in /api/auth/me:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'server_error' }));
      }
    }

    // ============= /api/auth/password =============
    if (first === 'auth' && second === 'password') {
      if (method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'method_not_allowed' }));
      }

      const auth = authenticateToken(req, res);
      if (!auth) return;

      try {
        const { currentPassword, newPassword } = await parseJsonBody(req);

        if (!currentPassword || !newPassword) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'missing_fields' }));
        }

        if (String(newPassword).length < 8) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'password_too_short' }));
        }

        const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [auth.id]);

        if (result.rows.length === 0) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'user_not_found' }));
        }

        const matches = await bcrypt.compare(currentPassword, result.rows[0].password_hash);

        if (!matches) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'invalid_password' }));
        }

        const nextHash = await bcrypt.hash(newPassword, 12);
        await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [nextHash, auth.id]);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ success: true }));
      } catch (error) {
        console.error('Error in /api/auth/password:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'server_error' }));
      }
    }

    // ============= /api/auth/email =============
    if (first === 'auth' && second === 'email') {
      if (method !== 'PATCH') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'method_not_allowed' }));
      }

      const auth = authenticateToken(req, res);
      if (!auth) return;

      try {
        const { newEmail, currentPassword } = await parseJsonBody(req);

        if (!newEmail || !currentPassword) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'missing_fields' }));
        }

        const normalized = String(newEmail).trim().toLowerCase();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'invalid_email' }));
        }

        const userResult = await db.query('SELECT password_hash FROM users WHERE id = $1', [auth.id]);

        if (userResult.rows.length === 0) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'user_not_found' }));
        }

        const matches = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);

        // Se verifica la clave antes de consultar la unicidad para no filtrar
        // que emails existen a alguien que se encontro la sesion abierta.
        if (!matches) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'invalid_password' }));
        }

        const taken = await db.query(
          'SELECT id FROM users WHERE email = $1 AND id <> $2',
          [normalized, auth.id]
        );

        if (taken.rows.length > 0) {
          res.statusCode = 409;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'email_taken' }));
        }

        const updated = await db.query(
          'UPDATE users SET email = $1 WHERE id = $2 RETURNING id, email, role, created_at',
          [normalized, auth.id]
        );

        const row = updated.rows[0];
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({
          id: row.id,
          email: row.email,
          role: row.role,
          createdAt: row.created_at
        }));
      } catch (error) {
        console.error('Error in /api/auth/email:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'server_error' }));
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
          'SELECT id, email, password_hash, role FROM users WHERE email = $1',
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
          // El rol solo decide que pantalla muestra el frontend; cada endpoint
          // lo vuelve a leer de la base.
          user: {
            id: user.id,
            email: user.email,
            role: user.role
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
        // Ajustes de servicios incluidos: si no vienen, quedan como estaban.
        const pasesCarpa = enteroONull(body.pasesPiletaPorCarpa);
        const pasesSombrilla = enteroONull(body.pasesPiletaPorSombrilla);
        const maxPersonas = enteroONull(body.maxPersonasPorUnidad);

        let result;
        if (estResult.rows.length === 0) {
          result = await db.query(
            'INSERT INTO establishments (user_id, name, has_parking, has_carpas, has_sombrillas, has_pileta, parking_capacity, carpas_capacity, sombrillas_capacity, pool_max_occupancy, pases_pileta_por_carpa, pases_pileta_por_sombrilla, max_personas_por_unidad) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, 4), COALESCE($12, 0), COALESCE($13, 6)) RETURNING *',
            [user.id, name, Boolean(hasParking), Boolean(hasCarpas), Boolean(hasSombrillas), Boolean(hasPileta), parkingCap, carpasCap, sombrillasCap, poolCap, pasesCarpa, pasesSombrilla, maxPersonas]
          );
        } else {
          result = await db.query(
            'UPDATE establishments SET name = $1, has_parking = $2, has_carpas = $3, has_sombrillas = $4, has_pileta = $5, parking_capacity = $6, carpas_capacity = $7, sombrillas_capacity = $8, pool_max_occupancy = $9, pases_pileta_por_carpa = COALESCE($11, pases_pileta_por_carpa), pases_pileta_por_sombrilla = COALESCE($12, pases_pileta_por_sombrilla), max_personas_por_unidad = COALESCE($13, max_personas_por_unidad) WHERE user_id = $10 RETURNING *',
            [name, Boolean(hasParking), Boolean(hasCarpas), Boolean(hasSombrillas), Boolean(hasPileta), parkingCap, carpasCap, sombrillasCap, poolCap, user.id, pasesCarpa, pasesSombrilla, maxPersonas]
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
            poolMaxOccupancy: row.pool_max_occupancy,
            ...ajustesIncluidos(row)
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
            poolMaxOccupancy: row.pool_max_occupancy,
            ...ajustesIncluidos(row)
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
        const service = url.searchParams.get('service');
        const status = url.searchParams.get('status');
        const from = url.searchParams.get('from');
        const to = url.searchParams.get('to');
        const clientId = url.searchParams.get('clientId');

        const allowedServices = ['carpa', 'sombrilla', 'parking', 'pileta'];
        const allowedStatus = ['active', 'cancelled'];

        const estResult = await db.query('SELECT id FROM establishments WHERE user_id = $1', [user.id]);
        if (estResult.rows.length === 0) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'establishment_not_found' }));
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
            rg.adults_count,
            rg.children_count,
            rg.pool_adult_price_per_day,
            rg.pool_child_price_per_day,
            rg.vehicle_plate,
            rg.precio_tarifa,
            rg.desglose,
            rg.motivo_ajuste,${incluidos.SQL_COLUMNAS_VINCULO}
            c.document_number AS client_document_number,
            COALESCE(SUM(rp.amount), 0) AS paid_amount
          FROM reservation_groups rg
          LEFT JOIN clients c
            ON c.id = rg.client_id${incluidos.SQL_JOIN_PADRE}
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
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'invalid_client_id' }));
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
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'invalid_from' }));
          }
        }

        if (toStr) {
          const toDate = new Date(toStr);
          if (Number.isNaN(toDate.getTime())) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'invalid_to' }));
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
            rg.adults_count,
            rg.children_count,
            rg.pool_adult_price_per_day,
            rg.pool_child_price_per_day,
            rg.vehicle_plate,
            rg.precio_tarifa,
            rg.desglose,
            rg.motivo_ajuste,${incluidos.SQL_GROUP_VINCULO}
            c.document_number
          ORDER BY rg.start_date ASC, rg.resource_number ASC`;

        const result = await db.query(query, params);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({
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
            adultsCount: row.adults_count || 0,
            clientDocumentNumber: row.client_document_number || null,
            childrenCount: row.children_count || 0,
            poolAdultPricePerDay: row.pool_adult_price_per_day,
            poolChildPricePerDay: row.pool_child_price_per_day,
            vehiclePlate: row.vehicle_plate || null,
            precioTarifa: row.precio_tarifa ?? null,
            desglose: row.desglose ?? null,
            motivoAjuste: row.motivo_ajuste ?? null,
            paidAmount: Number(row.paid_amount || 0),
            ...incluidos.mapVinculo(row)
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
        const { serviceType, resourceNumber, startDate, endDate, customerName, customerPhone, notes, clientId, adultsCount, childrenCount, poolAdultPricePerDay, poolChildPricePerDay } = body;
        const vehiclePlate = normalizarPatente(body.vehiclePlate);

        // Validate required fields
        if (!serviceType || !resourceNumber || !startDate || !endDate || !customerName) {
          return responder(res, 400, { error: 'missing_required_fields' });
        }

        if (serviceType === 'parking' && !vehiclePlate) {
          return responder(res, 400, { error: 'vehicle_plate_required' });
        }

        // Validate service type
        const allowedServices = ['carpa', 'sombrilla', 'parking', 'pileta'];
        if (!allowedServices.includes(serviceType)) {
          return responder(res, 400, { error: 'invalid_service_type' });
        }

        // Validate dates
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return responder(res, 400, { error: 'invalid_dates' });
        }

        if (start > end) {
          return responder(res, 400, { error: 'start_date_after_end_date' });
        }

        // Pase de pileta pago y pago de la cuenta: se validan antes de tocar la base.
        const preciosPase = reglasIncluidos.normalizarPasePago(body.pasePago);
        if (preciosPase && preciosPase.error) return responder(res, 400, { error: preciosPase.error });
        const pagoInicial = reglasIncluidos.normalizarPago(body.pagoInicial);
        if (pagoInicial && pagoInicial.error) return responder(res, 400, { error: pagoInicial.error });

        // Los servicios incluidos quedan a nombre de un cliente guardado.
        const pideIncluidos = Boolean(body.incluidos && (body.incluidos.pileta || (Array.isArray(body.incluidos.cocheras) && body.incluidos.cocheras.length)));
        if (pideIncluidos && !clientId) {
          return responder(res, 400, { error: 'client_required' });
        }

        const estResult = await db.query('SELECT * FROM establishments WHERE user_id = $1', [user.id]);
        if (estResult.rows.length === 0) {
          return responder(res, 404, { error: 'establishment_not_found' });
        }

        const est = estResult.rows[0];
        const establishmentId = est.id;

        if (reglasIncluidos.UNIDADES_DE_SOMBRA.includes(serviceType)) {
          const tope = reglasIncluidos.validarTope(est, adultsCount, childrenCount);
          if (tope) return responder(res, 400, { error: tope });
        }

        const pedido = reglasIncluidos.normalizarPedido(body.incluidos, est, serviceType);
        if (pedido.error) return responder(res, 400, { error: pedido.error });

        // Acompanantes cargados en el alta: son de esta reserva. Los datos del
        // titular van a su ficha. El titular cuenta para el tope de personas.
        const personasPedido = reglasIncluidos.UNIDADES_DE_SOMBRA.includes(serviceType)
          ? reglasIncluidos.normalizarPersonas(body.personas, body.titular)
          : null;
        if (personasPedido && personasPedido.personas.length + (clientId ? 1 : 0) > reglasIncluidos.maxPersonas(est)) {
          return responder(res, 400, { error: 'too_many_people', max: reglasIncluidos.maxPersonas(est) });
        }

        // Pase de pileta pago asociado a una carpa (vinculo 'adicional').
        let asociadaA = null;
        if (serviceType === 'pileta' && body.incluidaEnReservaId) {
          const carpa = await incluidos.carpaParaAsociar(db.query, establishmentId, Number.parseInt(body.incluidaEnReservaId, 10));
          if (!carpa) return responder(res, 404, { error: 'carpa_not_found' });
          asociadaA = carpa.id;
        }

        // Igual que el backend local: un pase de pileta siempre queda a nombre
        // de un cliente guardado.
        if (serviceType === 'pileta' && !clientId) {
          return responder(res, 400, { error: 'pool_client_required' });
        }

        const insertar = async (query, precio) => {
          const insertResult = await query(
            `INSERT INTO reservation_groups (establishment_id, service_type, resource_number, start_date, end_date, customer_name, customer_phone, daily_price, total_price, notes, status, client_id, adults_count, children_count, pool_adult_price_per_day, pool_child_price_per_day, vehicle_plate, precio_tarifa, desglose, motivo_ajuste, incluida_en_reserva_id, vinculo) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22) RETURNING *`,
            [establishmentId, serviceType, resourceNumber, startDate, endDate, customerName, customerPhone || null, precio.dailyPrice ?? null, precio.totalPrice ?? null, notes || null, 'active', clientId || null, adultsCount || 0, childrenCount || 0, poolAdultPricePerDay || null, poolChildPricePerDay || null, vehiclePlate || null, precio.precioTarifa, precio.desglose == null ? null : JSON.stringify(precio.desglose), precio.motivoAjuste, asociadaA, asociadaA ? 'adicional' : null]
          );
          return insertResult.rows[0];
        };

        let row;
        let creados = null;
        let pagoCuenta = null;
        if (serviceType === 'pileta') {
          // Pileta no ocupa una unidad ni pasa por tarifas.
          const precio = await tarifas.precioAlCrear(db.query, establishmentId, body);
          row = await insertar(db.query, precio);
        } else {
          // La unidad se bloquea hasta el COMMIT: dos altas simultaneas de la
          // misma unidad no pueden pasar las dos el control de superposicion.
          const r = await conTransaccion(async (query) => {
            await incluidos.bloquearUnidad(query, establishmentId, serviceType, resourceNumber);
            const overlapCheck = await query(
              `SELECT id FROM reservation_groups WHERE establishment_id = $1 AND service_type = $2 AND resource_number = $3 AND status = 'active' AND NOT (end_date < $4::date OR start_date > $5::date)`,
              [establishmentId, serviceType, resourceNumber, startDate, endDate]
            );
            if (overlapCheck.rows.length > 0) {
              return { status: 409, error: 'reservation_conflict', message: 'La unidad seleccionada ya está ocupada en esas fechas.' };
            }

            // El precio lo calcula el servidor con las tarifas; lo que manda el
            // navegador solo cuenta como "cobrado", y si difiere pide motivo.
            const precio = await tarifas.precioAlCrear(query, establishmentId, body);
            if (precio.error) return { status: 400, error: precio.error };

            const creada = await insertar(query, precio);
            let inc = null;
            if (reglasIncluidos.hayIncluidos(pedido) || personasPedido) {
              inc = await incluidos.completarAlta(query, est, creada, pedido, personasPedido, preciosPase);
              if (inc.error) return inc;
            }
            // Un solo pago por toda la cuenta, repartido en orden.
            let pago = null;
            if (pagoInicial) {
              pago = await incluidos.cobrarCuenta(query, establishmentId, creada.id, { ...pagoInicial, fecha: hoyISO() }, insertarPago);
              if (pago.error) return pago;
            }
            return { row: creada, incluidos: inc, pago };
          });
          if (r.error) return responderFalla(res, r);
          row = r.row;
          creados = r.incluidos || null;
          pagoCuenta = r.pago || null;
        }

        return responder(res, 201, {
          status: 'created',
          group: {
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
            poolAdultPricePerDay: row.pool_adult_price_per_day,
            poolChildPricePerDay: row.pool_child_price_per_day,
            vehiclePlate: row.vehicle_plate || null,
            precioTarifa: row.precio_tarifa ?? null,
            desglose: row.desglose ?? null,
            motivoAjuste: row.motivo_ajuste ?? null,
            incluidaEnReservaId: row.incluida_en_reserva_id ?? null,
            vinculo: row.vinculo ?? null,
            paidAmount: (pagoCuenta?.pagos || []).filter((p) => p.reservationGroupId === row.id).reduce((s, p) => s + p.amount, 0),
            createdAt: row.created_at
          },
          incluidos: creados,
          pago: pagoCuenta
        });
      } catch (error) {
        console.error('Error creating reservation group:', error);
        return responder(res, 500, { error: 'server_error' });
      }
    }

    // ============= /api/reservation-groups/:id (PATCH) =============
    if (first === 'reservation-groups' && second && !segments[3] && method === 'PATCH') {
      const user = authenticateToken(req, res);
      if (!user) return;

      const reservationGroupId = parseInt(second, 10);
      if (isNaN(reservationGroupId) || reservationGroupId <= 0) {
        return responder(res, 400, { error: 'invalid_id' });
      }

      try {
        const estResult = await db.query('SELECT * FROM establishments WHERE user_id = $1', [user.id]);
        if (estResult.rows.length === 0) {
          return responder(res, 404, { error: 'establishment_not_found' });
        }

        const est = estResult.rows[0];
        const establishmentId = est.id;

        // Verify reservation group belongs to this establishment
        const existingResult = await db.query(
          'SELECT * FROM reservation_groups WHERE id = $1 AND establishment_id = $2',
          [reservationGroupId, establishmentId]
        );

        if (existingResult.rows.length === 0) {
          return responder(res, 404, { error: 'reservation_group_not_found' });
        }

        const current = existingResult.rows[0];
        const body = await parseJsonBody(req);
        const esUnidadDeSombra = reglasIncluidos.UNIDADES_DE_SOMBRA.includes(current.service_type);

        // Un servicio incluido se maneja desde su carpa.
        const noEditable = reglasIncluidos.validarEdicionIncluido(current, body);
        if (noEditable) {
          return responder(res, 409, { error: noEditable, incluidaEnReservaId: current.incluida_en_reserva_id });
        }

        // Allow updating status to cancelled
        if (body.status === 'cancelled') {
          const r = await conTransaccion(async (query) => {
            const updateResult = await query(
              'UPDATE reservation_groups SET status = $1 WHERE id = $2 RETURNING *',
              ['cancelled', reservationGroupId]
            );
            const sync = esUnidadDeSombra
              ? await incluidos.sincronizarIncluidos(query, establishmentId, updateResult.rows[0], { cancelada: true })
              : { adicionalesAsociados: 0 };
            return { row: updateResult.rows[0], adicionalesAsociados: sync.adicionalesAsociados };
          });

          const row = r.row;
          return responder(res, 200, {
            reservationGroup: {
              id: row.id,
              status: row.status,
              serviceType: row.service_type,
              resourceNumber: row.resource_number,
              startDate: tarifas.fechaISO(row.start_date),
              endDate: tarifas.fechaISO(row.end_date)
            },
            adicionalesAsociados: r.adicionalesAsociados
          });
        }

        // Update other fields
        const { customerName, customerPhone, dailyPrice, totalPrice, notes, adultsCount, childrenCount, poolAdultPricePerDay, poolChildPricePerDay, resourceNumber, startDate, endDate } = body;

        // La patente solo se toca si viene en el body; en estacionamiento no se puede vaciar.
        const finalVehiclePlate = body.vehiclePlate !== undefined
          ? normalizarPatente(body.vehiclePlate) || null
          : current.vehicle_plate;
        if (current.service_type === 'parking' && body.vehiclePlate !== undefined && !finalVehiclePlate) {
          return responder(res, 400, { error: 'vehicle_plate_required' });
        }

        const finalAdults = adultsCount !== undefined ? adultsCount : current.adults_count;
        const finalChildren = childrenCount !== undefined ? childrenCount : current.children_count;
        if (esUnidadDeSombra && (adultsCount !== undefined || childrenCount !== undefined)) {
          const tope = reglasIncluidos.validarTope(est, finalAdults, finalChildren);
          if (tope) return responder(res, 400, { error: tope });
        }

        // Calcular las fechas finales (nuevas o actuales)
        const finalStartDate = startDate !== undefined ? startDate : current.start_date;
        const finalEndDate = endDate !== undefined ? endDate : current.end_date;
        const finalResourceNumber = resourceNumber !== undefined ? resourceNumber : current.resource_number;

        // Si se quiere cambiar el resourceNumber o las fechas, verificar disponibilidad
        const resourceChanged = resourceNumber !== undefined && resourceNumber !== current.resource_number;
        // pg devuelve DATE como Date: comparar el texto contra el objeto daba siempre "cambio".
        const datesChanged = (startDate !== undefined && startDate !== tarifas.fechaISO(current.start_date)) ||
          (endDate !== undefined && endDate !== tarifas.fechaISO(current.end_date));

        const r = await conTransaccion(async (query) => {
          if ((resourceChanged || datesChanged) && current.service_type !== 'pileta') {
            // Bloquear la unidad destino hasta el COMMIT y verificar que siga libre.
            await incluidos.bloquearUnidad(query, establishmentId, current.service_type, finalResourceNumber);
            const conflictCheck = await query(
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
                reservationGroupId,
                finalEndDate,
                finalStartDate
              ]
            );

            if (conflictCheck.rows.length > 0) {
              return { status: 409, error: 'resource_conflict', message: 'La unidad seleccionada ya está ocupada en ese rango de fechas' };
            }
          }

          // Pileta sigue con sus precios por persona; el resto pasa por tarifas.
          let precio = {
            dailyPrice: dailyPrice !== undefined ? dailyPrice : current.daily_price,
            totalPrice: totalPrice !== undefined ? totalPrice : current.total_price,
            precioTarifa: current.precio_tarifa ?? null,
            desglose: current.desglose ?? null,
            motivoAjuste: current.motivo_ajuste ?? null
          };
          if (current.service_type !== 'pileta') {
            precio = await tarifas.precioAlEditar(query, establishmentId, current, body, {
              recalcular: resourceChanged || datesChanged,
              desde: tarifas.fechaISO(finalStartDate),
              hasta: tarifas.fechaISO(finalEndDate),
              resourceNumber: finalResourceNumber
            });
            if (precio.error) return { status: 400, error: precio.error };
          }

          const updateResult = await query(
            `UPDATE reservation_groups SET customer_name = $1, customer_phone = $2, daily_price = $3, total_price = $4, notes = $5, adults_count = $6, children_count = $7, resource_number = $8, start_date = $9, end_date = $10, pool_adult_price_per_day = $11, pool_child_price_per_day = $12, vehicle_plate = $14, precio_tarifa = $15, desglose = $16, motivo_ajuste = $17 WHERE id = $13 RETURNING *`,
            [
              customerName !== undefined ? customerName : current.customer_name,
              customerPhone !== undefined ? customerPhone : current.customer_phone,
              precio.dailyPrice ?? null,
              precio.totalPrice ?? null,
              notes !== undefined ? notes : current.notes,
              finalAdults,
              finalChildren,
              finalResourceNumber,
              finalStartDate,
              finalEndDate,
              poolAdultPricePerDay !== undefined ? poolAdultPricePerDay : current.pool_adult_price_per_day,
              poolChildPricePerDay !== undefined ? poolChildPricePerDay : current.pool_child_price_per_day,
              reservationGroupId,
              finalVehiclePlate,
              precio.precioTarifa,
              precio.desglose == null ? null : JSON.stringify(precio.desglose),
              precio.motivoAjuste
            ]
          );
          const row = updateResult.rows[0];
          if (!esUnidadDeSombra) return { row, adicionalesAsociados: 0, incluidos: null };

          // Los incluidos acompanan a la carpa: mismas fechas.
          const sync = await incluidos.sincronizarIncluidos(query, establishmentId, row, { fechasCambiaron: datesChanged });
          if (sync.error) return sync;
          let cambios = null;
          if (body.incluidos) {
            cambios = await incluidos.modificarIncluidos(query, est, row, body.incluidos);
            if (cambios.error) return cambios;
          }
          return { row, adicionalesAsociados: sync.adicionalesAsociados, incluidos: cambios };
        });
        if (r.error) return responderFalla(res, r);

        const row = r.row;
        return responder(res, 200, {
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
            poolAdultPricePerDay: row.pool_adult_price_per_day,
            poolChildPricePerDay: row.pool_child_price_per_day,
            vehiclePlate: row.vehicle_plate || null,
            precioTarifa: row.precio_tarifa ?? null,
            desglose: row.desglose ?? null,
            motivoAjuste: row.motivo_ajuste ?? null,
            incluidaEnReservaId: row.incluida_en_reserva_id ?? null,
            vinculo: row.vinculo ?? null
          },
          adicionalesAsociados: r.adicionalesAsociados,
          incluidos: r.incluidos
        });
      } catch (error) {
        console.error('Error updating reservation group:', error);
        return responder(res, 500, { error: 'server_error' });
      }
    }

    // ============= /api/reservation-groups/payments (GET) =============
    // Obtener pagos agregados (para dashboard, reportes)
    if (first === 'reservation-groups' && second === 'payments' && !segments[3] && method === 'GET') {
      const user = authenticateToken(req, res);
      if (!user) return;

      try {
        const url = new URL(req.url, 'http://localhost');
        const limit = url.searchParams.get('limit');
        const from = url.searchParams.get('from');
        const to = url.searchParams.get('to');

        const estResult = await db.query('SELECT id FROM establishments WHERE user_id = $1', [user.id]);
        if (estResult.rows.length === 0) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'establishment_not_found' }));
        }

        const establishmentId = estResult.rows[0].id;

        let query = `
          SELECT
            p.id,
            p.amount,
            p.payment_date,
            p.payment_method,
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

        const result = await db.query(query, params);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({
          payments: result.rows.map((row) => ({
            id: row.id,
            amount: row.amount,
            paymentDate: row.payment_date,
            method: row.payment_method,
            notes: row.notes,
            createdAt: row.created_at,
            groupId: row.reservation_group_id,
            serviceType: row.service_type,
            resourceNumber: row.resource_number,
            customerName: row.customer_name
          }))
        }));
      } catch (error) {
        console.error('Error fetching aggregated payments:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'server_error' }));
      }
    }

    // ============= /api/reservation-groups/:id/payments (GET/POST) =============
    if (first === 'reservation-groups' && second && segments[3] === 'payments') {
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

        if (method === 'GET') {
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
        }

        if (method === 'POST') {
          const body = await parseJsonBody(req);
          const { amount, paymentDate, method: paymentMethod, notes } = body;

          if (!amount || !paymentDate || !paymentMethod) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'missing_required_fields' }));
          }

          const insertResult = await db.query(
            'INSERT INTO reservation_payments (establishment_id, reservation_group_id, amount, payment_date, payment_method, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [establishmentId, reservationGroupId, amount, paymentDate, paymentMethod, notes || null]
          );

          const row = insertResult.rows[0];
          res.statusCode = 201;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({
            payment: {
              id: row.id,
              amount: row.amount,
              paymentDate: row.payment_date,
              paymentMethod: row.payment_method,
              notes: row.notes,
              createdAt: row.created_at
            }
          }));
        }
      } catch (error) {
        console.error('Error with payments:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'server_error' }));
      }
    }

    // ============= /api/reservation-groups/:id/pago-cuenta (POST) =============
    // Un pago contra el saldo total de una carpa con todo lo suyo, repartido
    // en orden: la carpa, las cocheras, la pileta paga.
    if (first === 'reservation-groups' && second && segments[3] === 'pago-cuenta' && method === 'POST') {
      const user = authenticateToken(req, res);
      if (!user) return;

      const carpaId = parseInt(second, 10);
      if (isNaN(carpaId) || carpaId <= 0) return responder(res, 400, { error: 'invalid_id' });

      try {
        const body = await parseJsonBody(req);
        const pago = reglasIncluidos.normalizarPago({ monto: body.amount, metodo: body.method });
        if (!pago) return responder(res, 400, { error: 'missing_required_fields' });
        if (pago.error) return responder(res, 400, { error: pago.error });

        const estResult = await db.query('SELECT * FROM establishments WHERE user_id = $1', [user.id]);
        if (estResult.rows.length === 0) return responder(res, 404, { error: 'establishment_not_found' });

        const r = await conTransaccion((query) => incluidos.cobrarCuenta(
          query, estResult.rows[0].id, carpaId,
          { ...pago, fecha: body.paymentDate || hoyISO(), notas: body.notes },
          insertarPago
        ));
        if (r.error) return responderFalla(res, r);
        return responder(res, 201, r);
      } catch (error) {
        console.error('Error cobrando la cuenta:', error);
        return responder(res, 500, { error: 'server_error' });
      }
    }

    // ============= /api/reservation-groups/:id/pase-personas (GET/PUT) =============
    // Personas con pase de pileta. La logica vive en _incluidos/servicio.js.
    if (first === 'reservation-groups' && second && segments[3] === 'pase-personas') {
      const user = authenticateToken(req, res);
      if (!user) return;

      const paseId = parseInt(second, 10);
      if (isNaN(paseId) || paseId <= 0) return responder(res, 400, { error: 'invalid_id' });

      try {
        const estResult = await db.query('SELECT * FROM establishments WHERE user_id = $1', [user.id]);
        if (estResult.rows.length === 0) return responder(res, 404, { error: 'establishment_not_found' });
        const body = method === 'PUT' ? await parseJsonBody(req) : {};
        const r = await conTransaccion((query) => incluidos.rutearPasePersonas(query, estResult.rows[0], paseId, method, body));
        return responder(res, r.status, r.body);
      } catch (error) {
        console.error('Error con las personas del pase:', error);
        return responder(res, 500, { error: 'server_error' });
      }
    }

    // ============= /api/reservation-groups/:id/guests (GET/POST) =============
    // Las personas que ocupan la reserva. Solo el nombre es obligatorio: un
    // dato a medias sirve mas que ninguno.
    if (first === 'reservation-groups' && second && segments[3] === 'guests') {
      const user = authenticateToken(req, res);
      if (!user) return;

      const reservationGroupId = parseInt(second, 10);
      if (isNaN(reservationGroupId) || reservationGroupId <= 0) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'invalid_id' }));
      }

      try {
        const estResult = await db.query('SELECT * FROM establishments WHERE user_id = $1', [user.id]);
        if (estResult.rows.length === 0) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'not_found' }));
        }

        const est = estResult.rows[0];
        const establishmentId = est.id;

        // Junto con la reserva: cuantas personas tiene y su pase incluido, si hay.
        const rgCheck = await db.query(
          `SELECT rg.id, rg.service_type, rg.client_id,
                  (SELECT COUNT(*)::int FROM reservation_guests g WHERE g.reservation_group_id = rg.id) AS personas,
                  (SELECT p.id FROM reservation_groups p
                   WHERE p.incluida_en_reserva_id = rg.id AND p.vinculo = 'incluido' AND p.service_type = 'pileta' AND p.status = 'active'
                   LIMIT 1) AS pase_incluido_id
           FROM reservation_groups rg WHERE rg.id = $1 AND rg.establishment_id = $2`,
          [reservationGroupId, establishmentId]
        );

        if (rgCheck.rows.length === 0) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'not_found' }));
        }

        if (method === 'GET') {
          const result = await db.query(
            'SELECT id, full_name, document_number, age, birth_date, created_at FROM reservation_guests WHERE establishment_id = $1 AND reservation_group_id = $2 ORDER BY id ASC',
            [establishmentId, reservationGroupId]
          );

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ guests: result.rows.map(mapGuest) }));
        }

        if (method === 'POST') {
          const body = await parseJsonBody(req);
          const { fullName, documentNumber, age, birthDate } = body;

          if (!fullName || String(fullName).trim() === '') {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'missing_fields' }));
          }

          const reserva = rgCheck.rows[0];
          // El titular (el cliente de la reserva) es una de las personas: cuenta para el tope.
          const yaCargadas = Number(reserva.personas || 0) + (reserva.client_id ? 1 : 0);
          if (
            reglasIncluidos.UNIDADES_DE_SOMBRA.includes(reserva.service_type) &&
            yaCargadas >= reglasIncluidos.maxPersonas(est)
          ) {
            return responder(res, 400, { error: 'too_many_people', max: reglasIncluidos.maxPersonas(est) });
          }

          const insertResult = await db.query(
            'INSERT INTO reservation_guests (establishment_id, reservation_group_id, full_name, document_number, age, birth_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, full_name, document_number, age, birth_date, created_at',
            [
              establishmentId,
              reservationGroupId,
              String(fullName).trim(),
              documentNumber || null,
              parseGuestAge(age),
              birthDate || null
            ]
          );

          // Si la carpa tiene pileta incluida con lugar y la persona esta completa, se le da pase.
          if (reserva.pase_incluido_id) {
            await conTransaccion((query) => incluidos.autoAsignar(query, est, reservationGroupId, insertResult.rows[0].id));
          }

          res.statusCode = 201;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ guest: mapGuest(insertResult.rows[0]) }));
        }
      } catch (error) {
        console.error('Error with reservation guests:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'server_error' }));
      }
    }

    // ============= /api/reservation-guests/:guestId (PATCH/DELETE) =============
    if (first === 'reservation-guests' && second) {
      const user = authenticateToken(req, res);
      if (!user) return;

      const guestId = parseInt(second, 10);
      if (isNaN(guestId) || guestId <= 0) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'invalid_id' }));
      }

      try {
        const estResult = await db.query('SELECT * FROM establishments WHERE user_id = $1', [user.id]);
        if (estResult.rows.length === 0) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'not_found' }));
        }

        const est = estResult.rows[0];
        const establishmentId = est.id;

        // Con la persona: su reserva y los pases de pileta donde esta.
        const actual = await db.query(
          `SELECT g.id, g.full_name, g.document_number, g.age, g.birth_date, g.reservation_group_id,
                  (SELECT COALESCE(array_agg(pp.pase_id), '{}') FROM pase_pileta_personas pp WHERE pp.guest_id = g.id) AS pases
           FROM reservation_guests g WHERE g.id = $1 AND g.establishment_id = $2`,
          [guestId, establishmentId]
        );

        if (actual.rows.length === 0) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'not_found' }));
        }

        if (method === 'PATCH') {
          const body = await parseJsonBody(req);
          const { fullName, documentNumber, age, birthDate } = body;
          const previo = actual.rows[0];

          // Lo que no viene en el body queda como estaba.
          const nombre =
            fullName !== undefined && String(fullName).trim() !== ''
              ? String(fullName).trim()
              : previo.full_name;

          const updateResult = await db.query(
            'UPDATE reservation_guests SET full_name = $1, document_number = $2, age = $3, birth_date = $4, updated_at = NOW() WHERE id = $5 RETURNING id, full_name, document_number, age, birth_date, created_at',
            [
              nombre,
              documentNumber !== undefined ? documentNumber || null : previo.document_number,
              age !== undefined ? parseGuestAge(age) : previo.age,
              birthDate !== undefined ? birthDate || null : previo.birth_date,
              guestId
            ]
          );

          // La edad puede haber cambiado (adulto o menor) o la persona puede
          // haber quedado completa para tener pase.
          if (previo.reservation_group_id) {
            await conTransaccion(async (query) => {
              await incluidos.recalcularPases(query, establishmentId, previo.pases || []);
              await incluidos.autoAsignar(query, est, previo.reservation_group_id, guestId);
            });
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ guest: mapGuest(updateResult.rows[0]) }));
        }

        if (method === 'DELETE') {
          await db.query('DELETE FROM reservation_guests WHERE id = $1 AND establishment_id = $2', [
            guestId,
            establishmentId
          ]);
          // Su lugar en el pase se libero solo (ON DELETE CASCADE): recalcular el conteo.
          const pases = actual.rows[0].pases || [];
          if (pases.length) {
            await conTransaccion((query) => incluidos.recalcularPases(query, establishmentId, pases));
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ success: true }));
        }
      } catch (error) {
        console.error('Error with reservation guest:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'server_error' }));
      }
    }

    // ============= /api/soporte/* =============
    // Chat de soporte: la logica vive en _soporte/servicio.js, compartida con el backend local.
    if (first === 'soporte') {
      const user = authenticateToken(req, res);
      if (!user) return;

      try {
        const body = method === 'POST' ? await parseJsonBody(req) : {};
        const r = await soporte.rutearSoporte(db.query, user.id, { method, partes: segments.slice(2), body, transaccion: conTransaccion });
        return responder(res, r.status, r.body);
      } catch (error) {
        console.error('Error en soporte:', error);
        return responder(res, 500, { error: 'server_error' });
      }
    }

    // ============= /api/cuentas/* =============
    // Administrador general: la logica vive en _cuentas/servicio.js, compartida con el backend local.
    if (first === 'cuentas') {
      const user = authenticateToken(req, res);
      if (!user) return;

      try {
        const body = method === 'POST' ? await parseJsonBody(req) : {};
        const r = await cuentas.rutearCuentas(db.query, user.id, {
          method,
          partes: segments.slice(2),
          body,
          transaccion: conTransaccion,
          hashear: (clave) => bcrypt.hash(clave, 12)
        });
        return responder(res, r.status, r.body);
      } catch (error) {
        console.error('Error en cuentas:', error);
        return responder(res, 500, { error: 'server_error' });
      }
    }

    // ============= /api/contrato =============
    // Titulo y condiciones del contrato imprimible: la logica vive en _contrato/servicio.js.
    if (first === 'contrato') {
      const user = authenticateToken(req, res);
      if (!user) return;

      try {
        const estResult = await db.query('SELECT id FROM establishments WHERE user_id = $1', [user.id]);
        if (estResult.rows.length === 0) return responder(res, 404, { error: 'establishment_not_found' });
        const body = method === 'PUT' ? await parseJsonBody(req) : {};
        const r = await contrato.rutearContrato(db.query, estResult.rows[0].id, { method, partes: segments.slice(2), body });
        return responder(res, r.status, r.body);
      } catch (error) {
        console.error('Error en contrato:', error);
        return responder(res, 500, { error: 'server_error' });
      }
    }

    // ============= /api/tarifas/* =============
    // Toda la logica vive en _tarifas/servicio.js, compartida con el backend local.
    if (first === 'tarifas') {
      const user = authenticateToken(req, res);
      if (!user) return;

      try {
        const estResult = await db.query('SELECT id FROM establishments WHERE user_id = $1', [user.id]);
        if (estResult.rows.length === 0) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'establishment_not_found' }));
        }
        const body = method === 'POST' || method === 'PATCH' ? await parseJsonBody(req) : {};
        const r = await tarifas.rutearTarifas(db.query, estResult.rows[0].id, {
          method,
          partes: segments.slice(2),
          params: Object.fromEntries(url.searchParams),
          body
        });
        res.statusCode = r.status;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(r.body));
      } catch (error) {
        console.error('Error en tarifas:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'server_error' }));
      }
    }

    // ============= /api/reports/payments & /api/reports/occupancy =============
    if (first === 'reports') {
      if (second === 'payments') {
        return reportPaymentsHandler(req, res);
      }
      if (second === 'occupancy') {
        return reportOccupancyHandler(req, res);
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
