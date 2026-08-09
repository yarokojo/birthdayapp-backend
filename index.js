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

// ============================================================
// ✅ USERS ENDPOINTS
// ============================================================
app.get('/api/users/profile', verifyToken, (req, res) => {
  const user = data.users.find(u => u.id === req.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    bio: user.bio || '',
    location: user.location || '',
    profileImage: user.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
    birthDate: user.birthDate || null,
    phone: user.phone || '',
    network: user.network || '',
    createdAt: user.created_at
  });
});

// ============================================================
// ✅ WALLET ENDPOINTS
// ============================================================
app.get('/api/wallet/balance', verifyToken, (req, res) => {
  const userId = req.userId;
  const wallet = data.wallets[userId] || { balance: 0, transactions: [] };
  res.json({
    balance: wallet.balance || 0,
    total_received: 0,
    total_sent: 0,
    total_withdrawn: 0,
    total_fees_paid: 0
  });
});

app.get('/api/wallet/transactions', verifyToken, (req, res) => {
  const userId = req.userId;
  const wallet = data.wallets[userId] || { balance: 0, transactions: [] };
  res.json({ transactions: wallet.transactions || [] });
});

// ============================================================
// ✅ POSTS ENDPOINTS
// ============================================================
app.get('/api/posts', (req, res) => {
  const allPosts = data.posts || [];
  res.json(allPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post('/api/posts', verifyToken, (req, res) => {
  const { content, image, video, location, celebrationType, celebrantName, isBirthday, music, hashtags } = req.body;
  const user = data.users.find(u => u.id === req.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const newPost = {
    id: Date.now().toString(),
    userId: user.id,
    content,
    image: image || null,
    video: video || null,
    location: location || null,
    celebrationType: celebrationType || 'general',
    celebrantName: celebrantName || '',
    isBirthday: isBirthday || celebrationType === 'birthday',
    music: music || null,
    hashtags: hashtags || [],
    authorName: user.name,
    authorHandle: user.username,
    authorImage: user.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
    phone: user.phone || '',
    network: user.network || 'MTN',
    likes: 0,
    comments: 0,
    reposts: 0,
    views: 0,
    createdAt: new Date().toISOString(),
    commentList: []
  };
  
  if (!data.posts) data.posts = [];
  data.posts.unshift(newPost);
  saveData();
  res.status(201).json(newPost);
});

// ============================================================
// ✅ FRIENDS ENDPOINTS
// ============================================================
app.get('/api/friends/list/:userId', verifyToken, (req, res) => {
  const userId = parseInt(req.params.userId);
  const friendships = data.friendships.filter(f => f.userId === userId);
  const friends = friendships
    .map(f => {
      const friend = data.users.find(u => u.id === f.friendId);
      if (!friend) return null;
      return {
        id: friend.id,
        name: friend.name,
        username: friend.username,
        profileImage: friend.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
        birthDate: friend.birthDate || null,
        phone: friend.phone || '',
        network: friend.network || 'MTN'
      };
    })
    .filter(Boolean);
  res.json({ friends });
});

app.get('/api/friends/requests', verifyToken, (req, res) => {
  const userId = req.userId;
  const pending = data.friendRequests.filter(r => r.toUserId === userId && r.status === 'pending');
  res.json({ requests: pending });
});

// ============================================================
// ✅ BANNERS ENDPOINTS
// ============================================================
app.get('/api/banners', (req, res) => {
  const activeBanners = (data.banners || []).filter(b => b.active !== false);
  res.json({ success: true, banners: activeBanners });
});

app.post('/api/banners/:id/view', (req, res) => {
  const { id } = req.params;
  const banner = (data.banners || []).find(b => b.id === id);
  if (banner) { banner.views = (banner.views || 0) + 1; saveData(); }
  res.json({ success: true });
});

app.post('/api/banners/:id/click', (req, res) => {
  const { id } = req.params;
  const banner = (data.banners || []).find(b => b.id === id);
  if (banner) { banner.clicks = (banner.clicks || 0) + 1; saveData(); }
  res.json({ success: true });
});

// ============================================================
// ✅ NOTIFICATIONS ENDPOINTS
// ============================================================
app.get('/api/notifications/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const userNotifications = (data.notifications || []).filter(n => n.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const unreadCount = userNotifications.filter(n => !n.isRead).length;
  res.json({ notifications: userNotifications, unreadCount });
});

app.post('/api/notifications', (req, res) => {
  const { userId, type, title, message, imageUrl, targetId, targetName, extraData } = req.body;
  if (!userId || !type || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const newNotification = {
    id: Date.now().toString(),
    userId: parseInt(userId),
    type,
    title: title || type,
    message,
    imageUrl: imageUrl || null,
    targetId: targetId || null,
    targetName: targetName || null,
    extraData: extraData || {},
    isRead: false,
    createdAt: new Date().toISOString()
  };
  
  if (!data.notifications) data.notifications = [];
  data.notifications.unshift(newNotification);
  saveData();
  res.status(201).json(newNotification);
});

app.put('/api/notifications/:id/read', (req, res) => {
  const { id } = req.params;
  const notification = data.notifications.find(n => n.id === id);
  if (!notification) return res.status(404).json({ error: "Notification not found" });
  notification.isRead = true;
  saveData();
  res.json({ success: true });
});

app.put('/api/notifications/read-all/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  data.notifications.filter(n => n.userId === userId && !n.isRead).forEach(n => n.isRead = true);
  saveData();
  res.json({ success: true });
});

app.delete('/api/notifications/:id', (req, res) => {
  const { id } = req.params;
  const index = data.notifications.findIndex(n => n.id === id);
  if (index === -1) return res.status(404).json({ error: "Notification not found" });
  data.notifications.splice(index, 1);
  saveData();
  res.json({ success: true });
});

// ============================================================
// ✅ WALLET - ADD GIFT
// ============================================================
app.post('/api/wallet/add-gift', verifyToken, (req, res) => {
  const { celebrantId, celebrantName, giftAmount, giftName, fromName, isAnonymous } = req.body;
  const amount = parseFloat(giftAmount);
  const senderName = isAnonymous ? 'Anonymous' : (fromName || 'Someone');
  const newBalance = addToWallet(celebrantId, amount, giftName, senderName);
  saveData();
  res.json({ success: true, newBalance, message: `₵${amount} added to wallet` });
});

// ============================================================
// ✅ GIFTS ENDPOINTS
// ============================================================
app.post('/api/gifts/purchase', verifyToken, (req, res) => {
  const { giftId, giftName, amount, network, phoneNumber, recipientId, recipientName, isPremium, senderName } = req.body;
  if (!giftId || !amount || !recipientId) return res.status(400).json({ error: "Missing required fields" });
  const user = data.users.find(u => u.id === req.userId);
  const newBalance = addToWallet(recipientId, parseFloat(amount), giftName, senderName || user?.name || 'Someone');
  const transaction = { 
    id: Date.now().toString(), 
    giftId, 
    giftName, 
    amount: parseFloat(amount), 
    buyerId: req.userId, 
    buyerName: user?.name || 'Someone', 
    recipientId, 
    recipientName, 
    network, 
    phoneNumber, 
    isPremium: isPremium || false,
    status: 'completed', 
    date: new Date().toISOString() 
  };
  data.giftTransactions.unshift(transaction);
  saveData();
  addNotification(recipientId, 'gift', '🎁 Gift Received', `${user?.name || 'Someone'} sent you ${giftName} worth ₵${amount}!`);
  res.json({ success: true, transaction, newBalance });
});

console.log('✅ All endpoints added successfully!');

// ============================================================
// ✅ INITIALIZE BANNERS (if empty)
// ============================================================
const initBanners = () => {
  if (!data.banners || data.banners.length === 0) {
    data.banners = [
      { 
        id: 'banner_1', 
        title: '🎉 Today\'s Celebrations', 
        subtitle: 'Check out today\'s events!', 
        icon: '🎂', 
        colors: ['#6366f1', '#8b5cf6', '#a855f7'], 
        type: 'celebrations', 
        link: 'today', 
        active: true, 
        priority: 1, 
        views: 0, 
        clicks: 0, 
        createdAt: new Date().toISOString() 
      },
      { 
        id: 'banner_2', 
        title: '🎁 Gift Shop', 
        subtitle: 'Send a gift to someone special', 
        icon: '🎁', 
        colors: ['#ec4899', '#f472b6', '#f9a8d4'], 
        type: 'gifts', 
        link: 'gift_shop', 
        active: true, 
        priority: 2, 
        views: 0, 
        clicks: 0, 
        createdAt: new Date().toISOString() 
      }
    ];
    saveData();
    console.log('✅ Banners initialized');
  }
};

// Call this after data is loaded
initBanners();
