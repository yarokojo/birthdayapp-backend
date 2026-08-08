const { Pool } = require('pg');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || '';
console.log('📦 DATABASE_URL exists:', !!dbUrl);
console.log('📦 DATABASE_URL length:', dbUrl.length);
if (dbUrl) {
  console.log('📦 DATABASE_URL prefix:', dbUrl.substring(0, 30) + '...');
} else {
  console.log('❌ DATABASE_URL is missing!');
}

const isCloudDb = dbUrl.includes('neon.tech') || dbUrl.includes('render.com');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: isCloudDb ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 60000,
  keepAlive: true,
});

pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL error:', err.message);
});

// ✅ SIMPLE query function - no retry wrapper
const query = async (text, params) => {
  try {
    console.log('📝 SQL:', text.substring(0, 80) + (text.length > 80 ? '...' : ''));
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    console.error('❌ SQL Error:', error.message);
    console.error('📝 SQL:', text);
    throw error;
  }
};

module.exports = {
  query,
  pool,
};
