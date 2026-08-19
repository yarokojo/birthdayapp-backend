const { query } = require('./database');
const bcrypt = require('bcryptjs');

async function checkUser6() {
  try {
    console.log('🔍 Checking user 6...');
    
    // Check if user exists
    const user = await query(
      'SELECT id, email, name, username, password_hash FROM users WHERE id = $1',
      [6]
    );
    
    if (user.rows.length === 0) {
      console.log('❌ User 6 not found');
      return;
    }
    
    console.log('✅ User found:', user.rows[0]);
    
    // Test password
    const testPassword = 'Yaro@123';
    const isValid = await bcrypt.compare(testPassword, user.rows[0].password_hash);
    console.log(`🔑 Password "${testPassword}" is ${isValid ? '✅ VALID' : '❌ INVALID'}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkUser6();
