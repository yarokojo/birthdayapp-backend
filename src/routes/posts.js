const express = require('express');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET / - Get all posts with comments
// ============================================================
router.get('/', async (req, res) => {
  try {
    console.log('📝 Fetching all posts with comments...');
    
    const postsResult = await query(`
      SELECT 
        p.id,
        p.user_id as "userId",
        p.content,
        p.image,
        p.video,
        p.location,
        p.celebration_type as "celebrationType",
        p.celebrant_name as "celebrantName",
        p.is_birthday as "isBirthday",
        p.music,
        p.hashtags,
        p.birthday_song_id as "birthdaySongId",
        p.birthday_song_url as "birthdaySongUrl",
        p.birthday_song_name as "birthdaySongName",
        p.likes_count as likes,
        p.comments_count as comments,
        p.views_count as views,
        p.created_at as "createdAt",
        u.name as "authorName",
        u.username as "authorHandle",
        u.profile_image as "authorImage",
        u.phone,
        u.network
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.user_id IS NOT NULL
      ORDER BY p.created_at DESC
    `);
    
    console.log(`📝 Found ${postsResult.rows.length} posts`);
    
    // Get comments for ALL posts
    const postIds = postsResult.rows.map(p => p.id);
    let commentsMap = {};
    
    if (postIds.length > 0) {
      const commentsResult = await query(`
        SELECT 
          c.id,
          c.post_id,
          c.user_id,
          c.text,
          
          c.created_at,
          u.name as user_name,
          u.profile_image as user_avatar
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.post_id = ANY($1)
        ORDER BY c.created_at ASC
      `, [postIds]);
      
      console.log(`💬 Found ${commentsResult.rows.length} comments`);
      
      commentsMap = commentsResult.rows.reduce((acc, comment) => {
        const postId = comment.post_id;
        if (!acc[postId]) acc[postId] = [];
        acc[postId].push({
          id: comment.id,
          userId: comment.user_id,
          userName: comment.user_name || 'Anonymous',
          userAvatar: comment.user_avatar || 'https://randomuser.me/api/portraits/men/1.jpg',
          text: comment.text,
          createdAt: comment.created_at,
          likes: parseInt(comment.likes) || 0
        });
        return acc;
      }, {});
    }
    
    const posts = postsResult.rows.map(post => ({
      id: post.id,
      userId: post.userId,
      content: post.content || '',
      image: post.image,
      video: post.video,
      location: post.location,
      celebrationType: post.celebrationType || 'general',
      celebrantName: post.celebrantName || '',
      isBirthday: post.isBirthday || false,
      music: post.music,
      hashtags: post.hashtags || [],
      birthdaySongId: post.birthdaySongId,
      birthdaySongUrl: post.birthdaySongUrl,
      birthdaySongName: post.birthdaySongName,
      authorName: post.authorName || 'Unknown User',
      authorHandle: post.authorHandle || '@user',
      authorImage: post.authorImage || 'https://randomuser.me/api/portraits/men/1.jpg',
      phone: post.phone || '',
      network: post.network || 'MTN',
      likes: parseInt(post.likes) || 0,
      comments: parseInt(post.comments) || 0,
      views: parseInt(post.views) || 0,
      createdAt: post.createdAt,
      commentList: commentsMap[post.id] || []
    }));
    
    console.log(`📊 Total comments loaded: ${posts.reduce((sum, p) => sum + p.commentList.length, 0)}`);
    
    res.json(posts);
  } catch (error) {
    console.error('❌ Get posts error:', error);
    res.status(500).json([]);
  }
});

// ============================================================
// POST / - Create a new post
// ============================================================
router.post('/', requireAuth, async (req, res) => {
  try {
    const { 
      content, 
      image, 
      video, 
      location, 
      celebrationType, 
      celebrantName, 
      isBirthday, 
      music, 
      hashtags,
      birthdaySongId,
      birthdaySongUrl,
      birthdaySongName
    } = req.body;
    
    console.log('📝 Creating post for user:', req.userId);
    
    const result = await query(
      `INSERT INTO posts (
        user_id, content, image, video, location, celebration_type, 
        celebrant_name, is_birthday, music, hashtags, 
        birthday_song_id, birthday_song_url, birthday_song_name,
        likes_count, comments_count, views_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0, 0, 0)
      RETURNING *`,
      [
        req.userId, 
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
    
    const userResult = await query(
      'SELECT name, username, profile_image, phone, network FROM users WHERE id = $1',
      [req.userId]
    );
    const user = userResult.rows[0] || { 
      name: 'Unknown', 
      username: '@user', 
      profile_image: 'https://randomuser.me/api/portraits/men/1.jpg',
      phone: '',
      network: 'MTN'
    };
    
    const newPost = {
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
    };
    
    console.log(`✅ Post created: ${newPost.id}`);
    res.status(201).json(newPost);
  } catch (error) {
    console.error('❌ Create post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// ============================================================
// DELETE /:id - Delete a post
// ============================================================
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const check = await query(
      'SELECT user_id FROM posts WHERE id = $1',
      [id]
    );
    
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    if (check.rows[0].user_id !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    await query('DELETE FROM posts WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Delete post error:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// ============================================================
// POST /:id/like - Like a post
// ============================================================
router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await query(
      'SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2',
      [id, req.userId]
    );
    
    if (existing.rows.length === 0) {
      await query(
        'INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)',
        [id, req.userId]
      );
      await query(
        'UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1',
        [id]
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Like post error:', error);
    res.status(500).json({ error: 'Failed to like post' });
  }
});

// ============================================================
// DELETE /:id/like - Unlike a post
// ============================================================
router.delete('/:id/like', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    await query(
      'DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2',
      [id, req.userId]
    );
    await query(
      'UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1',
      [id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Unlike post error:', error);
    res.status(500).json({ error: 'Failed to unlike post' });
  }
});

// ============================================================
// POST /:id/comments - Add a comment
// ============================================================
router.post('/:id/comments', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const userId = req.userId;

    console.log('========================================');
    console.log(`💬 COMMENT REQUEST RECEIVED`);
    console.log(`📝 Post ID: ${id}`);
    console.log(`👤 User ID: ${userId}`);
    console.log(`📝 Comment: "${text}"`);
    console.log('========================================');

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const postCheck = await query('SELECT id, user_id FROM posts WHERE id = $1', [id]);
    if (postCheck.rows.length === 0) {
      console.log(`❌ Post not found: ${id}`);
      return res.status(404).json({ error: 'Post not found' });
    }
    const postUserId = postCheck.rows[0].user_id;

    // STRONG DUPLICATE PREVENTION
    const recentComments = await query(
      `SELECT id, user_id, text, created_at 
       FROM comments 
       WHERE post_id = $1 
       AND user_id = $2 
       AND created_at > NOW() - INTERVAL '5 seconds'
       ORDER BY created_at DESC`,
      [id, userId]
    );

    const duplicateFound = recentComments.rows.some(c => c.text === text.trim());
    if (duplicateFound) {
      console.log(`⚠️ DUPLICATE COMMENT REJECTED`);
      return res.status(429).json({ 
        success: false,
        error: 'Duplicate comment detected. Please wait a moment.' 
      });
    }

    if (recentComments.rows.length >= 3) {
      console.log(`⚠️ SPAM DETECTED`);
      return res.status(429).json({ 
        success: false,
        error: 'Too many comments. Please slow down.' 
      });
    }

    const userResult = await query(
      'SELECT name, profile_image FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0] || { 
      name: 'Anonymous', 
      profile_image: 'https://randomuser.me/api/portraits/men/1.jpg' 
    };

    const result = await query(
      `INSERT INTO comments (post_id, user_id, text)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id, userId, text.trim()]
    );

    await query(
      'UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1',
      [id]
    );

    const comment = result.rows[0];

    console.log(`✅ Comment added: ${comment.id}`);
    console.log('========================================');

    res.status(201).json({
      id: comment.id,
      userId: comment.user_id,
      userName: user.name,
      userAvatar: user.profile_image || 'https://randomuser.me/api/portraits/men/1.jpg',
      text: comment.text,
      createdAt: comment.created_at,
      likes: 0
    });

  } catch (error) {
    console.error('❌ Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// ============================================================
// ✅ PUT /:postId/comments/:commentId - Edit a comment
// ============================================================
router.put('/:postId/comments/:commentId', requireAuth, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { text } = req.body;
    const userId = req.userId;

    console.log('========================================');
    console.log(`✏️ EDIT COMMENT REQUEST RECEIVED`);
    console.log(`📝 Post ID: ${postId}`);
    console.log(`📝 Comment ID: ${commentId}`);
    console.log(`👤 User ID: ${userId}`);
    console.log(`📝 New Text: "${text}"`);
    console.log('========================================');

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    // ✅ Check if comment exists and belongs to user
    const checkResult = await query(
      `SELECT id, user_id, post_id, text FROM comments 
       WHERE id = $1 AND post_id = $2`,
      [commentId, postId]
    );

    if (checkResult.rows.length === 0) {
      console.log(`❌ Comment not found: ${commentId}`);
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (checkResult.rows[0].user_id !== userId) {
      console.log(`❌ User ${userId} not authorized to edit comment ${commentId}`);
      return res.status(403).json({ error: 'Not authorized to edit this comment' });
    }

    // ✅ Update comment
    const result = await query(
      `UPDATE comments 
       SET text = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 AND post_id = $3
       RETURNING id, text, created_at, updated_at`,
      [text.trim(), commentId, postId]
    );

    console.log(`✅ Comment ${commentId} updated successfully`);
    console.log(`   Old text: "${checkResult.rows[0].text}"`);
    console.log(`   New text: "${text.trim()}"`);
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

// ============================================================
// DELETE /:postId/comments/:commentId - Delete a comment
// ============================================================
router.delete('/:postId/comments/:commentId', requireAuth, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    
    const check = await query(
      'SELECT user_id FROM comments WHERE id = $1 AND post_id = $2',
      [commentId, postId]
    );
    
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    if (check.rows[0].user_id !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    await query('DELETE FROM comments WHERE id = $1', [commentId]);
    await query(
      'UPDATE posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = $1',
      [postId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// ============================================================
// POST /:id/bookmark - Bookmark a post
// ============================================================
router.post('/:id/bookmark', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await query(
      'SELECT id FROM bookmarks WHERE post_id = $1 AND user_id = $2',
      [id, req.userId]
    );
    
    if (existing.rows.length === 0) {
      await query(
        'INSERT INTO bookmarks (post_id, user_id) VALUES ($1, $2)',
        [id, req.userId]
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Bookmark post error:', error);
    res.status(500).json({ error: 'Failed to bookmark post' });
  }
});

// ============================================================
// DELETE /:id/bookmark - Unbookmark a post
// ============================================================
router.delete('/:id/bookmark', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    await query(
      'DELETE FROM bookmarks WHERE post_id = $1 AND user_id = $2',
      [id, req.userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Unbookmark post error:', error);
    res.status(500).json({ error: 'Failed to unbookmark post' });
  }
});

// ============================================================
// GET /:id/comments - Get comments for a post
// ============================================================
router.get('/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      `SELECT c.id, c.user_id, c.text,  c.created_at,
              u.name as user_name, u.profile_image as user_avatar
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC`,
      [id]
    );
    
    const comments = result.rows.map(c => ({
      id: c.id,
      userId: c.user_id,
      userName: c.user_name || 'Anonymous',
      userAvatar: c.user_avatar || 'https://randomuser.me/api/portraits/men/1.jpg',
      text: c.text,
      createdAt: c.created_at,
      likes: parseInt(c.likes) || 0
    }));
    
    res.json(comments);
  } catch (error) {
    console.error('❌ Get comments error:', error);
    res.json([]);
  }
});

module.exports = router;
