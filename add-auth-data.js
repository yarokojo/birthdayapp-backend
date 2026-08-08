const bcrypt = require('bcryptjs');
const { query } = require('./src/config/database');

async function addAuthData() {
  console.log('📝 Adding authentication data to database...');

  // 1. Ensure tables exist
  console.log('📝 Ensuring users table exists...');
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
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
    )
  `);
  console.log('✅ Users table ready');

  console.log('📝 Ensuring wallets table exists...');
  await query(`
    CREATE TABLE IF NOT EXISTS wallets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      balance DECIMAL(10,2) DEFAULT 0,
      total_received DECIMAL(10,2) DEFAULT 0,
      total_sent DECIMAL(10,2) DEFAULT 0,
      total_withdrawn DECIMAL(10,2) DEFAULT 0,
      total_fees_paid DECIMAL(10,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Wallets table ready');

  // 2. Add test users (skip if exists)
  console.log('📝 Adding test users...');
  
  const users = [
    {
      email: 'test@example.com',
      password: 'test123',
      name: 'Test User',
      username: 'testuser',
      phone: '0244123456',
      network: 'MTN',
      profile_image: 'https://randomuser.me/api/portraits/men/1.jpg',
      birth_date: '1990-06-15',
      is_admin: false
    },
    {
      email: 'admin@example.com',
      password: 'admin123',
      name: 'Admin User',
      username: 'admin',
      phone: '0202226991',
      network: 'MTN',
      profile_image: 'https://randomuser.me/api/portraits/men/2.jpg',
      birth_date: '1985-01-01',
      is_admin: true
    },
    {
      email: 'user@example.com',
      password: 'user123',
      name: 'Regular User',
      username: 'regularuser',
      phone: '0551234567',
      network: 'Telecel',
      profile_image: 'https://randomuser.me/api/portraits/women/1.jpg',
      birth_date: '1995-03-10',
      is_admin: false
    }
  ];

  let createdCount = 0;
  let skippedCount = 0;

  for (const userData of users) {
    // Check if user exists by email
    const existing = await query('SELECT id, email FROM users WHERE email = $1', [userData.email]);
    
    if (existing.rows.length === 0) {
      // Check if username exists
      const usernameCheck = await query('SELECT id FROM users WHERE username = $1', [userData.username]);
      let finalUsername = userData.username;
      
      // If username exists, add a number
      if (usernameCheck.rows.length > 0) {
        finalUsername = userData.username + '_' + Date.now().toString().slice(-4);
        console.log(`⚠️ Username ${userData.username} taken, using ${finalUsername}`);
      }
      
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const result = await query(
        `INSERT INTO users (email, password_hash, name, username, phone, network, profile_image, birth_date, is_admin, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          userData.email,
          hashedPassword,
          userData.name,
          finalUsername,
          userData.phone,
          userData.network,
          userData.profile_image,
          userData.birth_date,
          userData.is_admin,
          true
        ]
      );
      console.log(`✅ User created: ${userData.email} (${userData.name})`);
      createdCount++;
      
      // Create wallet for user
      await query(
        `INSERT INTO wallets (user_id, balance)
         VALUES ($1, 100)
         ON CONFLICT (user_id) DO NOTHING`,
        [result.rows[0].id]
      );
      console.log(`  ✅ Wallet created for ${userData.name}`);
    } else {
      console.log(`⏭️ User already exists: ${userData.email}`);
      skippedCount++;
    }
  }

  // 3. Verify users
  console.log('📝 Verifying users...');
  const userCount = await query('SELECT COUNT(*) FROM users');
  console.log(`✅ Total users in database: ${userCount.rows[0].count}`);
  
  const walletCount = await query('SELECT COUNT(*) FROM wallets');
  console.log(`✅ Total wallets in database: ${walletCount.rows[0].count}`);

  console.log('');
  console.log('✅ Authentication data check complete!');
  console.log(`   Created: ${createdCount} users`);
  console.log(`   Skipped: ${skippedCount} existing users`);
  console.log('');
  console.log('📋 Test Accounts:');
  console.log('   ─────────────────────────────────────────────');
  console.log('   👤 test@example.com / test123 (Regular User)');
  console.log('   👤 admin@example.com / admin123 (Admin)');
  console.log('   👤 user@example.com / user123 (Regular User)');
  console.log('   ─────────────────────────────────────────────');
  
  process.exit(0);
}

addAuthData().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
