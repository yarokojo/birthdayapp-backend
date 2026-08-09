const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require("multer");
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// ✅ DATABASE CONNECTION
// ============================================================
const dbUrl = process.env.DATABASE_URL || '';
const isCloudDb = dbUrl.includes('neon.tech') || dbUrl.includes('render.com');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: isCloudDb ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
});

pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL error:', err.message);
});

// ============================================================
// ✅ INITIALIZE DATABASE TABLES (FIXED - NO TEMPLATE LITERAL ISSUES)
// ============================================================
const initDatabaseTables = async () => {
  console.log('📦 Checking/Creating database tables...');

  const queries = [
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      username VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      profile_image TEXT,
      bio TEXT,
      location TEXT,
      phone VARCHAR(20),
      network VARCHAR(50),
      birth_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS friends (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      friend_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, friend_id)
    );`,

    `CREATE TABLE IF NOT EXISTS friend_requests (
      id SERIAL PRIMARY KEY,
      from_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      to_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(from_user_id, to_user_id)
    );`,

    `CREATE TABLE IF NOT EXISTS wallets (
      user_id INTEGER PRIMARY KEY REFERENCES users(id),
      balance DECIMAL(15,2) DEFAULT 0,
      total_received DECIMAL(15,2) DEFAULT 0,
      total_sent DECIMAL(15,2) DEFAULT 0,
      total_withdrawn DECIMAL(15,2) DEFAULT 0,
      total_fees_paid DECIMAL(15,2) DEFAULT 0,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      version INTEGER DEFAULT 0
    );`,

    `CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      content TEXT,
      image_url TEXT,
      video_url TEXT,
      location TEXT,
      celebration_type VARCHAR(50),
      celebrant_name VARCHAR(255),
      birthday_song_id VARCHAR(255),
      birthday_song_url TEXT,
      birthday_song_name VARCHAR(255),
      likes INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      text TEXT NOT NULL,
      likes INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255),
      message TEXT,
      image_url TEXT,
      target_id VARCHAR(255),
      target_name VARCHAR(255),
      extra_data JSONB,
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS gift_transactions (
      id SERIAL PRIMARY KEY,
      sender_id INTEGER REFERENCES users(id),
      recipient_id INTEGER REFERENCES users(id),
      gift_id VARCHAR(255),
      gift_name VARCHAR(255),
      amount DECIMAL(15,2) NOT NULL,
      fee DECIMAL(15,2) DEFAULT 0,
      net_amount DECIMAL(15,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      payment_reference VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS follows (
      id SERIAL PRIMARY KEY,
      follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      following_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(follower_id, following_id)
    );`,

    `CREATE TABLE IF NOT EXISTS bookmarks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      post_id VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, post_id)
    );`,

    `CREATE TABLE IF NOT EXISTS post_likes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      post_id VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, post_id)
    );`,

    `CREATE TABLE IF NOT EXISTS video_positions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      post_id VARCHAR(255) NOT NULL,
      position INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, post_id)
    );`,

    `CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);`,
    `CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON friend_requests(status);`,
    `CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);`,
    `CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);`,
    `CREATE INDEX IF NOT EXISTS idx_gift_transactions_status ON gift_transactions(status);`
  ];

  try {
    for (const query of queries) {
      await pool.query(query);
    }
    console.log('✅ Database tables verified/created successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error.message);
  }
};

app.use(cors());
app.use(express.json());

// ============ DATA STORAGE ============
const DATA_FILE = path.join(__dirname, 'data.json');

let data = {
  users: [],
  wallets: {},
  companyFees: [],
  giftTransactions: [],
  notifications: [],
  groupGifts: [],
  friendRequests: [],
  friendships: [],
  follows: [],
  posts: [],
  postLikes: [],
  bookmarks: [],
  videoPositions: [],
  seenStories: [],
  reminders: [],
  banners: [],
  userSettings: {},
  blockedUsers: {},
  calendarEvents: {},
  stories: [],
  liveStreams: [],
  companyAccount: {
    name: 'MeolCompany',
    accountNumber: '0596270302',
    network: 'MTN',
    totalFees: 0
  }
};

try {
  if (fs.existsSync(DATA_FILE)) {
    const saved = fs.readFileSync(DATA_FILE, 'utf8');
    data = JSON.parse(saved);
    console.log(`📂 Loaded data: ${data.users.length} users, ${data.posts.length} posts`);
  }
} catch (err) {
  console.log("📂 Starting fresh data");
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ============ VIDEO UPLOAD ============
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
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

app.use('/uploads', express.static('uploads'));

app.post('/api/upload/video', videoUpload.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }
    const videoUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    console.log('🎬 Video uploaded:', videoUrl);
    res.json({ success: true, videoUrl });
  } catch (error) {
    console.error('❌ Video upload error:', error);
    res.status(500).json({ error: 'Video upload failed' });
  }
});

// ============ HELPER FUNCTIONS ============
const getWalletBalance = (userId) => data.wallets[userId]?.balance || 0;

const addToWallet = (userId, amount, giftName, fromName) => {
  if (!data.wallets[userId]) data.wallets[userId] = { balance: 0, transactions: [] };
  data.wallets[userId].balance += amount;
  data.wallets[userId].transactions.unshift({
    id: Date.now().toString(),
    type: 'credit',
    amount,
    giftName,
    fromName,
    date: new Date().toISOString()
  });
  saveData();
  return data.wallets[userId].balance;
};

const addNotification = (userId, type, title, message, imageUrl = null, targetId = null, targetName = null, extraData = {}) => {
  console.log(`📨 Creating notification for user ${userId}: ${title}`);
  
  const newNotification = {
    id: Date.now().toString(),
    userId: parseInt(userId),
    type,
    title,
    message,
    imageUrl,
    targetId,
    targetName,
    extraData,
    isRead: false,
    createdAt: new Date().toISOString()
  };
  
  if (!data.notifications) data.notifications = [];
  data.notifications.unshift(newNotification);
  saveData();
  
  console.log(`✅ Notification created: ${newNotification.id}`);
  return newNotification;
};

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
    req.userId = decoded.userId;
    next();
  } catch (err) {
    console.error('❌ Invalid token:', err.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ============ HEALTH CHECK ============
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.get("/", (req, res) => {
  res.json({ message: "BirthdayApp API is running!" });
});

// ============ AUTH ENDPOINTS ============
app.post("/api/auth/register", async (req, res) => {
  const { email, password, name, username, birthDate } = req.body;
  const normalizedEmail = email.toLowerCase();
  
  if (data.users.find(u => u.email === normalizedEmail)) {
    return res.status(400).json({ error: "User already exists" });
  }
  if (!birthDate) {
    return res.status(400).json({ error: 'Birth date is required' });
  }
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = { 
      id: data.users.length + 1, 
      email: normalizedEmail, 
      name, 
      username,
      birthDate: birthDate || null,
      phone: req.body.phone || '',
      network: req.body.network || '',
      password_hash: hashedPassword,
      profileImage: 'https://randomuser.me/api/portraits/men/1.jpg',
      bio: '',
      location: '',
      created_at: new Date().toISOString() 
    };
    data.users.push(newUser);
    
    data.wallets[newUser.id] = { balance: 0, transactions: [] };
    data.userSettings[newUser.id] = {
      theme: { darkMode: false, primaryColor: '#6366f1' },
      privacy: { birthdayVisibility: 'friends', postVisibility: 'friends', allowWishes: 'everyone', allowTagging: 'friends' },
      notifications: { enabled: true, birthdayReminders: true, friendRequests: true, giftNotifications: true, commentNotifications: true }
    };
    data.blockedUsers[newUser.id] = [];
    data.calendarEvents[newUser.id] = [];
    saveData();
    
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      process.env.JWT_SECRET || 'your_jwt_secret_key',
      { expiresIn: '7d' }
    );
    
    res.json({ token, user: { id: newUser.id, email: newUser.email, name, username, birthDate: newUser.birthDate } });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = email.toLowerCase();
  const user = data.users.find(u => u.email === normalizedEmail);
  
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  
  try {
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your_jwt_secret_key',
      { expiresIn: '7d' }
    );
    
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, username: user.username, birthDate: user.birthDate } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ============ START SERVER ============
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`👥 Users: ${data.users.length}`);
  console.log(`📝 Posts: ${data.posts.length}`);
  console.log(`📢 Notifications: ${data.notifications.length}`);
  console.log(`💰 Company fees: ₵${data.companyAccount.totalFees}`);
  console.log(`📊 Banners: ${data.banners.length}`);
  console.log(`📡 Live Streams: ${data.liveStreams?.length || 0}`);
  console.log(`📅 Calendar events: ${Object.keys(data.calendarEvents || {}).length} users have events`);
  
  // ✅ Initialize database tables after server starts
  initDatabaseTables();
});
