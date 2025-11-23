const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ============= DB Utilities =============
let pool;

function createPool() {
  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });
  }
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'balnearios_mvp',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });
}

function getPool() {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

const db = {
  query: (text, params) => getPool().query(text, params),
  getClient: () => getPool().connect()
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
