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

// ✅ FIXED: query function with proper parameter handling
const query = async (text, params) => {
  try {
    // ✅ Ensure params is an array
    const safeParams = Array.isArray(params) ? params : [];
    console.log('📝 SQL:', text);
    console.log('📝 Params:', safeParams);
    const result = await pool.query(text, safeParams);
    return result;
  } catch (error) {
    console.error('❌ SQL Error:', error.message);
    console.error('📝 SQL:', text);
    console.error('📝 Params:', params);
    throw error;
  }
};

module.exports = {
  query,
  pool,
};
