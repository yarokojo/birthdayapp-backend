const { query } = require('./src/config/database');

async function createBookmarksTable() {
  try {
    console.log('📝 Creating bookmarks table...');
    
    await query(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_id)
      )
    `);
    
    console.log('✅ bookmarks table created successfully!');
  } catch (error) {
    console.error('❌ Error creating bookmarks table:', error.message);
  }
}

createBookmarksTable();
