const { query } = require('./src/config/database');

async function removeDuplicates() {
  try {
    console.log('🗑️ Removing duplicate comments...');
    console.log('========================================');
    
    // ✅ Remove duplicate comments (keep the first one)
    const result = await query(`
      DELETE FROM comments
      WHERE id IN (
        SELECT id FROM (
          SELECT 
            id,
            post_id,
            text,
            user_id,
            ROW_NUMBER() OVER (
              PARTITION BY post_id, text, user_id 
              ORDER BY created_at ASC
            ) as rn
          FROM comments
        ) t
        WHERE t.rn > 1
      )
    `);
    
    console.log(`✅ Removed duplicate comments`);
    
    // ✅ Update comment counts
    await query(`
      UPDATE posts p
      SET comments_count = (
        SELECT COUNT(*) FROM comments c
        WHERE c.post_id = p.id
      )
    `);
    
    console.log('✅ Updated comment counts');
    
    // ✅ Verify
    const verify = await query(`
      SELECT post_id, COUNT(*) as count
      FROM comments
      GROUP BY post_id
      ORDER BY post_id
    `);
    
    console.log('📊 Updated comment counts:');
    verify.rows.forEach(row => {
      console.log(`  Post ${row.post_id}: ${row.count} comments`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

removeDuplicates();
