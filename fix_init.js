// ============================================================
// ✅ AUTO-CREATE DATABASE TABLES ON STARTUP (FIXED VERSION)
// ============================================================
const initDatabaseTables = async () => {
  console.log('📦 Checking/Creating database tables...');

  // ✅ Use array join to avoid backtick conflicts
  const queries = [
    // Users table
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

    // Friends table
    `CREATE TABLE IF NOT EXISTS friends (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      friend_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, friend_id)
    );`,

    // Friend requests table
    `CREATE TABLE IF NOT EXISTS friend_requests (
      id SERIAL PRIMARY KEY,
      from_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      to_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(from_user_id, to_user_id)
    );`,

    // Wallets table
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

    // Posts table
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

    // Comments table
    `CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      text TEXT NOT NULL,
      likes INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    // Notifications table
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

    // Gift transactions table
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

    // Follows table
    `CREATE TABLE IF NOT EXISTS follows (
      id SERIAL PRIMARY KEY,
      follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      following_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(follower_id, following_id)
    );`,

    // Bookmarks table
    `CREATE TABLE IF NOT EXISTS bookmarks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      post_id VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, post_id)
    );`,

    // Post likes table
    `CREATE TABLE IF NOT EXISTS post_likes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      post_id VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, post_id)
    );`,

    // Video positions table
    `CREATE TABLE IF NOT EXISTS video_positions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      post_id VARCHAR(255) NOT NULL,
      position INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, post_id)
    );`,

    // Create indexes
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
