const { query } = require('./src/config/database');

async function verifyAll() {
  try {
    const users = await query('SELECT COUNT(*) FROM users');
    const posts = await query('SELECT COUNT(*) FROM posts');
    const comments = await query('SELECT COUNT(*) FROM comments');
    const banners = await query('SELECT COUNT(*) FROM banners');
    
    console.log('📊 PostgreSQL Data:');
    console.log('  👥 Users:', users.rows[0].count);
    console.log('  📝 Posts:', posts.rows[0].count);
    console.log('  💬 Comments:', comments.rows[0].count);
    console.log('  🎯 Banners:', banners.rows[0].count);
    
    // Show sample data
    if (posts.rows[0].count > 0) {
      const samplePost = await query('SELECT id, content FROM posts LIMIT 1');
      console.log('  📝 Sample post:', samplePost.rows[0]);
    }
    if (comments.rows[0].count > 0) {
      const sampleComment = await query('SELECT id, text FROM comments LIMIT 1');
      console.log('  💬 Sample comment:', sampleComment.rows[0]);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verifyAll();
