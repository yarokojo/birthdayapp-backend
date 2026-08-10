const bcrypt = require('bcryptjs');
const { query } = require('./src/config/database');

async function createUser() {
  try {
    const hash = await bcrypt.hash('test123', 10);
    console.log('📝 New hash:', hash);
    
    const email = 'test@example.com';
    const name = 'Test User';
    const username = 'testuser';
    const phone = '0244123456';
    const network = 'MTN';
    const birthDate = '1990-06-15';
    const isActive = true;
    
    const result = await query(
      'INSERT INTO users (email, password_hash, name, username, phone, network, birth_date, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [email, hash, name, username, phone, network, birthDate, isActive]
    );
    
    console.log('✅ User created with ID:', result.rows[0].id);
    
    await query('INSERT INTO wallets (user_id, balance) VALUES ($1, 100)', [result.rows[0].id]);
    console.log('✅ Wallet created with ₵100');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createUser();
