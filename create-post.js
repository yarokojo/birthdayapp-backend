const { query } = require('./src/config/database');

async function createPost() {
  try {
    console.log('📝 Getting test user...');
    const userResult = await query('SELECT id FROM users WHERE username = $1', ['testuser']);
    
    if (userResult.rows.length === 0) {
      console.log('❌ Test user not found');
      return;
    }
    
    const userId = userResult.rows[0].id;
    console.log('✅ User ID:', userId);
    
    console.log('📝 Checking existing posts...');
    const existing = await query('SELECT COUNT(*) FROM posts WHERE user_id = $1', [userId]);
    console.log('📊 Existing posts:', existing.rows[0].count);
    
    if (parseInt(existing.rows[0].count) > 0) {
      console.log('✅ Posts already exist');
      return;
    }
    
    console.log('📝 Creating sample post...');
    const postResult = await query(
      'INSERT INTO posts (user_id, content, celebration_type, celebrant_name, is_birthday, likes_count, comments_count) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [userId, 'Welcome to BirthdayApp!', 'birthday', 'Test User', true, 5, 2]
    );
    
    console.log('✅ Post created! ID:', postResult.rows[0].id);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createPost();
