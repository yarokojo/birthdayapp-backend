const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

// ✅ Import routes from src/routes/
const authRoutes = require('./src/routes/auth');
const postRoutes = require('./src/routes/posts');
const walletRoutes = require('./src/routes/wallet');
const friendRoutes = require('./src/routes/friends');
const userRoutes = require('./src/routes/users');
const notificationRoutes = require('./src/routes/notifications');
const giftRoutes = require('./src/routes/gifts');
const uploadRoutes = require('./src/routes/upload');
const adminRoutes = require('./src/routes/admin');
const settingsRoutes = require('./src/routes/settings');
const bannersRoutes = require('./src/routes/banners');
const storiesRoutes = require('./src/routes/stories');
const leaderboardRoutes = require('./src/routes/leaderboard');
const calendarRoutes = require('./src/routes/calendar');
const liveRoutes = require('./src/routes/live');

const { seedPlatformWallet } = require('./src/config/seed');

const app = express();
const PORT = process.env.PORT || 5000;

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

// ✅ USE THE IMPORTED ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/user', settingsRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/gifts', giftRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/banners', bannersRoutes);
app.use('/api/stories', storiesRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/live', liveRoutes);

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
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  await seedPlatformWallet();
  
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
// Force deploy - Thu Aug  6 13:44:03 GMT 2026
