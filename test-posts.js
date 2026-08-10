const { query } = require('./src/config/database');

async function testPosts() {
  try {
    console.log('🔍 Testing database connection...');
    const result = await query('SELECT COUNT(*) FROM posts;');
    console.log(`📊 Total posts in database: ${result.rows[0].count}`);
    
    const posts = await query('SELECT id, content, user_id, created_at FROM posts ORDER BY created_at DESC LIMIT 5;');
    console.log('📝 Recent posts:');
    posts.rows.forEach((p, i) => {
      console.log(`  ${i+1}. ${p.content?.substring(0, 30)}... (${p.user_id})`);
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testPosts();
