const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Your Render database URL
const DATABASE_URL = 'postgresql://birthdayapp_user:5YWZeDaUhT8U0Z9WRz8Lj0y2amGX9oQm@dpg-d9rfq9740ujc73bcmdh0-a.oregon-postgres.render.com/birthdayapp_9rdu';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function addUser() {
  console.log('📝 Adding test user to Render database...');

  try {
    // Check if user already exists
    const check = await pool.query('SELECT id FROM users WHERE email = $1', ['test@example.com']);
    if (check.rows.length > 0) {
      console.log('✅ Test user already exists!');
      await pool.end();
      process.exit(0);
    }

    // Insert test user
    const hashedPassword = await bcrypt.hash('test123', 10);
    await pool.query(
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

    console.log('✅ Test user added to Render database!');
    console.log('   Email: test@example.com');
    console.log('   Password: test123');
    console.log('   Phone: 0244123456');
    console.log('   Network: MTN');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('   Stack:', error.stack);
    await pool.end();
    process.exit(1);
  }
}

addUser();
