const { query } = require('./src/config/database');

async function checkUser() {
  try {
    const result = await query('SELECT id, email, name FROM users WHERE email = $1', ['test@example.com']);
    if (result.rows.length === 0) {
      console.log('❌ User not found');
    } else {
      console.log('✅ User found:', result.rows[0]);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkUser();
