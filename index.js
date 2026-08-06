const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

// ✅ Import routes
const authRoutes = require('./src/routes/auth');

const app = express();
const PORT = process.env.PORT || 5000;

console.log('✅ Starting BirthdayApp API...');
console.log(`📦 PORT: ${PORT}`);

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  credentials: true,
}));

app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================================
// ROUTES
// ============================================================
app.get('/', (req, res) => {
  res.json({
    message: '🎉 BirthdayApp API',
    version: '2.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

console.log('📋 Registering routes...');
app.use('/api/auth', authRoutes);
console.log('  ✅ /api/auth registered');

// ============================================================
// 404 Handler
// ============================================================
app.use((req, res) => {
  console.log(`❌ 404: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Endpoint not found' });
});

// ============================================================
// Error Handler
// ============================================================
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log('✅ All routes registered!');
  console.log('  /api/auth - Auth routes');
});
// FORCE DEPLOY - Thu Aug  6 13:54:57 GMT 2026
