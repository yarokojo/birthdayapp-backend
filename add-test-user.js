const bcrypt = require('bcryptjs');
const { query } = require('./src/config/database');

async function addUser() {
  console.log('📝 Adding test user to database...');

  // Check if user already exists
  const check = await query('SELECT id FROM users WHERE email = $1', ['test@example.com']);
  if (check.rows.length > 0) {
    console.log('✅ Test user already exists in database!');
    process.exit(0);
  }

  // Insert test user
  const hashedPassword = await bcrypt.hash('test123', 10);
  await query(
    `INSERT INTO users (email, password_hash, name, username, phone, network, profile_image, birth_date, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
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

  console.log('✅ Test user added to database!');
  console.log('   Email: test@example.com');
  console.log('   Password: test123');
  process.exit(0);
}

addUser().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
