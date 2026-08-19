const { Pool } = require('pg');
require('dotenv').config();

// ✅ Use local PostgreSQL connection (NO SSL)
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'birthdayapp',
  user: 'u0_a347',  // Your Termux username
  password: '',     // No password for local
  ssl: false,       // ✅ DISABLE SSL for local
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
});

pool.on('connect', () => console.log('✅ Connected to PostgreSQL'));
pool.on('error', (err) => console.error('❌ PostgreSQL error:', err.message));

function query(text, params) {
  return pool.query(text, params);
}

module.exports = {
  query,
  pool,
};
