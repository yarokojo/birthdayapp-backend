const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Setup multer for file uploads
const uploadDir = path.join(__dirname, '../uploads');
const storiesDir = path.join(uploadDir, 'stories');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(storiesDir)) fs.mkdirSync(storiesDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, storiesDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'story-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'), false);
    }
  }
});

// GET / - Get all stories
router.get('/', requireAuth, async (req, res) => {
  try {
    console.log('📸 Getting stories for user:', req.userId);

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

// POST / - Create a story with file upload
router.post('/', requireAuth, upload.single('content'), async (req, res) => {
  console.log('🔴🔴🔴 STORY CREATE HIT');
  console.log('📸 User ID:', req.userId);
  console.log('📸 File:', req.file);
  console.log('📸 Body:', req.body);
  console.log('📸 Headers:', req.headers['content-type']);
  
  try {
    if (!req.file) {
      console.log('❌ No file uploaded');
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const { isVideo, caption, privacy } = req.body;
    const isVideoBool = isVideo === 'true' || isVideo === true;
    
    const protocol = req.protocol;
    const host = req.get('host');
    const contentUrl = `${protocol}://${host}/uploads/stories/${req.file.filename}`;

    console.log('📸 Content URL:', contentUrl);

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = await query(
      `INSERT INTO stories (user_id, content_url, is_video, caption, privacy, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.userId, contentUrl, isVideoBool, caption || '', privacy || 'everyone', expiresAt]
    );

    const story = result.rows[0];

    const userResult = await query(
      'SELECT name, username, profile_image FROM users WHERE id = $1',
      [req.userId]
    );
    const user = userResult.rows[0] || { name: 'User', username: '@user', profile_image: 'https://randomuser.me/api/portraits/men/1.jpg' };

    console.log('✅ Story created:', story.id);

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
    res.status(500).json({ error: 'Failed to create story: ' + error.message });
  }
});

// POST /:id/like - Like a story
router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

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

// DELETE /:id/like - Unlike a story
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

// POST /:id/view - Mark story as viewed
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

// DELETE /:id - Delete a story
router.delete('/:id', requireAuth, async (req, res) => {
  console.log('🔴🔴🔴 DELETE ROUTE HIT! ID:', req.params.id);
  console.log('🔴 User ID:', req.userId);
  
  try {
    const id = parseInt(req.params.id);
    const userId = req.userId;

    console.log(`🗑️ Deleting story ${id} for user ${userId}`);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid story ID' });
    }

    const check = await query(
      'SELECT user_id FROM stories WHERE id = $1',
      [id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Story not found' });
    }

    if (check.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await query('DELETE FROM stories WHERE id = $1', [id]);

    console.log(`✅ Story ${id} deleted successfully`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Delete story error:', error);
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

module.exports = router;
