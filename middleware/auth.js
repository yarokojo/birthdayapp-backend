const jwt = require('jsonwebtoken');
const { query } = require('../database');

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
    req.userId = decoded.userId;
    next();
  } catch (error) {
    console.error('❌ Auth error:', error.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const requireAuth = verifyToken;

module.exports = { verifyToken, requireAuth };
