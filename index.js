const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(cors());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

console.log('✅ Starting BirthdayApp API...');

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/', (req, res) => {
  res.json({ message: '🎉 BirthdayApp API', status: 'running' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ============================================================
// DATABASE
// ============================================================
const { query } = require('./src/config/database');

// ============================================================
// AUTH ROUTES
// ============================================================
const authRoutes = require('./src/routes/auth');
app.use('/api/auth', authRoutes);
console.log('  ✅ /api/auth');

// ============================================================
// USER ROUTES
// ============================================================
const userRoutes = require('./src/routes/users');
app.use('/api/users', userRoutes);
console.log('  ✅ /api/users');

// ============================================================
// POST ROUTES
// ============================================================
const postRoutes = require('./src/routes/posts');
app.use('/api/posts', postRoutes);
console.log('  ✅ /api/posts');

// ============================================================
// WALLET ROUTES
// ============================================================
const walletRoutes = require('./src/routes/wallet');
app.use('/api/wallet', walletRoutes);
console.log('  ✅ /api/wallet');

// ============================================================
// FRIEND ROUTES
// ============================================================
const friendRoutes = require('./src/routes/friends');
app.use('/api/friends', friendRoutes);
console.log('  ✅ /api/friends');

// ============================================================
// NOTIFICATION ROUTES
// ============================================================
const notificationRoutes = require('./src/routes/notifications');
app.use('/api/notifications', notificationRoutes);
console.log('  ✅ /api/notifications');

// ============================================================
// GIFT ROUTES
// ============================================================
const giftRoutes = require('./src/routes/gifts');
app.use('/api/gifts', giftRoutes);
console.log('  ✅ /api/gifts');

// ============================================================
// SETTINGS ROUTES
// ============================================================
const settingsRoutes = require('./src/routes/settings');
app.use('/api/user', settingsRoutes);
console.log('  ✅ /api/user');

// ============================================================
// BANNER ROUTES
// ============================================================
const bannerRoutes = require('./src/routes/banners');
app.use('/api/banners', bannerRoutes);
console.log('  ✅ /api/banners');

// ============================================================
// STORY ROUTES
// ============================================================
const storyRoutes = require('./src/routes/stories');
app.use('/api/stories', storyRoutes);
console.log('  ✅ /api/stories');

// ============================================================
// LEADERBOARD ROUTES
// ============================================================
const leaderboardRoutes = require('./src/routes/leaderboard');
app.use('/api/leaderboard', leaderboardRoutes);
console.log('  ✅ /api/leaderboard');

// ============================================================
// CALENDAR ROUTES
// ============================================================
const calendarRoutes = require('./src/routes/calendar');
app.use('/api/calendar', calendarRoutes);
console.log('  ✅ /api/calendar');

// ============================================================
// LIVE STREAM ROUTES
// ============================================================
const liveRoutes = require('./src/routes/live');
app.use('/api/live', liveRoutes);
console.log('  ✅ /api/live');

// ============================================================
// ADMIN ROUTES
// ============================================================
const adminRoutes = require('./src/routes/admin');
app.use('/api/admin', adminRoutes);
console.log('  ✅ /api/admin');

// ============================================================
// ✅ UPLOAD ROUTES - DIRECT IN INDEX.JS
// ============================================================
const multer = require('multer');
const fs = require('fs');
const { requireAuth } = require('./src/middleware/auth');

// Setup upload directories
const uploadDir = path.join(__dirname, 'uploads');
const imageDir = path.join(uploadDir, 'images');
const videoDir = path.join(uploadDir, 'videos');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir, { recursive: true });
if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });

// Image upload config
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, imageDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'image-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Video upload config
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, videoDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'video-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  }
});

// ✅ IMAGE UPLOAD - WITH AUTH
app.post('/api/upload/image', requireAuth, imageUpload.single('image'), (req, res) => {
  console.log('📸 Image upload received');
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded' });
  }
  const imageUrl = `${req.protocol}://${req.get('host')}/uploads/images/${req.file.filename}`;
  res.json({ success: true, imageUrl });
});
console.log('  ✅ /api/upload/image');

// ✅ VIDEO UPLOAD - WITH AUTH
app.post('/api/upload/video', requireAuth, videoUpload.single('video'), (req, res) => {
  console.log('🎬 Video upload received');
  if (!req.file) {
    return res.status(400).json({ error: 'No video file uploaded' });
  }
  const videoUrl = `${req.protocol}://${req.get('host')}/uploads/videos/${req.file.filename}`;
  res.json({ success: true, videoUrl });
});
console.log('  ✅ /api/upload/video');

// ✅ TEST UPLOAD - NO AUTH (for debugging)
app.post('/api/upload-test/image-test', imageUpload.single('image'), (req, res) => {
  console.log('📸 TEST upload received');
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded' });
  }
  const imageUrl = `${req.protocol}://${req.get('host')}/uploads/images/${req.file.filename}`;
  res.json({ success: true, imageUrl });
});
console.log('  ✅ /api/upload-test/image-test');

// ============================================================
// 404 HANDLER
// ============================================================
app.use((req, res) => {
  console.log(`❌ 404: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Endpoint not found' });
});

// ============================================================
// ERROR HANDLER
// ============================================================
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log('');
  console.log('📋 Registered Routes:');
  console.log('  /api/auth         - Authentication');
  console.log('  /api/users        - Users');
  console.log('  /api/posts        - Posts');
  console.log('  /api/wallet       - Wallet');
  console.log('  /api/friends      - Friends');
  console.log('  /api/notifications - Notifications');
  console.log('  /api/gifts        - Gifts');
  console.log('  /api/user         - Settings');
  console.log('  /api/banners      - Banners');
  console.log('  /api/stories      - Stories');
  console.log('  /api/leaderboard  - Leaderboard');
  console.log('  /api/calendar     - Calendar');
  console.log('  /api/live         - Live Streams');
  console.log('  /api/admin        - Admin');
  console.log('  /api/upload/image - Image Upload (Auth)');
  console.log('  /api/upload/video - Video Upload (Auth)');
  console.log('  /api/upload-test/image-test - Test Upload (No Auth)');
});
