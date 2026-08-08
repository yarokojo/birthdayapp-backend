const bcrypt = require('bcryptjs');
const { query } = require('./src/config/database');

async function addUser() {
  console.log('📝 Adding test user to Render database...');

  try {
    // Check if user already exists
    const check = await query('SELECT id FROM users WHERE email = $1', ['test@example.com']);
    if (check.rows.length > 0) {
      console.log('✅ Test user already exists!');
      process.exit(0);
    }

    // Insert test user
    const hashedPassword = await bcrypt.hash('test123', 10);
    await query(
      `INSERT INTO users (email, password_hash, name, username, phone, network, profile_image, birth_date, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        'test@example.com',
        hashedPassword,
        'Test User',
        'testuser',
        '0244123456',
        'MTN',
        'https://randomuser.me/api/portraits/men/1.jpg',
        '1990-06-15',
        true
      ]
    );

    console.log('✅ Test user added to Render database!');
    console.log('   Email: test@example.com');
    console.log('   Password: test123');
    console.log('   Phone: 0244123456');
    console.log('   Network: MTN');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

addUser();
