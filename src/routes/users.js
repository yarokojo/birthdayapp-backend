const express = require('express');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET / - Get all users (for user search/list)
// ============================================================
router.get('/', requireAuth, async (req, res) => {
  try {
    console.log('👥 Getting all users');
    
    const result = await query(
      `SELECT id, name, username, profile_image, bio, location, birth_date
       FROM users
       WHERE is_active = true
       ORDER BY name ASC
       LIMIT 50`
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Get users error:', error);
    res.json([]);
  }
});

// ============================================================
// GET /profile - Get current user's profile
// ============================================================
router.get('/profile', requireAuth, async (req, res) => {
  try {
    console.log('👤 Getting profile for user:', req.userId);
    
    const result = await query(
      `SELECT id, email, name, username, bio, location, profile_image,
              phone, network, birth_date, created_at
       FROM users
       WHERE id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// ============================================================
// PUT /profile - Update current user's profile
// ============================================================
router.put('/profile', requireAuth, async (req, res) => {
  try {
    console.log('📝 Updating profile for user:', req.userId);
    
    const { name, username, bio, location, profile_image, phone, network, birth_date } = req.body;
    const userId = req.userId;

    if (username) {
      const existing = await query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username.toLowerCase(), userId]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    const fields = [];
    const values = [];
    let paramCount = 1;

    const fieldMap = { name, username, bio, location, profile_image, phone, network, birth_date };
    for (const [key, value] of Object.entries(fieldMap)) {
      if (value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(key === 'username' ? value.toLowerCase() : value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(userId);
    const queryStr = `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING id, email, name, username, bio, location, profile_image, phone, network, birth_date`;

    const result = await query(queryStr, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ============================================================
// GET /search - Search users
// ============================================================
router.get('/search', requireAuth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json([]);
    }

    const searchTerm = `%${q.toLowerCase()}%`;
    const result = await query(
      `SELECT id, name, username, profile_image, birth_date, phone, network
       FROM users
       WHERE (LOWER(name) LIKE $1 OR LOWER(username) LIKE $1)
       AND id != $2
       LIMIT 20`,
      [searchTerm, req.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// ============================================================
// GET /profile/:userId - Get another user's profile
// ============================================================
router.get('/profile/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await query(
      `SELECT id, name, username, bio, location, profile_image, birth_date,
              phone, network, created_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const postCount = await query('SELECT COUNT(*) FROM posts WHERE user_id = $1', [userId]);
    const followerCount = await query('SELECT COUNT(*) FROM follows WHERE following_id = $1', [userId]);
    const followingCount = await query('SELECT COUNT(*) FROM follows WHERE follower_id = $1', [userId]);
    const isFollowing = await query('SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2', [req.userId, userId]);

    res.json({
      ...user,
      postsCount: parseInt(postCount.rows[0].count),
      followersCount: parseInt(followerCount.rows[0].count),
      followingCount: parseInt(followingCount.rows[0].count),
      isFollowing: isFollowing.rows.length > 0
    });
  } catch (error) {
    console.error('❌ Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// ============================================================
// POST /follow/:userId - Follow a user
// ============================================================
router.post('/follow/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId === req.userId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }
    await query('INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.userId, userId]);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Follow error:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

// ============================================================
// DELETE /follow/:userId - Unfollow a user
// ============================================================
router.delete('/follow/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    await query('DELETE FROM follows WHERE follower_id = $1 AND following_id = $2', [req.userId, userId]);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Unfollow error:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

module.exports = router;
