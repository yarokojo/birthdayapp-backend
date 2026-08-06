const { Pool } = require('pg');
require('dotenv').config();

// ✅ Log the database URL (without password for security)
const dbUrl = process.env.DATABASE_URL || '';
console.log('📦 DATABASE_URL exists:', !!dbUrl);
console.log('📦 DATABASE_URL length:', dbUrl.length);
if (dbUrl) {
  console.log('📦 DATABASE_URL prefix:', dbUrl.substring(0, 30) + '...');
} else {
  console.log('❌ DATABASE_URL is missing!');
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: dbUrl.includes('render.com') ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL error:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
