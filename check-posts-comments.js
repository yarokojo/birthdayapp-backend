const { query } = require('./src/config/database');

async function checkPosts() {
  try {
    console.log('📊 Checking posts and comments...');
    console.log('========================================');
    
    // Get all posts with comments
    const result = await query(`
      SELECT 
        p.id as post_id,
        p.content,
        p.comments_count,
        c.id as comment_id,
        c.text as comment_text,
        c.user_id,
        c.created_at
      FROM posts p
      LEFT JOIN comments c ON c.post_id = p.id
      ORDER BY p.created_at DESC, c.created_at ASC
    `);
    
    console.log(`✅ Found ${result.rows.length} rows`);
    console.log('----------------------------------------');
    
    // Group by post
    const posts = {};
    result.rows.forEach(row => {
      if (!posts[row.post_id]) {
        posts[row.post_id] = {
          id: row.post_id,
          content: row.content,
          comments_count: row.comments_count,
          comments: []
        };
      }
      if (row.comment_id) {
        // Check if comment already exists
        const exists = posts[row.post_id].comments.some(c => c.id === row.comment_id);
        if (!exists) {
          posts[row.post_id].comments.push({
            id: row.comment_id,
            text: row.comment_text,
            user_id: row.user_id,
            created_at: row.created_at
          });
        }
      }
    });
    
    Object.keys(posts).forEach(postId => {
      const post = posts[postId];
      console.log(`📝 Post ${postId}: "${post.content?.substring(0, 30)}"`);
      console.log(`   Comments: ${post.comments.length} (count: ${post.comments_count})`);
      post.comments.forEach(c => {
        console.log(`   - ${c.id}: "${c.text?.substring(0, 30)}"`);
      });
      console.log('----------------------------------------');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkPosts();
