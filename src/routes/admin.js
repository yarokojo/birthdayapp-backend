const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// In-memory admin storage
let admins = [
  {
    id: 1,
    email: 'admin@birthdayapp.com',
    password_hash: '$2a$10$N9qo8uLOickgx2ZMRZoMy.MqrD7Xk7ZVjZX4C8RqKXyBRpQ.vvRtK',
    name: 'Super Admin',
    role: 'super_admin',
    created_at: new Date().toISOString()
  }
];

// Verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
    req.adminId = decoded.adminId;
    req.adminRole = decoded.role;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const { email, password } = req.body;
    
    const admin = admins.find(a => a.email === email);
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValid = await bcrypt.compare(password, admin.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { adminId: admin.id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET || 'your_jwt_secret_key',
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Register new admin
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').notEmpty(),
  body('secretKey').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const { email, password, name, secretKey } = req.body;
    
    if (secretKey !== 'birthdayapp_admin_2024') {
      return res.status(401).json({ error: 'Invalid secret key' });
    }
    
    const existingAdmin = admins.find(a => a.email === email);
    if (existingAdmin) {
      return res.status(400).json({ error: 'Admin already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newAdmin = {
      id: admins.length + 1,
      email,
      password_hash: hashedPassword,
      name,
      role: 'admin',
      created_at: new Date().toISOString()
    };
    admins.push(newAdmin);
    
    res.status(201).json({
      message: 'Admin created successfully',
      admin: {
        id: newAdmin.id,
        email: newAdmin.email,
        name: newAdmin.name,
        role: newAdmin.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current admin
router.get('/me', verifyToken, async (req, res) => {
  try {
    const admin = admins.find(a => a.id === req.adminId);
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    
    res.json({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      created_at: admin.created_at
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
