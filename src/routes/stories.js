const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ✅ Setup multer for file uploads
const uploadDir = path.join(__dirname, '../uploads/stories');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('📁 Created stories upload directory');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'story-' + uniqueSuffix + ext);
  }
});

// ✅ File filter - allow both images and videos
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images and videos are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: fileFilter,
});

// ============================================================
// GET / - Get all stories
// ============================================================
router.get('/', requireAuth, async (req, res) => {
  try {
    console.log('📸 Getting stories for user:', req.userId);

    // Check if stories table exists
    try {
      const tableCheck = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'stories'
        )
      `);
      
      if (!tableCheck.rows[0].exists) {
        console.log('📸 Stories table does not exist yet');
        return res.json({ stories: [] });
      }
    } catch (e) {
      console.log('📸 Error checking stories table:', e.message);
      return res.json({ stories: [] });
    }

    const result = await query(`
      SELECT s.id, s.user_id, s.content_url, s.is_video, s.caption, 
             s.likes_count, s.views_count, s.created_at, s.expires_at,
             s.is_birthday, s.celebrant_name,
             u.name as user_name, u.username, u.profile_image as user_avatar
      FROM stories s
      JOIN users u ON u.id = s.user_id
      WHERE s.expires_at > NOW()
      AND (s.user_id = $1 OR s.privacy = 'everyone' OR s.privacy IS NULL)
      ORDER BY s.created_at DESC
      LIMIT 100
    `, [req.userId]);

    res.json({ stories: result.rows });
  } catch (error) {
    console.error('❌ Get stories error:', error);
    res.json({ stories: [] });
  }
});

// ============================================================
// POST / - Create a story with file upload
// ============================================================
router.post('/', requireAuth, upload.single('content'), async (req, res) => {
  console.log('🔴🔴🔴 STORY CREATE ROUTE HIT');
  console.log('📸 User ID:', req.userId);
  console.log('📸 File:', req.file);
  console.log('📸 Body:', req.body);
  console.log('📸 Headers:', req.headers['content-type']);

  try {
    // ✅ Check if file was uploaded
    if (!req.file) {
      console.log('❌ No file uploaded');
      return res.status(400).json({ error: 'No image or video file uploaded' });
    }

    const { isVideo, caption, isBirthday, celebrantName, privacy } = req.body;
    const userId = req.userId;
    
    // ✅ Determine if it's a video
    const isVideoBool = isVideo === 'true' || isVideo === true;
    
    // ✅ Build the URL for the uploaded file
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:5000';
    const contentUrl = `${protocol}://${host}/uploads/stories/${req.file.filename}`;

    console.log('📸 Content URL:', contentUrl);
    console.log('📸 Is Video:', isVideoBool);

    // ✅ Set expiry to 24 hours from now
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // ✅ Check if stories table exists, create if not
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS stories (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          content_url TEXT NOT NULL,
          is_video BOOLEAN DEFAULT FALSE,
          caption TEXT,
          likes_count INTEGER DEFAULT 0,
          views_count INTEGER DEFAULT 0,
          is_birthday BOOLEAN DEFAULT FALSE,
          celebrant_name VARCHAR(255),
          privacy VARCHAR(50) DEFAULT 'friends',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
        )
      `);
      console.log('✅ Stories table verified/created');
    } catch (tableError) {
      console.error('❌ Error creating stories table:', tableError);
    }

    // ✅ Insert the story
    const result = await query(`
      INSERT INTO stories (user_id, content_url, is_video, caption, is_birthday, celebrant_name, privacy, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      userId, 
      contentUrl, 
      isVideoBool, 
      caption || '', 
      isBirthday === 'true' || isBirthday === true,
      celebrantName || '',
      privacy || 'friends',
      expiresAt
    ]);

    const story = result.rows[0];

    // ✅ Get user info for response
    const userResult = await query(
      'SELECT name, username, profile_image FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0] || { 
      name: 'User', 
      username: '@user', 
      profile_image: 'https://randomuser.me/api/portraits/men/1.jpg' 
    };

    console.log('✅ Story created:', story.id);

    res.status(201).json({
      story: {
        id: story.id,
        userId: story.user_id,
        userName: user.name,
        userHandle: user.username,
        userAvatar: user.profile_image,
        contentUrl: story.content_url,
        isVideo: story.is_video,
        caption: story.caption,
        isBirthday: story.is_birthday,
        celebrantName: story.celebrant_name,
        createdAt: story.created_at,
        expiresAt: story.expires_at,
        likesCount: story.likes_count || 0,
        viewsCount: story.views_count || 0,
      }
    });

  } catch (error) {
    console.error('❌ Create story error:', error);
    console.error('❌ Error stack:', error.stack);
    
    // ✅ If file was uploaded but database failed, clean up the file
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
        console.log('🗑️ Deleted orphaned file:', req.file.path);
      } catch (e) {
        console.log('⚠️ Could not delete orphaned file:', e.message);
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to create story: ' + (error.message || 'Unknown error')
    });
  }
});

// ============================================================
// POST /:id/like - Like a story
// ============================================================
router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Check if story_likes table exists
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS story_likes (
          id SERIAL PRIMARY KEY,
          story_id INTEGER REFERENCES stories(id) ON DELETE CASCADE,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(story_id, user_id)
        )
      `);
    } catch (e) {
      console.log('⚠️ Story likes table check failed:', e.message);
    }

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

    // Check if story_views table exists
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS story_views (
          id SERIAL PRIMARY KEY,
          story_id INTEGER REFERENCES stories(id) ON DELETE CASCADE,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(story_id, user_id)
        )
      `);
    } catch (e) {
      console.log('⚠️ Story views table check failed:', e.message);
    }

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
  console.log('🔴🔴🔴 DELETE STORY ROUTE HIT!');
  console.log('🔴 Story ID:', req.params.id);
  console.log('🔴 User ID:', req.userId);

  try {
    const { id } = req.params;
    const userId = req.userId;

    // Check if story exists and belongs to user
    const check = await query(
      'SELECT user_id, content_url FROM stories WHERE id = $1',
      [id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Story not found' });
    }

    if (check.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // ✅ Delete the file from storage if it exists
    const contentUrl = check.rows[0].content_url;
    if (contentUrl) {
      try {
        // Extract filename from URL
        const filename = contentUrl.split('/').pop();
        if (filename) {
          const filePath = path.join(__dirname, '../uploads/stories', filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log('🗑️ Deleted story file:', filePath);
          }
        }
      } catch (e) {
        console.log('⚠️ Could not delete story file:', e.message);
      }
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
