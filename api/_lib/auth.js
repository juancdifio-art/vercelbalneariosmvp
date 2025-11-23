const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

function authenticateToken(req, res) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'missing_token' });
    return null;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return {
      id: payload.userId,
      email: payload.email
    };
  } catch (err) {
    res.status(401).json({ error: 'invalid_token' });
    return null;
  }
}

function signToken(user) {
  const payload = { userId: user.id, email: user.email };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

module.exports = {
  authenticateToken,
  signToken,
  JWT_SECRET
};
