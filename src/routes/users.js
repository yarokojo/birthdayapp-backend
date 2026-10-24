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

// ============================================================
// PUT /api/users/profile - Update user profile
// ============================================================
app.put('/api/users/profile', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const userIndex = data.users.findIndex(u => u.id === userId || u.id === parseInt(userId));

    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { name, username, bio, location, phone, network, birth_date, birthDate, profile_image, profileImage } = req.body;
    const user = data.users[userIndex];

    // ✅ Check username only if it changed
    if (username && username.toLowerCase() !== user.username) {
      const exists = data.users.find(u => u.username === username.toLowerCase() && u.id !== user.id);
      if (exists) {
        return res.status(400).json({ error: 'Username already taken' });
      }
      user.username = username.toLowerCase();
    }

    if (name) user.name = name;
    if (bio !== undefined) user.bio = bio;
    if (location !== undefined) user.location = location;
    if (phone !== undefined) user.phone = phone;
    if (network !== undefined) user.network = network;
    
    // ✅ Only save the image if it's a valid URL (http/https), not a local file://
    const finalImage = profileImage || profile_image;
    if (finalImage && finalImage.startsWith('http')) {
      user.profileImage = finalImage;
    }

    // ✅ Format birth date safely
    const finalDate = birth_date || birthDate;
    if (finalDate) {
      user.birthDate = finalDate.split('T')[0];
    }

    saveData(); // Save to data.json

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      bio: user.bio,
      location: user.location,
      profile_image: user.profileImage,
      profileImage: user.profileImage,
      phone: user.phone,
      network: user.network,
      birth_date: user.birthDate,
      birthDate: user.birthDate,
      created_at: user.created_at
    });
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
