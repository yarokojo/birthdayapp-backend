// ============================================================
// ✅ POSTS ROUTES - PostgreSQL ONLY
// ============================================================

const express = require('express');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET / - Get all posts
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        p.*,
        u.name as author_name,
        u.username as author_handle,
        u.profile_image as author_image,
        u.phone,
        u.network
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `);
    
    // Get comments for each post
    const posts = [];
    for (const row of result.rows) {
      const commentsResult = await query(
        'SELECT * FROM comments WHERE post_id = $1 ORDER BY created_at ASC',
        [row.id]
      );
      
      posts.push({
        id: row.id,
        userId: row.user_id,
        content: row.content || '',
        image: row.image,
        video: row.video,
        location: row.location,
        celebrationType: row.celebration_type || 'general',
        celebrantName: row.celebrant_name || '',
        isBirthday: row.is_birthday || false,
        music: row.music,
        hashtags: row.hashtags || [],
        birthdaySongId: row.birthday_song_id,
        birthdaySongUrl: row.birthday_song_url,
        birthdaySongName: row.birthday_song_name,
        authorName: row.author_name || 'Unknown',
        authorHandle: row.author_handle || '@user',
        authorImage: row.author_image || 'https://randomuser.me/api/portraits/men/1.jpg',
        phone: row.phone || '',
        network: row.network || 'MTN',
        likes: parseInt(row.likes_count) || 0,
        comments: parseInt(row.comments_count) || 0,
        views: parseInt(row.views_count) || 0,
        createdAt: row.created_at,
        commentList: commentsResult.rows.map(c => ({
          id: c.id,
          userId: c.user_id,
          userName: c.user_name || 'Anonymous',
          userAvatar: c.user_avatar || 'https://randomuser.me/api/portraits/men/1.jpg',
          text: c.text,
          createdAt: c.created_at,
          likes: parseInt(c.likes_count) || 0
        }))
      });
    }
    
    res.json(posts);
  } catch (error) {
    console.error('❌ Get posts error:', error);
    res.status(500).json([]);
  }
});

// POST / - Create a post
router.post('/', requireAuth, async (req, res) => {
  try {
    const { 
      content, image, video, location, celebrationType, 
      celebrantName, isBirthday, music, hashtags,
      birthdaySongId, birthdaySongUrl, birthdaySongName
    } = req.body;
    
    const userId = req.userId;
    
    const result = await query(
      `INSERT INTO posts (user_id, content, image, video, location, celebration_type, celebrant_name, is_birthday, music, hashtags, birthday_song_id, birthday_song_url, birthday_song_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        userId, 
        content || '', 
        image || null, 
        video || null, 
        location || null, 
        celebrationType || 'general',
        celebrantName || '', 
        isBirthday || false, 
        music || null, 
        hashtags || [],
        birthdaySongId || null,
        birthdaySongUrl || null,
        birthdaySongName || null
      ]
    );
    
    const post = result.rows[0];
    
    // Get user info
    const userResult = await query(
      'SELECT name, username, profile_image, phone, network FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0];
    
    res.status(201).json({
      id: post.id,
      userId: post.user_id,
      content: post.content || '',
      image: post.image,
      video: post.video,
      location: post.location,
      celebrationType: post.celebration_type || 'general',
      celebrantName: post.celebrant_name || '',
      isBirthday: post.is_birthday || false,
      music: post.music,
      hashtags: post.hashtags || [],
      birthdaySongId: post.birthday_song_id,
      birthdaySongUrl: post.birthday_song_url,
      birthdaySongName: post.birthday_song_name,
      authorName: user.name,
      authorHandle: user.username,
      authorImage: user.profile_image || 'https://randomuser.me/api/portraits/men/1.jpg',
      phone: user.phone || '',
      network: user.network || 'MTN',
      likes: 0,
      comments: 0,
      views: 0,
      createdAt: post.created_at,
      commentList: []
    });
  } catch (error) {
    console.error('❌ Create post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// PUT /:postId/comments/:commentId - Edit a comment
router.put('/:postId/comments/:commentId', requireAuth, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { text } = req.body;
    const userId = req.userId;

    console.log('========================================');
    console.log(`✏️ EDIT COMMENT REQUEST (PostgreSQL)`);
    console.log(`📝 Post ID: ${postId}`);
    console.log(`📝 Comment ID: ${commentId}`);
    console.log(`👤 User ID: ${userId}`);
    console.log(`📝 New Text: "${text}"`);
    console.log('========================================');

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    // Check if comment exists and belongs to user
    const checkResult = await query(
      `SELECT id, user_id, post_id, text FROM comments
       WHERE id = $1 AND post_id = $2`,
      [parseInt(commentId), parseInt(postId)]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (checkResult.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update comment
    const result = await query(
      `UPDATE comments 
       SET text = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 AND post_id = $3
       RETURNING id, text, created_at, updated_at`,
      [text.trim(), parseInt(commentId), parseInt(postId)]
    );

    console.log(`✅ Comment updated`);
    console.log('========================================');

    res.json({
      success: true,
      comment: {
        id: result.rows[0].id,
        text: result.rows[0].text,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at
      }
    });

  } catch (error) {
    console.error('❌ Edit comment error:', error);
    res.status(500).json({ error: 'Failed to edit comment' });
  }
});

module.exports = router;
