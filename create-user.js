const bcrypt = require('bcryptjs');
const { query } = require('./src/config/database');

async function createUser() {
  try {
    // Check if user exists
    const existing = await query('SELECT id, username FROM users WHERE email = $1', ['test@example.com']);
    
    if (existing.rows.length > 0) {
      console.log('✅ User already exists:', existing.rows[0]);
      // Update password
      const hashedPassword = await bcrypt.hash('test123', 10);
      await query('UPDATE users SET password_hash = $1 WHERE email = $2', [hashedPassword, 'test@example.com']);
      console.log('✅ Password updated for test@example.com');
      return;
    }
    
    // Create new user with unique username
    const hashedPassword = await bcrypt.hash('test123', 10);
    const result = await query(
      'INSERT INTO users (email, password_hash, name, username, phone, network, birth_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      ['test@example.com', hashedPassword, 'Test User', 'testuser123', '0244123456', 'MTN', '1990-06-15']
    );
    
    console.log('✅ User created: test@example.com / test123');
    console.log('✅ Username: testuser123');
    
    // Create wallet
    await query('INSERT INTO wallets (user_id, balance) VALUES ($1, $2)', [result.rows[0].id, 100]);
    console.log('✅ Wallet created with ₵100');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createUser();
