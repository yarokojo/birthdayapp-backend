const { query } = require('./src/config/database');

async function checkStructure() {
  try {
    console.log('📊 Checking database structure...\n');
    
    // Check comments table
    console.log('=== COMMENTS TABLE ===');
    try {
      const commentsResult = await query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'comments'
        ORDER BY ordinal_position
      `);
      
      if (commentsResult.rows.length === 0) {
        console.log('❌ Comments table does not exist!');
      } else {
        console.log('✅ Comments table exists:');
        commentsResult.rows.forEach(col => {
          console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
        });
      }
    } catch (error) {
      console.log('❌ Error checking comments table:', error.message);
    }
    
    console.log('\n=== POSTS TABLE ===');
    try {
      const postsResult = await query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'posts'
        ORDER BY ordinal_position
      `);
      
      if (postsResult.rows.length === 0) {
        console.log('❌ Posts table does not exist!');
      } else {
        console.log('✅ Posts table exists:');
        postsResult.rows.forEach(col => {
          console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
        });
      }
    } catch (error) {
      console.log('❌ Error checking posts table:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error checking structure:', error.message);
    console.log('\n💡 Make sure your database is running and DATABASE_URL is set correctly');
  }
}

checkStructure();
