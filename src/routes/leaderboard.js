const express = require('express');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET / - Get leaderboard
// ============================================================
router.get('/', requireAuth, async (req, res) => {
  try {
    const { timeframe } = req.query;
    console.log(`📊 Getting leaderboard for timeframe: ${timeframe || 'week'}`);
    
    let timeFilter = "created_at > NOW() - INTERVAL '7 days'";
    if (timeframe === 'month') {
      timeFilter = "created_at > NOW() - INTERVAL '30 days'";
    } else if (timeframe === 'all') {
      timeFilter = "1=1";
    }
    
    const result = await query(`
      SELECT 
        u.id, 
        u.name, 
        u.username, 
        u.profile_image,
        COUNT(DISTINCT p.id) as post_count,
        COUNT(DISTINCT l.id) as like_count,
        COUNT(DISTINCT c.id) as comment_count,
        (COUNT(DISTINCT p.id) * 10 + COUNT(DISTINCT l.id) * 2 + COUNT(DISTINCT c.id) * 5) as score
      FROM users u
      LEFT JOIN posts p ON p.user_id = u.id AND p.created_at > NOW() - INTERVAL '7 days'
      LEFT JOIN post_likes l ON l.user_id = u.id AND l.created_at > NOW() - INTERVAL '7 days'
      LEFT JOIN comments c ON c.user_id = u.id AND c.created_at > NOW() - INTERVAL '7 days'
      WHERE u.is_active = true
      GROUP BY u.id
      ORDER BY score DESC
      LIMIT 20
    `);
    
    // Add rank
    const users = result.rows.map((user, index) => ({
      ...user,
      rank: index + 1,
      score: parseInt(user.score) || 0
    }));
    
    res.json({ users });
  } catch (error) {
    console.error('❌ Get leaderboard error:', error);
    // Return mock data if query fails
    res.json({ users: [] });
  }
});

module.exports = router;
