const express = require('express');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET / - Get all stories from DATABASE ONLY - NO MOCK DATA
// ============================================================
router.get('/', async (req, res) => {
  try {
    console.log('📸 GET /stories - Querying database...');
    
    const result = await query(`
      SELECT 
        s.id,
        s.user_id,
        s.content_url,
        s.is_video,
        s.caption,
        s.privacy,
        s.likes_count,
        s.views_count,
        s.created_at,
        s.expires_at,
        u.name,
        u.username,
        u.profile_image
      FROM stories s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.expires_at > NOW()
      ORDER BY s.created_at DESC
      LIMIT 50
    `);
    
    console.log(`📸 Found ${result.rows.length} stories in database`);
    
    const stories = result.rows.map(s => ({
      id: s.id,
      userId: s.user_id,
      userName: s.name || 'User',
      userHandle: s.username || '@user',
      userAvatar: s.profile_image || 'https://randomuser.me/api/portraits/men/1.jpg',
      contentUrl: s.content_url,
      isVideo: s.is_video || false,
      caption: s.caption || '',
      timestamp: s.created_at,
      expiresAt: s.expires_at,
      seen: false,
      viewers: parseInt(s.views_count) || 0,
      liked: false,
      likes: parseInt(s.likes_count) || 0,
      privacy: s.privacy || 'friends'
    }));
    
    // ✅ Return only what's in the database - NO MOCK DATA
    res.json({ stories });
  } catch (error) {
    console.error('❌ GET /stories error:', error);
    // ✅ Return empty array on error - NO MOCK DATA
    res.status(500).json({ error: 'Failed to fetch stories', stories: [] });
  }
});

// ============================================================
// POST / - Create a story
// ============================================================
router.post('/', requireAuth, async (req, res) => {
  try {
    const { contentUrl, isVideo, caption, privacy } = req.body;
    const userId = req.userId;
    
    console.log(`📸 POST /stories - Creating story for user ${userId}`);
    
    if (!contentUrl) {
      return res.status(400).json({ error: 'Content URL is required' });
    }
    
    const userResult = await query(
      'SELECT name, username, profile_image FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0];
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const result = await query(
      `INSERT INTO stories (user_id, content_url, is_video, caption, privacy)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at, expires_at`,
      [userId, contentUrl, isVideo || false, caption || '', privacy || 'friends']
    );
    
    const story = result.rows[0];
    
    console.log(`✅ Story created: ${story.id}`);
    
    res.status(201).json({
      success: true,
      story: {
        id: story.id,
        userId: userId,
        userName: user.name,
        userHandle: user.username,
        userAvatar: user.profile_image || 'https://randomuser.me/api/portraits/men/1.jpg',
        contentUrl: contentUrl,
        isVideo: isVideo || false,
        caption: caption || '',
        timestamp: story.created_at,
        expiresAt: story.expires_at,
        seen: false,
        viewers: 0,
        liked: false,
        likes: 0,
        privacy: privacy || 'friends'
      }
    });
  } catch (error) {
    console.error('❌ POST /stories error:', error);
    res.status(500).json({ error: 'Failed to create story' });
  }
});

// ============================================================
// POST /seen - Mark story as seen
// ============================================================
router.post('/seen', requireAuth, async (req, res) => {
  try {
    const { storyId } = req.body;
    const userId = req.userId;
    
    console.log(`👁️ POST /seen - Marking story ${storyId} as seen`);
    
    await query(
      `INSERT INTO story_views (story_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (story_id, user_id) DO NOTHING`,
      [storyId, userId]
    );
    
    await query(
      'UPDATE stories SET views_count = views_count + 1 WHERE id = $1',
      [storyId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ POST /seen error:', error);
    res.status(500).json({ error: 'Failed to mark story seen' });
  }
});

// ============================================================
// GET /seen/:userId - Get seen story IDs
// ============================================================
router.get('/seen/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log(`👁️ GET /seen/${userId} - Getting seen stories`);
    
    const result = await query(
      'SELECT story_id FROM story_views WHERE user_id = $1',
      [userId]
    );
    
    const seenStoryIds = result.rows.map(r => r.story_id);
    console.log(`👁️ Found ${seenStoryIds.length} seen stories`);
    
    res.json({ seenStoryIds });
  } catch (error) {
    console.error('❌ GET /seen error:', error);
    res.status(500).json({ error: 'Failed to get seen stories', seenStoryIds: [] });
  }
});

// ============================================================
// POST /:id/like - Like a story
// ============================================================
router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    console.log(`❤️ POST /${id}/like - Liking story`);
    
    await query(
      `INSERT INTO story_likes (story_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (story_id, user_id) DO NOTHING`,
      [id, userId]
    );
    
    await query(
      'UPDATE stories SET likes_count = likes_count + 1 WHERE id = $1',
      [id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ POST /:id/like error:', error);
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
    
    console.log(`💔 DELETE /${id}/like - Unliking story`);
    
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
    console.error('❌ DELETE /:id/like error:', error);
    res.status(500).json({ error: 'Failed to unlike story' });
  }
});

// ============================================================
// DELETE /:id - Delete a story
// ============================================================
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    console.log(`🗑️ DELETE /${id} - Deleting story`);
    
    await query(
      'DELETE FROM stories WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ DELETE /:id error:', error);
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

module.exports = router;
