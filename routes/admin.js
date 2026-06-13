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

// Mock data stores (in production, use database)
let users = [
  { id: 1, name: 'Sarah Johnson', email: 'sarah@example.com', username: '@sarahj', status: 'active', posts_count: 45, birthday: '1990-06-15', joined: '2024-01-15' },
  { id: 2, name: 'Mike Chen', email: 'mike@example.com', username: '@mikec', status: 'active', posts_count: 32, birthday: '1988-03-22', joined: '2024-02-20' },
  { id: 3, name: 'Emma Watson', email: 'emma@example.com', username: '@emmaw', status: 'blocked', posts_count: 28, birthday: '1995-11-10', joined: '2024-03-10' },
  { id: 4, name: 'Alex Turner', email: 'alex@example.com', username: '@alext', status: 'active', posts_count: 56, birthday: '1992-08-05', joined: '2024-01-05' },
];

let posts = [
  { id: 1, user_id: 1, user_name: 'Sarah Johnson', content: 'Happy Birthday! 🎂', likes: 45, comments: 12, status: 'approved', created_at: new Date().toISOString() },
  { id: 2, user_id: 2, user_name: 'Mike Chen', content: 'Celebrating! 🎉', likes: 89, comments: 23, status: 'pending', created_at: new Date().toISOString() },
  { id: 3, user_id: 3, user_name: 'Emma Watson', content: 'Thank you everyone! 💕', likes: 234, comments: 56, status: 'approved', created_at: new Date().toISOString() },
];

let gifts = [
  { id: 1, name: 'Gold Bar', price: 100, category: 'Luxury', icon: '🥇', description: '24K pure gold bar', status: 'active', sales: 45 },
  { id: 2, name: 'Diamond Ring', price: 150, category: 'Luxury', icon: '💍', description: 'Exclusive diamond ring', status: 'active', sales: 32 },
  { id: 3, name: 'Celebration Cake', price: 50, category: 'Food', icon: '🎂', description: 'Delicious birthday cake', status: 'active', sales: 89 },
];

let transactions = [
  { id: 'TXN001', user: 'Sarah Johnson', type: 'gift', item: 'Gold Bar', amount: 100, fee: 1, status: 'completed', date: '2026-06-12', network: 'MTN' },
  { id: 'TXN002', user: 'Mike Chen', type: 'gift', item: 'Cake', amount: 50, fee: 0.50, status: 'completed', date: '2026-06-12', network: 'Telecel' },
  { id: 'TXN003', user: 'Emma Watson', type: 'withdrawal', amount: 200, fee: 2, status: 'pending', date: '2026-06-11', network: 'MTN' },
];

let feeSettings = { percentage: 1 };

// Verify JWT token middleware
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

// Admin Login
router.post('/login', [
  body('email').isEmail().normalizeEmail({ gmail_remove_dots: false, all_lowercase: true }),
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
    res.json({ token, admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Register new admin
router.post('/register', [
  body('email').isEmail().normalizeEmail({ gmail_remove_dots: false, all_lowercase: true }),
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
    res.status(201).json({ message: 'Admin created successfully', admin: { id: newAdmin.id, email: newAdmin.email, name: newAdmin.name, role: newAdmin.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current admin
router.get('/me', verifyToken, (req, res) => {
  const admin = admins.find(a => a.id === req.adminId);
  if (!admin) {
    return res.status(404).json({ error: 'Admin not found' });
  }
  res.json({ id: admin.id, email: admin.email, name: admin.name, role: admin.role });
});

// ============ DASHBOARD STATS ============
router.get('/stats', verifyToken, (req, res) => {
  const totalRevenue = transactions.filter(t => t.type === 'gift' && t.status === 'completed').reduce((sum, t) => sum + t.amount, 0);
  const totalFees = transactions.reduce((sum, t) => sum + t.fee, 0);
  const totalWithdrawals = transactions.filter(t => t.type === 'withdrawal' && t.status === 'completed').reduce((sum, t) => sum + t.amount, 0);
  
  res.json({
    totalUsers: users.length,
    totalPosts: posts.length,
    totalGifts: gifts.reduce((sum, g) => sum + g.sales, 0),
    totalRevenue: totalRevenue,
    totalFees: totalFees,
    totalWithdrawals: totalWithdrawals,
    activeUsers: users.filter(u => u.status === 'active').length,
    pendingWithdrawals: transactions.filter(t => t.type === 'withdrawal' && t.status === 'pending').length,
    userGrowth: 12,
    revenueGrowth: 8
  });
});

// ============ USER MANAGEMENT ============
router.get('/users', verifyToken, (req, res) => {
  res.json(users);
});

router.put('/users/:id/block', verifyToken, (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (user) {
    user.status = 'blocked';
  }
  res.json({ success: true });
});

router.put('/users/:id/unblock', verifyToken, (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (user) {
    user.status = 'active';
  }
  res.json({ success: true });
});

router.delete('/users/:id', verifyToken, (req, res) => {
  users = users.filter(u => u.id !== parseInt(req.params.id));
  res.json({ success: true });
});

// ============ POST MANAGEMENT ============
router.get('/posts', verifyToken, (req, res) => {
  res.json(posts);
});

router.put('/posts/:id/approve', verifyToken, (req, res) => {
  const post = posts.find(p => p.id === parseInt(req.params.id));
  if (post) {
    post.status = 'approved';
  }
  res.json({ success: true });
});

router.put('/posts/:id/reject', verifyToken, (req, res) => {
  const post = posts.find(p => p.id === parseInt(req.params.id));
  if (post) {
    post.status = 'rejected';
  }
  res.json({ success: true });
});

router.delete('/posts/:id', verifyToken, (req, res) => {
  posts = posts.filter(p => p.id !== parseInt(req.params.id));
  res.json({ success: true });
});

// ============ GIFT MANAGEMENT ============
router.get('/gifts', verifyToken, (req, res) => {
  res.json(gifts);
});

router.post('/gifts', verifyToken, (req, res) => {
  const newGift = {
    id: gifts.length + 1,
    ...req.body,
    price: parseFloat(req.body.price),
    status: 'active',
    sales: 0
  };
  gifts.push(newGift);
  res.status(201).json(newGift);
});

router.put('/gifts/:id', verifyToken, (req, res) => {
  const index = gifts.findIndex(g => g.id === parseInt(req.params.id));
  if (index !== -1) {
    gifts[index] = { ...gifts[index], ...req.body, price: parseFloat(req.body.price) };
    res.json(gifts[index]);
  } else {
    res.status(404).json({ error: 'Gift not found' });
  }
});

router.delete('/gifts/:id', verifyToken, (req, res) => {
  gifts = gifts.filter(g => g.id !== parseInt(req.params.id));
  res.json({ success: true });
});

// ============ TRANSACTION MANAGEMENT ============
router.get('/transactions', verifyToken, (req, res) => {
  res.json(transactions);
});

// ============ FEE SETTINGS ============
router.get('/fee-settings', verifyToken, (req, res) => {
  res.json(feeSettings);
});

router.post('/fee-settings', verifyToken, (req, res) => {
  const { percentage } = req.body;
  feeSettings.percentage = percentage;
  res.json({ success: true, percentage });
});

// Chart data for dashboard
router.get('/chart-data', verifyToken, (req, res) => {
  res.json([
    { date: 'Mon', revenue: 320, users: 45, posts: 12 },
    { date: 'Tue', revenue: 450, users: 52, posts: 18 },
    { date: 'Wed', revenue: 280, users: 38, posts: 8 },
    { date: 'Thu', revenue: 590, users: 67, posts: 24 },
    { date: 'Fri', revenue: 780, users: 89, posts: 32 },
    { date: 'Sat', revenue: 650, users: 76, posts: 28 },
    { date: 'Sun', revenue: 420, users: 54, posts: 16 },
  ]);
});

module.exports = router;
