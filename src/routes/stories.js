const express = require('express');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET / - Get all stories
// ============================================================
router.get('/', requireAuth, async (req, res) => {
  try {
    console.log('📸 Getting stories for user:', req.userId);

    // Get stories from users the current user follows + own stories
    const result = await query(
      `SELECT s.id, s.user_id, s.content_url, s.is_video, s.caption, 
              s.likes_count, s.views_count, s.created_at, s.expires_at,
              u.name as user_name, u.username, u.profile_image as user_avatar
       FROM stories s
       JOIN users u ON u.id = s.user_id
       WHERE s.expires_at > NOW()
       AND (s.user_id = $1 OR s.privacy = 'everyone')
       ORDER BY s.created_at DESC
       LIMIT 100`,
      [req.userId]
    );

    res.json({ stories: result.rows });
  } catch (error) {
    console.error('❌ Get stories error:', error);
    res.json({ stories: [] });
  }
});

// ============================================================
// POST / - Create a story
// ============================================================
router.post('/', requireAuth, async (req, res) => {
  try {
    const { contentUrl, isVideo, caption, privacy } = req.body;

    if (!contentUrl) {
      return res.status(400).json({ error: 'Content URL is required' });
    }

    const result = await query(
      `INSERT INTO stories (user_id, content_url, is_video, caption, privacy)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.userId, contentUrl, isVideo || false, caption || '', privacy || 'friends']
    );

    const story = result.rows[0];

    // Get user info
    const userResult = await query(
      'SELECT name, username, profile_image FROM users WHERE id = $1',
      [req.userId]
    );
    const user = userResult.rows[0] || { name: 'User', username: '@user', profile_image: 'https://randomuser.me/api/portraits/men/1.jpg' };

    res.status(201).json({
      story: {
        id: story.id,
        userId: story.user_id,
        userName: user.name,
        userAvatar: user.profile_image,
        contentUrl: story.content_url,
        isVideo: story.is_video,
        caption: story.caption,
        createdAt: story.created_at,
        expiresAt: story.expires_at,
        likesCount: story.likes_count || 0,
        viewsCount: story.views_count || 0,
      }
    });
  } catch (error) {
    console.error('❌ Create story error:', error);
    res.status(500).json({ error: 'Failed to create story' });
  }
});

// ============================================================
// POST /:id/like - Like a story
// ============================================================
router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Check if already liked
    const existing = await query(
      'SELECT id FROM story_likes WHERE story_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existing.rows.length === 0) {
      await query(
        'INSERT INTO story_likes (story_id, user_id) VALUES ($1, $2)',
        [id, userId]
      );
      await query(
        'UPDATE stories SET likes_count = likes_count + 1 WHERE id = $1',
        [id]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Like story error:', error);
    res.status(500).json({ error: 'Failed to like story' });
  }
});

// ============================================================
// DELETE /:id/like - Unlike a story
// ============================================================
router.delete('/:id/like', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    await query(
      'DELETE FROM story_likes WHERE story_id = $1 AND user_id = $2',
      [id, userId]
    );
    await query(
      'UPDATE stories SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1',
      [id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Unlike story error:', error);
    res.status(500).json({ error: 'Failed to unlike story' });
  }
});

// ============================================================
// POST /:id/view - Mark story as viewed
// ============================================================
router.post('/:id/view', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const existing = await query(
      'SELECT id FROM story_views WHERE story_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existing.rows.length === 0) {
      await query(
        'INSERT INTO story_views (story_id, user_id) VALUES ($1, $2)',
        [id, userId]
      );
      await query(
        'UPDATE stories SET views_count = views_count + 1 WHERE id = $1',
        [id]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ View story error:', error);
    res.status(500).json({ error: 'Failed to mark story as viewed' });
  }
});

// ============================================================
// DELETE /:id - Delete a story
// ============================================================
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const check = await query(
      'SELECT user_id FROM stories WHERE id = $1',
      [id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Story not found' });
    }

    if (check.rows[0].user_id !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await query('DELETE FROM stories WHERE id = $1', [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Delete story error:', error);
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

module.exports = router;
