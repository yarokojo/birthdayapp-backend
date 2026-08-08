const bcrypt = require('bcryptjs');
const { query } = require('./src/config/database');

async function addCompleteAuthData() {
  console.log('📝 Adding complete authentication data...');

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

  // 2. Define users
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
      is_admin: false,
      bio: '🎉 Celebrating life every day!',
      location: 'Accra, Ghana'
    },
    {
      email: 'admin@example.com',
      password: 'admin123',
      name: 'Admin User',
      username: 'adminuser',
      phone: '0202226991',
      network: 'MTN',
      profile_image: 'https://randomuser.me/api/portraits/men/2.jpg',
      birth_date: '1985-01-01',
      is_admin: true,
      bio: '👑 Admin of BirthdayApp',
      location: 'Accra, Ghana'
    },
    {
      email: 'sarah@example.com',
      password: 'sarah123',
      name: 'Sarah Johnson',
      username: 'sarahj',
      phone: '0249876543',
      network: 'MTN',
      profile_image: 'https://randomuser.me/api/portraits/women/1.jpg',
      birth_date: '1992-03-20',
      is_admin: false,
      bio: '🌸 Celebrating life\'s special moments',
      location: 'Kumasi, Ghana'
    },
    {
      email: 'mike@example.com',
      password: 'mike123',
      name: 'Mike Chen',
      username: 'mikec',
      phone: '0551234567',
      network: 'AirtelTigo',
      profile_image: 'https://randomuser.me/api/portraits/men/3.jpg',
      birth_date: '1988-11-10',
      is_admin: false,
      bio: '🎵 Music & celebrations',
      location: 'Tema, Ghana'
    },
    {
      email: 'emma@example.com',
      password: 'emma123',
      name: 'Emma Davis',
      username: 'emmad',
      phone: '0205555555',
      network: 'Telecel',
      profile_image: 'https://randomuser.me/api/portraits/women/2.jpg',
      birth_date: '1995-07-25',
      is_admin: false,
      bio: '📸 Capturing moments',
      location: 'Accra, Ghana'
    }
  ];

  // 3. Add users
  console.log('📝 Adding users...');
  let createdCount = 0;
  let skippedCount = 0;

  for (const userData of users) {
    // Check if user exists by email
    const existing = await query('SELECT id, email FROM users WHERE email = $1', [userData.email]);
    
    if (existing.rows.length === 0) {
      // Check if username exists
      const usernameCheck = await query('SELECT id FROM users WHERE username = $1', [userData.username]);
      let finalUsername = userData.username;
      
      if (usernameCheck.rows.length > 0) {
        finalUsername = userData.username + '_' + Date.now().toString().slice(-4);
        console.log(`⚠️ Username ${userData.username} taken, using ${finalUsername}`);
      }
      
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const result = await query(
        `INSERT INTO users (email, password_hash, name, username, phone, network, profile_image, birth_date, is_admin, is_active, bio, location)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
          true,
          userData.bio || '',
          userData.location || 'Accra, Ghana'
        ]
      );
      console.log(`✅ User created: ${userData.email} (${userData.name})`);
      createdCount++;
      
      // Create wallet for user
      await query(
        `INSERT INTO wallets (user_id, balance, total_received, total_sent)
         VALUES ($1, 100, 0, 0)
         ON CONFLICT (user_id) DO NOTHING`,
        [result.rows[0].id]
      );
      console.log(`  ✅ Wallet created with ₵100`);
    } else {
      console.log(`⏭️ User already exists: ${userData.email}`);
      skippedCount++;
    }
  }

  // 4. Verify data
  console.log('📝 Verifying data...');
  const userCount = await query('SELECT COUNT(*) FROM users');
  const walletCount = await query('SELECT COUNT(*) FROM wallets');
  
  console.log(`✅ Total users: ${userCount.rows[0].count}`);
  console.log(`✅ Total wallets: ${walletCount.rows[0].count}`);

  console.log('');
  console.log('✅ Complete auth data added!');
  console.log('');
  console.log('📋 Test Accounts:');
  console.log('═══════════════════════════════════════════════');
  console.log('  👤 test@example.com  | test123  | Regular User');
  console.log('  👤 admin@example.com | admin123 | Admin');
  console.log('  👤 sarah@example.com | sarah123 | Regular User');
  console.log('  👤 mike@example.com  | mike123  | Regular User');
  console.log('  👤 emma@example.com  | emma123  | Regular User');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  console.log('  💰 Each user has ₵100 in their wallet');
  console.log(`  📊 Created: ${createdCount} new users, Skipped: ${skippedCount} existing`);
  
  process.exit(0);
}

addCompleteAuthData().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
