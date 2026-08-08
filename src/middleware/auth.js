const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await query(
      `SELECT id, name, username, email, profile_image, is_admin, is_active 
       FROM users WHERE id = $1`,
      [decoded.userId]
    ).catch(err => {
      console.error('❌ Database query in auth failed:', err.message);
      return null;
    });

    if (!result || result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!result.rows[0].is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    req.user = result.rows[0];
    req.userId = decoded.userId;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    console.error('❌ Auth error:', error.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

const requireAuth = verifyToken;

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const result = await query(
        'SELECT id, name, username, email FROM users WHERE id = $1 AND is_active = true',
        [decoded.userId]
      ).catch(() => null);
      if (result && result.rows.length > 0) {
        req.user = result.rows[0];
        req.userId = decoded.userId;
      }
    }
  } catch (error) {
    // Silent fail for optional auth
  }
  next();
};

const isAdmin = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const result = await query('SELECT is_admin FROM users WHERE id = $1', [req.userId]);
    if (result.rows.length === 0 || !result.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (error) {
    console.error('❌ Admin check error:', error);
    res.status(500).json({ error: 'Failed to verify admin status' });
  }
};

module.exports = { verifyToken, requireAuth, optionalAuth, isAdmin };
