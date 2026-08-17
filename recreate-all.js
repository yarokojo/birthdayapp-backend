const { query } = require('./src/config/database');
const fs = require('fs');

async function recreateAll() {
  try {
    console.log('🗄️ Recreating all tables from scratch...');
    
    // Drop all tables in correct order (CASCADE handles dependencies)
    console.log('📝 Dropping all tables...');
    await query(`DROP TABLE IF EXISTS comments CASCADE`);
    await query(`DROP TABLE IF EXISTS post_likes CASCADE`);
    await query(`DROP TABLE IF EXISTS posts CASCADE`);
    await query(`DROP TABLE IF EXISTS friend_requests CASCADE`);
    await query(`DROP TABLE IF EXISTS friends CASCADE`);
    await query(`DROP TABLE IF EXISTS notifications CASCADE`);
    await query(`DROP TABLE IF EXISTS wallets CASCADE`);
    await query(`DROP TABLE IF EXISTS banners CASCADE`);
    await query(`DROP TABLE IF EXISTS users CASCADE`);
    console.log('✅ All tables dropped');
    
    // Create users table
    console.log('📝 Creating users table...');
    await query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
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
    console.log('✅ Users table created');
    
    // Create posts table
    console.log('📝 Creating posts table...');
    await query(`
      CREATE TABLE posts (
        id VARCHAR(255) PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
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
      )
    `);
    console.log('✅ Posts table created');
    
    // Create comments table
    console.log('📝 Creating comments table...');
    await query(`
      CREATE TABLE comments (
        id SERIAL PRIMARY KEY,
        post_id VARCHAR(255) REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        likes_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Comments table created');
    
    // Create wallets table
    console.log('📝 Creating wallets table...');
    await query(`
      CREATE TABLE wallets (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        balance DECIMAL(10,2) DEFAULT 0,
        total_received DECIMAL(10,2) DEFAULT 0,
        total_sent DECIMAL(10,2) DEFAULT 0,
        total_withdrawn DECIMAL(10,2) DEFAULT 0,
        total_fees_paid DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Wallets table created');
    
    // Create post_likes table
    console.log('📝 Creating post_likes table...');
    await query(`
      CREATE TABLE post_likes (
        id SERIAL PRIMARY KEY,
        post_id VARCHAR(255) REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_id)
      )
    `);
    console.log('✅ Post likes table created');
    
    // Create banners table
    console.log('📝 Creating banners table...');
    await query(`
      CREATE TABLE banners (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        subtitle TEXT,
        icon VARCHAR(50),
        colors TEXT[],
        active BOOLEAN DEFAULT TRUE,
        views_count INTEGER DEFAULT 0,
        clicks_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Banners table created');
    
    // Create friends table
    console.log('📝 Creating friends table...');
    await query(`
      CREATE TABLE friends (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        friend_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, friend_id)
      )
    `);
    console.log('✅ Friends table created');
    
    // Create friend_requests table
    console.log('📝 Creating friend_requests table...');
    await query(`
      CREATE TABLE friend_requests (
        id SERIAL PRIMARY KEY,
        from_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        to_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(from_user_id, to_user_id)
      )
    `);
    console.log('✅ Friend requests table created');
    
    // Create notifications table
    console.log('📝 Creating notifications table...');
    await query(`
      CREATE TABLE notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255),
        message TEXT,
        image_url TEXT,
        target_id VARCHAR(255),
        target_name VARCHAR(255),
        extra_data JSONB,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Notifications table created');
    
    // Create indexes
    console.log('📝 Creating indexes...');
    await query(`CREATE INDEX idx_posts_user_id ON posts(user_id)`);
    await query(`CREATE INDEX idx_posts_created_at ON posts(created_at DESC)`);
    await query(`CREATE INDEX idx_comments_post_id ON comments(post_id)`);
    await query(`CREATE INDEX idx_comments_user_id ON comments(user_id)`);
    await query(`CREATE INDEX idx_notifications_user_id ON notifications(user_id)`);
    await query(`CREATE INDEX idx_notifications_is_read ON notifications(is_read)`);
    await query(`CREATE INDEX idx_friend_requests_status ON friend_requests(status)`);
    await query(`CREATE INDEX idx_friends_user_id ON friends(user_id)`);
    await query(`CREATE INDEX idx_friends_friend_id ON friends(friend_id)`);
    console.log('✅ Indexes created');
    
    console.log('\n✅ All tables recreated successfully!');
    
    // Now migrate data from backup
    console.log('\n📥 Migrating data from backup...');
    let data = null;
    const backupFiles = ['backups/data.json', 'data.json.backup', 'data.json'];
    for (const file of backupFiles) {
      try {
        if (fs.existsSync(file)) {
          data = JSON.parse(fs.readFileSync(file, 'utf8'));
          console.log(`📥 Using ${file}`);
          break;
        }
      } catch (e) {}
    }
    
    if (!data) {
      console.log('⚠️ No backup found, skipping data migration');
      return;
    }
    
    // Migrate users
    console.log('📥 Migrating users...');
    for (const user of data.users || []) {
      await query(
        `INSERT INTO users (id, email, name, username, password_hash, profile_image, phone, network, birth_date, is_admin, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO NOTHING`,
        [
          user.id,
          user.email,
          user.name,
          user.username,
          user.password_hash,
          user.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
          user.phone || '',
          user.network || 'MTN',
          user.birthDate || null,
          user.is_admin || false,
          true,
          user.created_at || new Date().toISOString()
        ]
      );
    }
    console.log(`✅ Migrated ${data.users?.length || 0} users`);
    
    // Migrate posts
    console.log('📥 Migrating posts...');
    for (const post of data.posts || []) {
      await query(
        `INSERT INTO posts (id, user_id, content, image, video, location, celebration_type, celebrant_name, is_birthday, hashtags, likes_count, comments_count, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO NOTHING`,
        [
          post.id,
          post.userId,
          post.content || '',
          post.image || null,
          post.video || null,
          post.location || null,
          post.celebrationType || 'birthday',
          post.celebrantName || '',
          post.isBirthday || false,
          post.hashtags || [],
          post.likes || 0,
          post.comments || 0,
          post.createdAt || new Date().toISOString()
        ]
      );
    }
    console.log(`✅ Migrated ${data.posts?.length || 0} posts`);
    
    // Migrate comments
    console.log('📥 Migrating comments...');
    let commentCount = 0;
    for (const post of data.posts || []) {
      for (const comment of post.commentList || []) {
        await query(
          `INSERT INTO comments (post_id, user_id, text, likes_count, created_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            post.id,
            comment.userId || 1,
            comment.text || '',
            comment.likes || 0,
            comment.createdAt || new Date().toISOString()
          ]
        );
        commentCount++;
      }
    }
    console.log(`✅ Migrated ${commentCount} comments`);
    
    // Migrate wallets
    console.log('📥 Migrating wallets...');
    for (const [userId, wallet] of Object.entries(data.wallets || {})) {
      await query(
        `INSERT INTO wallets (user_id, balance, total_received, total_withdrawn)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO NOTHING`,
        [parseInt(userId), wallet.balance || 0, wallet.totalReceived || 0, wallet.totalWithdrawn || 0]
      );
    }
    console.log(`✅ Migrated ${Object.keys(data.wallets || {}).length} wallets`);
    
    // Migrate banners
    console.log('📥 Migrating banners...');
    for (const banner of data.banners || []) {
      await query(
        `INSERT INTO banners (id, title, subtitle, icon, colors, active, views_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          banner.id || 'banner_1',
          banner.title || 'Welcome to BirthdayApp!',
          banner.subtitle || 'Celebrate every moment',
          banner.icon || '🎂',
          banner.colors || ['#6366f1', '#8b5cf6', '#a855f7'],
          banner.active !== false,
          banner.views || 0
        ]
      );
    }
    console.log(`✅ Migrated ${data.banners?.length || 0} banners`);
    
    console.log('\n✅ All data migration complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

recreateAll();
