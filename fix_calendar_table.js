const { query } = require('./src/config/database');

async function fixCalendarTable() {
  try {
    console.log('📝 Fixing calendar_events table (converting to INTEGER IDs)...');
    
    // Drop the old table
    await query(`DROP TABLE IF EXISTS calendar_events CASCADE`);
    console.log('✅ Dropped old table');
    
    // Create new table with INTEGER IDs
    await query(`
      CREATE TABLE calendar_events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        type VARCHAR(50) DEFAULT 'birthday',
        celebrant_name VARCHAR(255),
        celebrant_id VARCHAR(255),
        reminder_set BOOLEAN DEFAULT FALSE,
        reminder_time TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ calendar_events table recreated with INTEGER IDs');
    
    // Add indexes
    await query(`CREATE INDEX idx_calendar_events_user_id ON calendar_events(user_id)`);
    await query(`CREATE INDEX idx_calendar_events_date ON calendar_events(date)`);
    console.log('✅ Indexes created');
    
  } catch (error) {
    console.error('❌ Error fixing calendar_events table:', error.message);
  }
}

fixCalendarTable();
