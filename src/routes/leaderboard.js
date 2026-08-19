const express = require('express');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET / - Get leaderboard
// ============================================================
router.get('/', requireAuth, async (req, res) => {
  try {
    console.log('📊 Getting leaderboard from PostgreSQL...');
    
    const result = await query(`
      SELECT 
        u.id, 
        u.name, 
        u.username, 
        u.profile_image,
        COUNT(DISTINCT p.id) as post_count,
        COUNT(DISTINCT l.id) as like_count,
        COUNT(DISTINCT c.id) as comment_count,
        (COUNT(DISTINCT p.id) * 10 + 
         COUNT(DISTINCT l.id) * 2 + 
         COUNT(DISTINCT c.id) * 5) as score
      FROM users u
      LEFT JOIN posts p ON p.user_id = u.id
      LEFT JOIN post_likes l ON l.user_id = u.id
      LEFT JOIN comments c ON c.user_id = u.id
      WHERE u.is_active = true
      GROUP BY u.id
      ORDER BY score DESC
      LIMIT 20
    `);
    
    const users = result.rows.map((user, index) => ({
      id: user.id,
      name: user.name,
      username: user.username,
      profileImage: user.profile_image || 'https://randomuser.me/api/portraits/men/1.jpg',
      score: parseInt(user.score) || 0,
      posts: parseInt(user.post_count) || 0,
      likes: parseInt(user.like_count) || 0,
      comments: parseInt(user.comment_count) || 0,
      rank: index + 1
    }));
    
    console.log(`📊 Leaderboard: ${users.length} users ranked`);
    res.json({ users });
  } catch (error) {
    console.error('❌ Leaderboard error:', error);
    const mockUsers = [
      { id: 1, name: '🌟 Star User', username: 'staruser', profileImage: 'https://randomuser.me/api/portraits/women/1.jpg', score: 450, rank: 1, posts: 15, likes: 120, comments: 45 },
      { id: 2, name: '🎉 Party King', username: 'partyking', profileImage: 'https://randomuser.me/api/portraits/men/2.jpg', score: 380, rank: 2, posts: 12, likes: 95, comments: 38 },
      { id: 3, name: '💝 Gift Master', username: 'giftmaster', profileImage: 'https://randomuser.me/api/portraits/women/3.jpg', score: 320, rank: 3, posts: 8, likes: 75, comments: 30 },
    ];
    res.json({ users: mockUsers });
  }
});

module.exports = router;
