const { query } = require('./src/config/database');

async function checkPosts() {
  try {
    console.log('📊 Checking posts table structure...');
    
    const result = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'posts'
      ORDER BY ordinal_position
    `);
    
    console.log('✅ Posts table columns:');
    result.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkPosts();
