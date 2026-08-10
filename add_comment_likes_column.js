const { query } = require('./src/config/database');

async function addCommentLikesColumn() {
  try {
    console.log('📝 Adding likes_count column to comments table...');
    
    await query(`
      ALTER TABLE comments 
      ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0
    `);
    
    console.log('✅ likes_count column added to comments table');
  } catch (error) {
    console.error('❌ Error adding column:', error.message);
  }
}

addCommentLikesColumn();
