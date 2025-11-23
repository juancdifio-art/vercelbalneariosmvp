const db = require('../lib/db');
const handleCors = require('../lib/cors');

module.exports = async (req, res) => {
  if (handleCors(req, res)) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    await db.query('SELECT 1');
    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('DB healthcheck error:', error);
    return res.status(500).json({ error: 'database_error' });
  }
};
