const express = require("express");
const cors = require("cors");
const path = require("path");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

console.log(`🚀 Starting server on port ${PORT}`);

// ✅ Run migrations
const { runMigrations } = require('./src/config/runMigrations');
runMigrations();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true
}));

app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.get("/", (req, res) => {
  res.json({ message: "BirthdayApp API is running!" });
});

// ✅ MOUNT API ROUTES
console.log("📝 Loading routes...");

try {
  app.use("/api/auth", require("./src/routes/auth"));
  console.log("✅ /api/auth mounted");
} catch (err) {
  console.error("❌ Failed to load /api/auth:", err.message);
}

try {
  app.use("/api/users", require("./src/routes/users"));
  console.log("✅ /api/users mounted");
} catch (err) {
  console.error("❌ Failed to load /api/users:", err.message);
}

try {
  app.use("/api/posts", require("./src/routes/posts"));
  console.log("✅ /api/posts mounted");
} catch (err) {
  console.error("❌ Failed to load /api/posts:", err.message);
}

try {
  app.use("/api/wallet", require("./src/routes/wallet"));
  console.log("✅ /api/wallet mounted");
} catch (err) {
  console.error("❌ Failed to load /api/wallet:", err.message);
}

try {
  app.use("/api/friends", require("./src/routes/friends"));
  console.log("✅ /api/friends mounted");
} catch (err) {
  console.error("❌ Failed to load /api/friends:", err.message);
}

try {
  app.use("/api/gifts", require("./src/routes/gifts"));
  console.log("✅ /api/gifts mounted");
} catch (err) {
  console.error("❌ Failed to load /api/gifts:", err.message);
}

try {
  app.use("/api/notifications", require("./src/routes/notifications"));
  console.log("✅ /api/notifications mounted");
} catch (err) {
  console.error("❌ Failed to load /api/notifications:", err.message);
}

try {
  app.use("/api/calendar", require("./src/routes/calendar"));
  console.log("✅ /api/calendar mounted");
} catch (err) {
  console.error("❌ Failed to load /api/calendar:", err.message);
}

try {
  app.use("/api/banners", require("./src/routes/banners"));
  console.log("✅ /api/banners mounted");
} catch (err) {
  console.error("❌ Failed to load /api/banners:", err.message);
}

try {
  app.use("/api/stories", require("./src/routes/stories"));
  console.log("✅ /api/stories mounted");
} catch (err) {
  console.error("❌ Failed to load /api/stories:", err.message);
}

try {
  app.use("/api/live", require("./src/routes/live"));
  console.log("✅ /api/live mounted");
} catch (err) {
  console.error("❌ Failed to load /api/live:", err.message);
}

try {
  app.use("/api/upload", require("./src/routes/upload"));
  console.log("✅ /api/upload mounted");
} catch (err) {
  console.error("❌ Failed to load /api/upload:", err.message);
}

try {
  app.use("/api/settings", require("./src/routes/settings"));
  console.log("✅ /api/settings mounted");
} catch (err) {
  console.error("❌ Failed to load /api/settings:", err.message);
}

try {
  app.use("/api/leaderboard", require("./src/routes/leaderboard"));
  console.log("✅ /api/leaderboard mounted");
} catch (err) {
  console.error("❌ Failed to load /api/leaderboard:", err.message);
}

try {
  app.use("/api/admin", require("./src/routes/admin"));
  console.log("✅ /api/admin mounted");
} catch (err) {
  console.error("❌ Failed to load /api/admin:", err.message);
}

try {
  app.use("/api/ads", require("./src/routes/ads"));
  console.log("✅ /api/ads mounted");
} catch (err) {
  console.error("❌ Failed to load /api/ads:", err.message);
}

console.log("✅ All routes loaded");

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
// ============================================================
// ✅ AUTO-CREATE DATABASE TABLES ON STARTUP
// ============================================================
const initDatabaseTables = async () => {
  console.log('📦 Checking/Creating database tables...');

  const tables = \`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
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
    );

    -- Friends table
    CREATE TABLE IF NOT EXISTS friends (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      friend_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, friend_id)
    );

    -- Friend requests table
    CREATE TABLE IF NOT EXISTS friend_requests (
      id SERIAL PRIMARY KEY,
      from_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      to_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(from_user_id, to_user_id)
    );

    -- Wallets table
    CREATE TABLE IF NOT EXISTS wallets (
      user_id INTEGER PRIMARY KEY REFERENCES users(id),
      balance DECIMAL(15,2) DEFAULT 0,
      total_received DECIMAL(15,2) DEFAULT 0,
      total_sent DECIMAL(15,2) DEFAULT 0,
      total_withdrawn DECIMAL(15,2) DEFAULT 0,
      total_fees_paid DECIMAL(15,2) DEFAULT 0,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      version INTEGER DEFAULT 0
    );

    -- Posts table
    CREATE TABLE IF NOT EXISTS posts (
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
    );

    -- Comments table
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      text TEXT NOT NULL,
      likes INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Notifications table
    CREATE TABLE IF NOT EXISTS notifications (
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
    );

    -- Gift transactions table
    CREATE TABLE IF NOT EXISTS gift_transactions (
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
    );

    -- Follows table
    CREATE TABLE IF NOT EXISTS follows (
      id SERIAL PRIMARY KEY,
      follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      following_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(follower_id, following_id)
    );

    -- Bookmarks table
    CREATE TABLE IF NOT EXISTS bookmarks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      post_id VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, post_id)
    );

    -- Post likes table
    CREATE TABLE IF NOT EXISTS post_likes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      post_id VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, post_id)
    );

    -- Video positions table
    CREATE TABLE IF NOT EXISTS video_positions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      post_id VARCHAR(255) NOT NULL,
      position INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, post_id)
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
    CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
    CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON friend_requests(status);
    CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
    CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
    CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);
    CREATE INDEX IF NOT EXISTS idx_gift_transactions_status ON gift_transactions(status);
  \`;

  try {
    await pool.query(tables);
    console.log('✅ Database tables verified/created successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error.message);
  }
};

// Call this after connecting to database
initDatabaseTables();
