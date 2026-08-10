const { query } = require('./src/config/database');

async function fixPosts() {
  try {
    console.log('📝 Adding missing columns...');
    
    const columns = [
      'likes_count INTEGER DEFAULT 0',
      'comments_count INTEGER DEFAULT 0',
      'views_count INTEGER DEFAULT 0',
      'celebration_type VARCHAR(50) DEFAULT general',
      'celebrant_name VARCHAR(255)',
      'is_birthday BOOLEAN DEFAULT FALSE',
      'birthday_song_id VARCHAR(255)',
      'birthday_song_url TEXT',
      'birthday_song_name VARCHAR(255)',
      'location VARCHAR(255)',
      'image TEXT',
      'video TEXT',
      'music VARCHAR(255)',
      'hashtags TEXT[]'
    ];
    
    for (const col of columns) {
      try {
        const sql = 'ALTER TABLE posts ADD COLUMN IF NOT EXISTS ' + col;
        await query(sql, []);
        console.log('  Added ' + col.split(' ')[0]);
      } catch (e) {
        console.log('  Skip ' + col.split(' ')[0]);
      }
    }
    
    console.log('Getting test user...');
    const userResult = await query('SELECT id FROM users WHERE username = $1', ['testuser']);
    
    if (userResult.rows.length === 0) {
      console.log('Test user not found');
      return;
    }
    
    const userId = userResult.rows[0].id;
    console.log('User ID:', userId);
    
    const existing = await query('SELECT COUNT(*) FROM posts WHERE user_id = $1', [userId]);
    console.log('Existing posts:', existing.rows[0].count);
    
    if (parseInt(existing.rows[0].count) === 0) {
      const insertSql = 'INSERT INTO posts (user_id, content, celebration_type, celebrant_name, is_birthday, likes_count, comments_count) VALUES ($1, $2, $3, $4, $5, $6, $7)';
      await query(insertSql, [userId, 'Welcome to BirthdayApp!', 'birthday', 'Test User', true, 5, 2]);
      console.log('Sample post created!');
    } else {
      console.log('Posts already exist');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

fixPosts();
