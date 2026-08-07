const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

// ✅ Import routes
const authRoutes = require('./src/routes/auth');
const postRoutes = require('./src/routes/posts');
const walletRoutes = require('./src/routes/wallet');
const friendRoutes = require('./src/routes/friends');
const userRoutes = require('./src/routes/users');
const notificationRoutes = require('./src/routes/notifications');
const giftRoutes = require('./src/routes/gifts');
const adminRoutes = require('./src/routes/admin');
const settingsRoutes = require('./src/routes/settings');
const bannersRoutes = require('./src/routes/banners');
const storiesRoutes = require('./src/routes/stories');
const leaderboardRoutes = require('./src/routes/leaderboard');
const calendarRoutes = require('./src/routes/calendar');
const liveRoutes = require('./src/routes/live');

// ✅ Import database initialization
const { initDb } = require('./src/config/initDb');

const app = express();
const PORT = process.env.PORT || 5000;

console.log('✅ Starting BirthdayApp API...');
console.log(`📦 PORT: ${PORT}`);

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  credentials: true,
}));

app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================================
// ROUTES
// ============================================================
app.get('/', (req, res) => {
  res.json({
    message: '🎉 BirthdayApp API',
    version: '2.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

console.log('📋 Registering routes...');

app.use('/api/auth', authRoutes);
console.log('  ✅ /api/auth registered');

app.use('/api/users', userRoutes);
console.log('  ✅ /api/users registered');

app.use('/api/user', settingsRoutes);
console.log('  ✅ /api/user registered');

app.use('/api/posts', postRoutes);
console.log('  ✅ /api/posts registered');

app.use('/api/wallet', walletRoutes);
console.log('  ✅ /api/wallet registered');

app.use('/api/friends', friendRoutes);
console.log('  ✅ /api/friends registered');

app.use('/api/notifications', notificationRoutes);
console.log('  ✅ /api/notifications registered');

app.use('/api/gifts', giftRoutes);
console.log('  ✅ /api/gifts registered');

console.log('  ✅ /api/upload registered');

app.use('/api/admin', adminRoutes);
console.log('  ✅ /api/admin registered');

app.use('/api/banners', bannersRoutes);
console.log('  ✅ /api/banners registered');

app.use('/api/stories', storiesRoutes);
console.log('  ✅ /api/stories registered');

app.use('/api/leaderboard', leaderboardRoutes);
console.log('  ✅ /api/leaderboard registered');

app.use('/api/calendar', calendarRoutes);
console.log('  ✅ /api/calendar registered');

app.use('/api/live', liveRoutes);
console.log('  ✅ /api/live registered');

console.log('✅ All routes registered!');

// ============================================================
// 404 Handler
// ============================================================
app.use((req, res) => {
  console.log(`❌ 404: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Endpoint not found' });
});

// ============================================================
// Error Handler
// ============================================================
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  
  // ✅ Initialize database tables
  await initDb();
  
  console.log('');
  console.log('📋 Registered Routes:');
  console.log('  /api/auth     - Auth routes');
  console.log('  /api/users    - User routes');
  console.log('  /api/user     - Settings routes');
  console.log('  /api/posts    - Post routes');
  console.log('  /api/wallet   - Wallet routes');
  console.log('  /api/friends  - Friend routes');
  console.log('  /api/notifications - Notification routes');
  console.log('  /api/gifts    - Gift routes');
  console.log('  /api/upload   - Upload routes');
  console.log('  /api/admin    - Admin routes');
  console.log('  /api/banners  - Banner routes');
  console.log('  /api/stories  - Story routes');
  console.log('  /api/leaderboard - Leaderboard routes');
  console.log('  /api/calendar - Calendar routes');
  console.log('  /api/live     - Live streams routes');
});

// ✅ Temporary setup endpoint - remove after first run
app.get('/api/setup', async (req, res) => {
  try {
    const { initDb } = require('./src/config/initDb');
    await initDb();
    res.json({ success: true, message: 'Database tables created!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Temporary setup endpoint - run once to create tables
app.get('/api/setup', async (req, res) => {
  try {
    const { initDb } = require('./src/config/initDb');
    await initDb();
    res.json({ success: true, message: 'Database tables created!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Test database connection
app.get('/api/test-db', async (req, res) => {
  try {
    const { query } = require('./src/config/database');
    const result = await query('SELECT NOW()');
    res.json({ 
      success: true, 
      time: result.rows[0].now,
      message: 'Database connected!'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    });
  }
});

// ✅ Force setup endpoint
app.get('/api/force-setup', async (req, res) => {
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        bio TEXT,
        location VARCHAR(255),
        profile_image TEXT,
        phone VARCHAR(20),
        network VARCHAR(50),
        birth_date DATE,
        is_admin BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        balance DECIMAL(10,2) DEFAULT 0,
        total_received DECIMAL(10,2) DEFAULT 0,
        total_sent DECIMAL(10,2) DEFAULT 0,
        total_withdrawn DECIMAL(10,2) DEFAULT 0,
        total_fees_paid DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.end();
    res.json({ success: true, message: 'Tables created successfully!' });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Upload routes
console.log('  ✅ /api/upload registered');

// ✅ Upload routes
const uploadRoutes = require('./src/routes/upload');
app.use('/api/upload', uploadRoutes);
console.log('  ✅ /api/upload registered');

// ✅ TEST ROUTE - NO AUTH
const uploadTestRoutes = require('./src/routes/upload-test');
app.use('/api/upload-test', uploadTestRoutes);
console.log('  ✅ /api/upload-test registered (no auth)');
