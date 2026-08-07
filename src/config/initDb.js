const { query } = require('./database');

const initDb = async () => {
  console.log('📦 Initializing database tables...');
  
  // ✅ Test database connection first
  try {
    const testResult = await query('SELECT NOW() as now');
    console.log('✅ Database connected! Time:', testResult.rows[0].now);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('❌ Full error:', error);
    return;
  }

  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      username VARCHAR(100) UNIQUE NOT NULL,
      bio TEXT,
      location VARCHAR(255),
      profile_image TEXT,
      phone VARCHAR(20),
      network VARCHAR(50),
      birth_date DATE,
      is_admin BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS wallets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      balance DECIMAL(10,2) DEFAULT 0,
      total_received DECIMAL(10,2) DEFAULT 0,
      total_sent DECIMAL(10,2) DEFAULT 0,
      total_withdrawn DECIMAL(10,2) DEFAULT 0,
      total_fees_paid DECIMAL(10,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  let count = 0;
  for (const sql of tables) {
    try {
      await query(sql);
      count++;
      console.log(`  ✅ Table ${count}/${tables.length} created`);
    } catch (error) {
      console.error(`  ❌ Error creating table: ${error.message}`);
    }
  }

  console.log(`✅ Database setup complete: ${count}/${tables.length} tables ready`);
};

module.exports = { initDb };
