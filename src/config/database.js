const { Pool } = require('pg');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || '';

if (!dbUrl) {
  console.error('❌ DATABASE_URL is missing!');
  process.exit(1);
}

console.log('📦 DATABASE_URL exists: true');
console.log('📦 DATABASE_URL length:', dbUrl.length);

// Create pool
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
});

pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL error:', err.message);
});

// ✅ DIRECT QUERY FUNCTION - NO MODIFICATIONS
const query = (text, params) => {
  return pool.query(text, params);
};

module.exports = {
  query,
  pool,
};
