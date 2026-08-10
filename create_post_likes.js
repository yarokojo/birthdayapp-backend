const { query } = require('./src/config/database');

async function createPostLikesTable() {
  try {
    console.log('📝 Creating post_likes table with INTEGER IDs...');
    
    await query(`
      CREATE TABLE IF NOT EXISTS post_likes (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_id)
      )
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id)
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id)
    `);
    
    console.log('✅ post_likes table created successfully!');
  } catch (error) {
    console.error('❌ Error creating post_likes table:', error.message);
  }
}

createPostLikesTable();
