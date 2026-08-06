const express = require('express');
const { query } = require('../config/database');
const { requireAuth, isAdmin } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET /stats - Get admin stats
// ============================================================
router.get('/stats', requireAuth, isAdmin, async (req, res) => {
  try {
    const userCount = await query('SELECT COUNT(*) FROM users');
    const postCount = await query('SELECT COUNT(*) FROM posts');
    const giftCount = await query('SELECT COUNT(*) FROM gifts');
    
    const activeUsers = await query(
      "SELECT COUNT(DISTINCT user_id) FROM posts WHERE created_at > NOW() - INTERVAL '7 days'"
    );
    
    const newUsersToday = await query(
      "SELECT COUNT(*) FROM users WHERE created_at::date = CURRENT_DATE"
    );
    
    const totalFees = await query(
      'SELECT COALESCE(SUM(total_fees_paid), 0) FROM wallets'
    );
    
    const totalRevenue = await query(
      'SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = \'withdrawal\''
    );

    res.json({
      userCount: parseInt(userCount.rows[0].count),
      postCount: parseInt(postCount.rows[0].count),
      giftCount: parseInt(giftCount.rows[0].count),
      activeUsers: parseInt(activeUsers.rows[0].count),
      newUsersToday: parseInt(newUsersToday.rows[0].count),
      totalFees: parseFloat(totalFees.rows[0].coalesce),
      totalRevenue: parseFloat(totalRevenue.rows[0].coalesce),
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = router;
