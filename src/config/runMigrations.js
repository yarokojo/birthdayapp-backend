const { query } = require('./database');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  console.log('📦 Running database migrations...');
  
  try {
    const migrationPath = path.join(__dirname, '../migrations/001_create_users.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await query(sql);
    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration error:', error.message);
  }
}

module.exports = { runMigrations };
