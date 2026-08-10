const { query } = require('./src/config/database');

async function checkCalendar() {
  try {
    console.log('📝 Checking calendar_events table...');
    
    const result = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'calendar_events'
      )
    `);
    
    console.log('✅ Table exists:', result.rows[0].exists);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkCalendar();
