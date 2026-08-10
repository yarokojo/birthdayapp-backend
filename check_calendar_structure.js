const { query } = require('./src/config/database');

async function checkStructure() {
  try {
    console.log('📝 Checking calendar_events table structure...');
    
    const result = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'calendar_events'
      ORDER BY ordinal_position
    `);
    
    console.log('📊 Table columns:');
    result.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkStructure();
