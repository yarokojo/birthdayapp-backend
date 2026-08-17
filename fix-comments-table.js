const { query } = require('./src/config/database');

async function fixCommentsTable() {
  try {
    console.log('📝 Fixing comments table...');
    
    // Check posts table structure
    const postsCheck = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'posts'
    `);
    console.log('📊 Posts table columns:');
    postsCheck.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    // Drop the existing comments table with CASCADE
    console.log('📝 Dropping comments table...');
    await query(`DROP TABLE IF EXISTS comments CASCADE`);
    console.log('✅ Dropped comments table');
    
    // Recreate comments table with correct types
    console.log('📝 Recreating comments table...');
    await query(`
      CREATE TABLE comments (
        id SERIAL PRIMARY KEY,
        post_id VARCHAR(255) REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        likes_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Comments table recreated');
    
    // Create indexes
    await query(`CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id)`);
    console.log('✅ Indexes created');
    
    // Migrate existing comments from backup
    console.log('\n📥 Migrating comments from backup...');
    const fs = require('fs');
    let data = null;
    
    // Try multiple backup locations
    const backupFiles = ['backups/data.json', 'data.json.backup', 'data.json'];
    for (const file of backupFiles) {
      try {
        if (fs.existsSync(file)) {
          data = JSON.parse(fs.readFileSync(file, 'utf8'));
          console.log(`📥 Using ${file}`);
          break;
        }
      } catch (e) {
        // Continue to next file
      }
    }
    
    if (!data) {
      console.log('⚠️ No backup found, skipping comment migration');
      return;
    }
    
    let migrated = 0;
    for (const post of data.posts || []) {
      for (const comment of post.commentList || []) {
        await query(
          `INSERT INTO comments (post_id, user_id, text, likes_count, created_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            post.id,
            comment.userId || 1,
            comment.text || '',
            comment.likes || 0,
            comment.createdAt || new Date().toISOString()
          ]
        );
        migrated++;
      }
    }
    console.log(`✅ Migrated ${migrated} comments`);
    
    // Verify
    const count = await query('SELECT COUNT(*) FROM comments');
    console.log(`📊 Total comments in database: ${count.rows[0].count}`);
    
    console.log('\n✅ Comments table fixed!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

fixCommentsTable();
