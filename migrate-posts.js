const fs = require('fs');
const { query } = require('./src/config/database');

async function migratePosts() {
  try {
    console.log('📝 Migrating posts from data.json to PostgreSQL...');
    
    const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
    const posts = data.posts || [];
    
    let migrated = 0;
    
    for (const post of posts) {
      try {
        // Check if post exists
        const check = await query('SELECT id FROM posts WHERE id = $1', [parseInt(post.id)]);
        
        if (check.rows.length === 0) {
          // Insert post
          await query(
            `INSERT INTO posts (id, user_id, content, image, video, location, celebration_type, celebrant_name, is_birthday, music, hashtags, likes_count, comments_count, views_count, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
            [
              parseInt(post.id),
              post.userId,
              post.content || '',
              post.image || null,
              post.video || null,
              post.location || null,
              post.celebrationType || 'general',
              post.celebrantName || '',
              post.isBirthday || false,
              post.music || null,
              post.hashtags || [],
              post.likes || 0,
              post.comments || 0,
              post.views || 0,
              post.createdAt || new Date().toISOString(),
              post.updatedAt || post.createdAt || new Date().toISOString()
            ]
          );
          console.log('✅ Added post', post.id, '-', post.content || '(no content)');
          migrated++;
        } else {
          console.log('⏭️ Post', post.id, 'already exists');
        }
      } catch (error) {
        console.error('❌ Failed to add post', post.id, ':', error.message);
      }
    }
    
    console.log('✅ Migration complete! Added:', migrated, 'posts');
    
    const result = await query('SELECT COUNT(*) FROM posts');
    console.log('Total posts in PostgreSQL:', result.rows[0].count);
    
  } catch (error) {
    console.error('❌ Migration error:', error.message);
  }
}

migratePosts();
