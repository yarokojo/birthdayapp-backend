const { query } = require('./src/config/database');

async function fixPosts() {
  try {
    console.log('📝 Fixing posts table to use BIGINT...');
    
    // Drop foreign key constraints first
    console.log('📌 Dropping foreign key constraints...');
    await query('ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_user_id_fkey');
    
    // Check if comments table exists and drop its constraints
    try {
      await query('ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_post_id_fkey');
      await query('ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_user_id_fkey');
    } catch (e) {
      console.log('⚠️ No comments table constraints to drop');
    }
    
    // Drop and recreate posts table with BIGINT
    console.log('📌 Recreating posts table with BIGINT...');
    await query('DROP TABLE IF EXISTS posts CASCADE');
    
    await query(`
      CREATE TABLE posts (
        id BIGINT PRIMARY KEY,
        user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
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
    console.log('✅ Posts table recreated with BIGINT');
    
    // Recreate comments table with BIGINT
    console.log('📌 Recreating comments table with BIGINT...');
    await query(`
      CREATE TABLE comments (
        id BIGINT PRIMARY KEY,
        post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
        user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        likes_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Comments table recreated with BIGINT');
    
    // Create indexes
    console.log('📌 Creating indexes...');
    await query('CREATE INDEX idx_posts_user_id ON posts(user_id)');
    await query('CREATE INDEX idx_posts_created_at ON posts(created_at)');
    await query('CREATE INDEX idx_comments_post_id ON comments(post_id)');
    await query('CREATE INDEX idx_comments_user_id ON comments(user_id)');
    console.log('✅ Indexes created');
    
    console.log('✅ Database fixed! All ID columns are now BIGINT');
    console.log('📊 Now you can migrate your data from data.json');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixPosts();
