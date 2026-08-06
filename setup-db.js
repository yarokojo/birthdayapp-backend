const { Pool } = require('pg');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL;

console.log('📦 DATABASE_URL exists:', !!dbUrl);
console.log('📦 DATABASE_URL length:', dbUrl?.length || 0);

if (!dbUrl) {
  console.error('❌ DATABASE_URL is not set!');
  process.exit(1);
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function setup() {
  console.log('🔧 Connecting to database...');
  
  try {
    // Test connection
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Connected! Time:', result.rows[0].now);
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
  }

  console.log('📦 Creating tables...');

  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      username VARCHAR(100) UNIQUE NOT NULL,
      bio TEXT,
      location VARCHAR(255),
      profile_image TEXT DEFAULT 'https://randomuser.me/api/portraits/men/1.jpg',
      phone VARCHAR(20),
      network VARCHAR(50),
      birth_date DATE,
      is_admin BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS wallets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      balance DECIMAL(10,2) DEFAULT 0,
      total_received DECIMAL(10,2) DEFAULT 0,
      total_sent DECIMAL(10,2) DEFAULT 0,
      total_withdrawn DECIMAL(10,2) DEFAULT 0,
      total_fees_paid DECIMAL(10,2) DEFAULT 0,
      locked_balance DECIMAL(10,2) DEFAULT 0,
      version INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      content TEXT,
      image TEXT,
      video TEXT,
      location VARCHAR(255),
      celebration_type VARCHAR(50) DEFAULT 'birthday',
      celebrant_name VARCHAR(255),
      is_birthday BOOLEAN DEFAULT FALSE,
      music VARCHAR(255),
      hashtags TEXT[],
      likes_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      views_count INTEGER DEFAULT 0,
      birthday_song_id VARCHAR(255),
      birthday_song_url TEXT,
      birthday_song_name VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      likes_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS post_likes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(post_id, user_id)
    )`,

    `CREATE TABLE IF NOT EXISTS friends (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      friend_id UUID REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, friend_id)
    )`,

    `CREATE TABLE IF NOT EXISTS friend_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      from_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      to_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      image_url TEXT,
      target_id VARCHAR(255),
      target_name VARCHAR(255),
      is_read BOOLEAN DEFAULT FALSE,
      extra_data JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS gifts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
      recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
      gift_id VARCHAR(255),
      gift_name VARCHAR(255) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      fee DECIMAL(10,2) DEFAULT 0,
      network VARCHAR(50),
      phone_number VARCHAR(20),
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      fee DECIMAL(10,2) DEFAULT 0,
      balance_before DECIMAL(10,2),
      balance_after DECIMAL(10,2),
      description TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      reference_id VARCHAR(255),
      network VARCHAR(50),
      phone_number VARCHAR(20),
      metadata JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS user_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      theme JSONB DEFAULT '{"darkMode": false, "primaryColor": "#6366f1"}',
      privacy JSONB DEFAULT '{"birthdayVisibility": "friends", "postVisibility": "friends", "allowWishes": "everyone", "allowTagging": "friends"}',
      notifications JSONB DEFAULT '{"enabled": true, "birthdayReminders": true, "friendRequests": true, "giftNotifications": true, "commentNotifications": true}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS banners (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      subtitle TEXT,
      icon VARCHAR(50),
      colors TEXT[],
      type VARCHAR(50),
      link VARCHAR(255),
      active BOOLEAN DEFAULT TRUE,
      priority INTEGER DEFAULT 0,
      views_count INTEGER DEFAULT 0,
      clicks_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS stories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      content_url TEXT,
      is_video BOOLEAN DEFAULT FALSE,
      caption TEXT,
      privacy VARCHAR(20) DEFAULT 'friends',
      likes_count INTEGER DEFAULT 0,
      views_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
    )`,

    `CREATE TABLE IF NOT EXISTS story_views (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(story_id, user_id)
    )`,

    `CREATE TABLE IF NOT EXISTS platform_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admin_name VARCHAR(255),
      admin_phone VARCHAR(20),
      admin_network VARCHAR(50),
      withdrawal_fee DECIMAL(5,4) DEFAULT 0.01,
      transaction_fee DECIMAL(5,4) DEFAULT 0.01,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS calendar_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      date DATE NOT NULL,
      type VARCHAR(50) DEFAULT 'birthday',
      celebrant_name VARCHAR(255),
      celebrant_id VARCHAR(255),
      reminder_set BOOLEAN DEFAULT FALSE,
      reminder_time TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS live_streams (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      stream_url TEXT,
      thumbnail TEXT,
      viewer_count INTEGER DEFAULT 0,
      like_count INTEGER DEFAULT 0,
      gift_count INTEGER DEFAULT 0,
      status VARCHAR(20) DEFAULT 'live',
      privacy VARCHAR(20) DEFAULT 'everyone',
      is_birthday BOOLEAN DEFAULT FALSE,
      celebrant_name VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ended_at TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS follows (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
      following_id UUID REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(follower_id, following_id)
    )`,

    `CREATE TABLE IF NOT EXISTS bookmarks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(post_id, user_id)
    )`
  ];

  let count = 0;
  for (const sql of tables) {
    try {
      await pool.query(sql);
      count++;
      console.log(`  ✅ Table ${count}/${tables.length} created`);
    } catch (err) {
      console.error(`  ❌ Error: ${err.message}`);
    }
  }

  console.log(`✅ Done! ${count}/${tables.length} tables created.`);
  await pool.end();
}

setup().catch(console.error);
