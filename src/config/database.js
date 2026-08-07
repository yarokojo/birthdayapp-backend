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
  idleTimeoutMillis: 60000,        // ✅ Increased to 60s
  connectionTimeoutMillis: 60000,   // ✅ Increased to 60s
  keepAlive: true,                  // ✅ Keep connections alive
});

pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL error:', err.message);
});

// ✅ Add retry logic for queries
const queryWithRetry = async (text, params, retries = 3) => {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      const result = await pool.query(text, params);
      return result;
    } catch (error) {
      lastError = error;
      console.log(`⚠️ Query failed (attempt ${i + 1}/${retries}):`, error.message);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  throw lastError;
};

module.exports = {
  query: queryWithRetry,
  pool,
};
