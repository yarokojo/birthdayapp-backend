const { query } = require('./database');
const bcrypt = require('bcryptjs');

// ✅ Fixed UUID for MeolCompany
const MEOLCOMPANY_UUID = '00000000-0000-0000-0000-000000000001';

async function seedPlatformWallet() {
  try {
    console.log('🌱 Seeding MeolCompany wallet...');
    
    // ✅ First, check if MeolCompany user exists
    const userCheck = await query('SELECT id FROM users WHERE id = $1', [MEOLCOMPANY_UUID]);
    
    if (userCheck.rows.length === 0) {
      console.log('📝 Creating MeolCompany user...');
      
      // ✅ Create MeolCompany user
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await query(
        `INSERT INTO users (id, email, password_hash, name, username, phone, network, is_admin, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          MEOLCOMPANY_UUID,
          'admin@meolcompany.com',
          hashedPassword,
          'MeolCompany',
          'meolcompany',
          '0596270302',
          'MTN',
          true,  // is_admin
          true   // is_active
        ]
      );
      console.log('✅ MeolCompany user created');
    } else {
      console.log('✅ MeolCompany user already exists');
    }

    // ✅ Now create the wallet for MeolCompany
    const walletCheck = await query('SELECT id FROM wallets WHERE user_id = $1', [MEOLCOMPANY_UUID]);
    if (walletCheck.rows.length === 0) {
      await query(
        `INSERT INTO wallets (user_id, balance, total_received, total_withdrawn, total_fees_paid)
         VALUES ($1, $2, $3, $4, $5)`,
        [MEOLCOMPANY_UUID, 0, 0, 0, 0]
      );
      console.log(`✅ MeolCompany wallet created with UUID: ${MEOLCOMPANY_UUID}`);
    } else {
      console.log('✅ MeolCompany wallet already exists');
    }
    
    console.log('✅ MeolCompany setup complete!');
    console.log(`   Name: MeolCompany`);
    console.log(`   Phone: 0596270302`);
    console.log(`   Network: MTN`);
    console.log(`   UUID: ${MEOLCOMPANY_UUID}`);
    
  } catch (error) {
    console.error('❌ Failed to seed platform wallet:', error);
  }
}

module.exports = { seedPlatformWallet, MEOLCOMPANY_UUID };
