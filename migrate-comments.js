const fs = require('fs');
const { query } = require('./src/config/database');

async function migrateComments() {
  try {
    console.log('📝 Migrating comments from data.json to PostgreSQL...');
    
    // Read data.json
    const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
    const posts = data.posts || [];
    
    let migrated = 0;
    
    for (const post of posts) {
      const commentList = post.commentList || [];
      
      for (const comment of commentList) {
        try {
          // Insert comment into PostgreSQL
          await query(
            'INSERT INTO comments (id, post_id, user_id, text, likes_count, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [
              parseInt(comment.id),
              parseInt(post.id),
              comment.userId,
              comment.text,
              comment.likes || 0,
              comment.createdAt || new Date().toISOString(),
              comment.updatedAt || comment.createdAt || new Date().toISOString()
            ]
          );
          
          console.log('✅ Migrated comment', comment.id, '-', comment.text);
          migrated++;
        } catch (error) {
          console.error('❌ Failed to migrate comment', comment.id, ':', error.message);
        }
      }
    }
    
    console.log('✅ Migration complete! Migrated:', migrated, 'comments');
    
    // Verify
    const result = await query('SELECT COUNT(*) FROM comments');
    console.log('Total comments in PostgreSQL:', result.rows[0].count);
    
  } catch (error) {
    console.error('❌ Migration error:', error.message);
  }
}

migrateComments();
