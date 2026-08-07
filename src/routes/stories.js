const express = require('express');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET / - Get all stories
// ============================================================
router.get('/', requireAuth, async (req, res) => {
  try {
    console.log('📸 Fetching stories...');
    
    const result = await query(
      `SELECT s.id, s.user_id, s.content_url, s.is_video, s.caption, s.privacy,
              s.likes_count, s.views_count, s.created_at, s.expires_at,
              u.name as user_name, u.username as user_handle, u.profile_image as user_avatar
       FROM stories s
       LEFT JOIN users u ON u.id = s.user_id
       WHERE s.expires_at > NOW()
       ORDER BY s.created_at DESC`
    );
    
    console.log(`📸 Found ${result.rows.length} stories`);
    
    // Check if current user has viewed each story
    const stories = [];
    for (const story of result.rows) {
      const viewed = await query(
        'SELECT id FROM story_views WHERE story_id = $1 AND user_id = $2',
        [story.id, req.userId]
      );
      
      stories.push({
        id: story.id,
        userId: story.user_id,
        userName: story.user_name || 'User',
        userHandle: story.user_handle || '@user',
        userAvatar: story.user_avatar || 'https://randomuser.me/api/portraits/men/1.jpg',
        contentUrl: story.content_url,
        isVideo: story.is_video || false,
        caption: story.caption || '',
        timestamp: story.created_at,
        expiresAt: story.expires_at,
        seen: viewed.rows.length > 0,
        viewers: story.views_count || 0,
        liked: false,
        likes: story.likes_count || 0,
        privacy: story.privacy || 'friends'
      });
    }
    
    res.json({ success: true, stories });
  } catch (error) {
    console.error('❌ Get stories error:', error);
    res.json({ success: true, stories: [] });
  }
});

// ============================================================
// POST / - Create a story
// ============================================================
router.post('/', requireAuth, async (req, res) => {
  try {
    const { contentUrl, isVideo, caption, privacy } = req.body;
    console.log(`📸 Creating story for user: ${req.userId}`);
    
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
      success: true,
      story: {
        id: story.id,
        userId: story.user_id,
        userName: user.name,
        userHandle: user.username,
        userAvatar: user.profile_image,
        contentUrl: story.content_url,
        isVideo: story.is_video,
        caption: story.caption,
        timestamp: story.created_at,
        expiresAt: story.expires_at,
        seen: false,
        viewers: 0,
        liked: false,
        likes: 0,
        privacy: story.privacy
      }
    });
  } catch (error) {
    console.error('❌ Create story error:', error);
    res.status(500).json({ error: 'Failed to create story' });
  }
});

// ============================================================
// POST /seen - Mark story as seen
// ============================================================
router.post('/seen', requireAuth, async (req, res) => {
  try {
    const { storyId } = req.body;
    console.log(`👁️ Marking story ${storyId} as seen by user ${req.userId}`);
    
    await query(
      'INSERT INTO story_views (story_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [storyId, req.userId]
    );
    
    // Increment views count
    await query(
      'UPDATE stories SET views_count = views_count + 1 WHERE id = $1',
      [storyId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Mark seen error:', error);
    res.json({ success: true });
  }
});

// ============================================================
// GET /seen/:userId - Get seen stories for user
// ============================================================
router.get('/seen/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`👁️ Getting seen stories for user: ${userId}`);
    
    const result = await query(
      'SELECT story_id FROM story_views WHERE user_id = $1',
      [userId]
    );
    
    const seenStoryIds = result.rows.map(row => row.story_id);
    res.json({ success: true, seenStoryIds });
  } catch (error) {
    console.error('❌ Get seen stories error:', error);
    res.json({ success: true, seenStoryIds: [] });
  }
});

// ============================================================
// POST /:id/like - Like a story
// ============================================================
router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`❤️ Liking story: ${id}`);
    
    await query(
      'UPDATE stories SET likes_count = likes_count + 1 WHERE id = $1',
      [id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Like story error:', error);
    res.json({ success: true });
  }
});

// ============================================================
// DELETE /:id/like - Unlike a story
// ============================================================
router.delete('/:id/like', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`💔 Unliking story: ${id}`);
    
    await query(
      'UPDATE stories SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1',
      [id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Unlike story error:', error);
    res.json({ success: true });
  }
});

// ============================================================
// DELETE /:id - Delete a story
// ============================================================
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ Deleting story: ${id}`);
    
    const result = await query(
      'DELETE FROM stories WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Story not found or not authorized' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Delete story error:', error);
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

module.exports = router;
