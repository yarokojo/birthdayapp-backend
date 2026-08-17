const { query } = require('./src/config/database');

async function fixBannersTable() {
  try {
    console.log('📝 Fixing banners table to use TEXT IDs...');
    
    // Check if table exists
    const checkTable = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'banners'
      )
    `);
    
    if (!checkTable.rows[0].exists) {
      console.log('📝 Creating banners table with TEXT ID...');
      await query(`
        CREATE TABLE banners (
          id TEXT PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          subtitle TEXT,
          icon VARCHAR(50),
          colors TEXT[],
          active BOOLEAN DEFAULT TRUE,
          views_count INTEGER DEFAULT 0,
          clicks_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Banners table created with TEXT ID');
    } else {
      console.log('📝 Banners table exists, checking columns...');
      
      // Drop and recreate with TEXT ID
      await query(`DROP TABLE IF EXISTS banners CASCADE`);
      console.log('📝 Recreating banners table with TEXT ID...');
      await query(`
        CREATE TABLE banners (
          id TEXT PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          subtitle TEXT,
          icon VARCHAR(50),
          colors TEXT[],
          active BOOLEAN DEFAULT TRUE,
          views_count INTEGER DEFAULT 0,
          clicks_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Banners table recreated with TEXT ID');
    }
    
    console.log('✅ Banners table fixed!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixBannersTable();
