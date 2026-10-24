const express = require('express');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, username, profile_image, bio, location, birth_date
       FROM users WHERE is_active = true ORDER BY name ASC LIMIT 50`
    );
    res.json(result.rows);
  } catch (error) {
    res.json([]);
  }
});

router.get('/profile', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, email, name, username, bio, location, profile_image,
              phone, network, birth_date, created_at
       FROM users WHERE id = $1`,
      [req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { name, username, bio, location, phone, network, birth_date } = req.body;
    const userId = req.userId;

    // ✅ Check if the username is actually taken by SOMEONE ELSE
    let finalUsername = null;
    if (username) {
      const existing = await query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username.toLowerCase(), userId]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Username already taken' });
      }
      finalUsername = username.toLowerCase();
    }

    let cleanBirthDate = null;
    if (birth_date) {
      cleanBirthDate = birth_date.split('T')[0]; 
    }

    const fields = [];
    const values = [];
    let count = 1;

    if (name) { fields.push(`name = $${count++}`); values.push(name); }
    if (finalUsername) { fields.push(`username = $${count++}`); values.push(finalUsername); }
    if (bio !== undefined) { fields.push(`bio = $${count++}`); values.push(bio); }
    if (location !== undefined) { fields.push(`location = $${count++}`); values.push(location); }
    if (phone !== undefined) { fields.push(`phone = $${count++}`); values.push(phone); }
    if (network !== undefined) { fields.push(`network = $${count++}`); values.push(network); }
    if (cleanBirthDate) { fields.push(`birth_date = $${count++}`); values.push(cleanBirthDate); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(userId);
    const queryStr = `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${count} RETURNING id, email, name, username, bio, location, profile_image, phone, network, birth_date`;

    const result = await query(queryStr, values);

    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.get('/profile/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await query(
      `SELECT id, name, username, bio, location, profile_image, birth_date, phone, network, created_at FROM users WHERE id = $1`,
      [userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

router.post('/follow/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    if (parseInt(userId) === req.userId) return res.status(400).json({ error: 'Cannot follow yourself' });
    await query('INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.userId, userId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

router.delete('/follow/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    await query('DELETE FROM follows WHERE follower_id = $1 AND following_id = $2', [req.userId, userId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

router.get('/following', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.username, u.profile_image FROM follows f JOIN users u ON u.id = f.following_id WHERE f.follower_id = $1`,
      [req.userId]
    );
    res.json({ following: result.rows });
  } catch (error) {
    res.json({ following: [] });
  }
});

module.exports = router;
