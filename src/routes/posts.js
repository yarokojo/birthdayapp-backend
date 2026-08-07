const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET / - Get all posts with comments
// ============================================================
router.get('/', optionalAuth, async (req, res) => {
  try {
    console.log('📊 Fetching posts...');
    console.log('📊 User ID:', req.userId || 'Not authenticated');
    console.log('📊 User:', req.user || 'Not authenticated');
    
    // ✅ Check if posts table exists
    const tableCheck = await query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'posts')"
    );
    console.log('📊 Posts table exists:', tableCheck.rows[0].exists);

    const result = await query(
      `SELECT 
        p.*,
        u.name as author_name,
        u.username as author_handle,
        u.profile_image as author_image,
        u.phone,
        u.network
       FROM posts p
       LEFT JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC`
    );

    console.log(`✅ Found ${result.rows.length} posts`);
    
    const postsWithComments = await Promise.all(result.rows.map(async (post) => {
      const commentsResult = await query(
        `SELECT c.id, c.user_id, c.text, c.created_at, c.likes_count,
                u.name as user_name, u.profile_image as user_avatar
         FROM comments c
         LEFT JOIN users u ON u.id = c.user_id
         WHERE c.post_id = $1
         ORDER BY c.created_at DESC`,
        [post.id]
      );
      
      const comments = commentsResult.rows.map(c => ({
        id: c.id,
        userId: c.user_id,
        userName: c.user_name || 'Anonymous',
        userAvatar: c.user_avatar || 'https://randomuser.me/api/portraits/men/1.jpg',
        text: c.text,
        createdAt: c.created_at,
        likes: c.likes_count || 0,
      }));
      
      let isLiked = false;
      if (req.userId) {
        const likeResult = await query(
          'SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2',
          [post.id, req.userId]
        );
        isLiked = likeResult.rows.length > 0;
      }
      
      return {
        id: post.id,
        userId: post.user_id,
        content: post.content,
        image: post.image,
        video: post.video,
        location: post.location,
        celebrationType: post.celebration_type,
        celebrantName: post.celebrant_name,
        isBirthday: post.is_birthday,
        music: post.music,
        hashtags: post.hashtags || [],
        likes: parseInt(post.likes_count) || 0,
        comments: parseInt(post.comments_count) || 0,
        views: parseInt(post.views_count) || 0,
        createdAt: post.created_at,
        authorName: post.author_name || 'Unknown',
        authorHandle: post.author_handle || 'unknown',
        authorImage: post.author_image || 'https://randomuser.me/api/portraits/men/1.jpg',
        phone: post.phone || '',
        network: post.network || 'MTN',
        commentList: comments,
        isLiked: isLiked,
        isBookmarked: false,
        birthdaySongId: post.birthday_song_id,
        birthdaySongUrl: post.birthday_song_url,
        birthdaySongName: post.birthday_song_name,
      };
    }));
    
    console.log(`✅ Returning ${postsWithComments.length} posts with comments`);
    res.json(postsWithComments);
  } catch (error) {
    console.error('❌ Get posts error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to get posts', details: error.message });
  }
});

// ============================================================
// POST / - Create a post
// ============================================================
router.post('/', requireAuth, [
  body('content').optional(),
  body('image').optional(),
  body('video').optional(),
], async (req, res) => {
  try {
    console.log('📝 Creating post...');
    console.log('📝 User ID:', req.userId);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { 
      content, image, video, location, celebrationType, 
      celebrantName, isBirthday, hashtags, music,
      birthdaySongId, birthdaySongUrl, birthdaySongName 
    } = req.body;

    if (!content && !image && !video) {
      return res.status(400).json({ error: 'Post must have content or media' });
    }

    const result = await query(
      `INSERT INTO posts (
        user_id, content, image, video, location, celebration_type,
        celebrant_name, is_birthday, hashtags, music,
        birthday_song_id, birthday_song_url, birthday_song_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        req.userId, content, image, video, location,
        celebrationType || 'birthday',
        celebrantName,
        isBirthday || celebrationType === 'birthday',
        hashtags || [],
        music || null,
        birthdaySongId || null,
        birthdaySongUrl || null,
        birthdaySongName || null
      ]
    );

    const post = result.rows[0];

    const userResult = await query(
      'SELECT name, username, profile_image FROM users WHERE id = $1',
      [req.userId]
    );
    const user = userResult.rows[0] || { name: 'Unknown', username: 'unknown', profile_image: 'https://randomuser.me/api/portraits/men/1.jpg' };

    console.log('✅ Post created:', post.id);
    res.status(201).json({
      ...post,
      authorName: user.name,
      authorHandle: user.username,
      authorImage: user.profile_image,
      commentList: [],
    });
  } catch (error) {
    console.error('❌ Create post error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to create post', details: error.message });
  }
});

// ============================================================
// DELETE /:id - Delete a post
// ============================================================
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      'DELETE FROM posts WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found or not authorized' });
    }
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
    const postCheck = await query('SELECT id FROM posts WHERE id = $1', [id]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    try {
      await query('INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)', [id, req.userId]);
    } catch (e) {}
    await query('UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1', [id]);
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
    await query('DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2', [id, req.userId]);
    await query('UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Unlike post error:', error);
    res.status(500).json({ error: 'Failed to unlike post' });
  }
});

// ============================================================
// POST /:id/comments - Add a comment
// ============================================================
router.post('/:id/comments', requireAuth, [
  body('text').notEmpty().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }
    const { id } = req.params;
    const { text } = req.body;

    const postCheck = await query('SELECT id FROM posts WHERE id = $1', [id]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const result = await query(
      `INSERT INTO comments (post_id, user_id, text)
       VALUES ($1, $2, $3)
       RETURNING id, post_id, user_id, text, created_at, likes_count`,
      [id, req.userId, text.trim()]
    );

    await query('UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1', [id]);

    const comment = result.rows[0];
    const userResult = await query(
      'SELECT name, profile_image FROM users WHERE id = $1',
      [req.userId]
    );
    const user = userResult.rows[0] || { name: 'Unknown', profile_image: 'https://randomuser.me/api/portraits/men/1.jpg' };

    res.status(201).json({
      id: comment.id,
      userId: comment.user_id,
      userName: user.name,
      userAvatar: user.profile_image,
      text: comment.text,
      createdAt: comment.created_at,
      likes: comment.likes_count || 0,
    });
  } catch (error) {
    console.error('❌ Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

module.exports = router;

// ============================================================
// DELETE /:postId/comments/:commentId - Delete a comment
// ============================================================
router.delete('/:postId/comments/:commentId', requireAuth, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.userId;

    console.log(`🗑️ Deleting comment ${commentId} from post ${postId} by user ${userId}`);

    // Check if comment exists and belongs to user
    const commentResult = await query(
      'SELECT user_id FROM comments WHERE id = $1 AND post_id = $2',
      [commentId, postId]
    );

    if (commentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const comment = commentResult.rows[0];

    // Check if user is the comment author or post owner
    const postResult = await query(
      'SELECT user_id FROM posts WHERE id = $1',
      [postId]
    );

    const postOwnerId = postResult.rows[0]?.user_id;

    if (comment.user_id !== userId && postOwnerId !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    // Delete the comment
    await query(
      'DELETE FROM comments WHERE id = $1 AND post_id = $2',
      [commentId, postId]
    );

    // Decrement comment count
    await query(
      'UPDATE posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = $1',
      [postId]
    );

    console.log(`✅ Comment ${commentId} deleted successfully`);
    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('❌ Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

module.exports = router;

// ============================================================
// POST /:id/bookmark - Bookmark a post
// ============================================================
router.post('/:id/bookmark', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Check if post exists
    const postCheck = await query('SELECT id FROM posts WHERE id = $1', [id]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if already bookmarked
    const existing = await query(
      'SELECT id FROM bookmarks WHERE post_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existing.rows.length === 0) {
      await query(
        'INSERT INTO bookmarks (post_id, user_id) VALUES ($1, $2)',
        [id, userId]
      );
      console.log(`📌 User ${userId} bookmarked post ${id}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Bookmark error:', error);
    res.status(500).json({ error: 'Failed to bookmark post' });
  }
});

// ============================================================
// DELETE /:id/bookmark - Unbookmark a post
// ============================================================
router.delete('/:id/bookmark', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    await query(
      'DELETE FROM bookmarks WHERE post_id = $1 AND user_id = $2',
      [id, userId]
    );

    console.log(`📌 User ${userId} unbookmarked post ${id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Unbookmark error:', error);
    res.status(500).json({ error: 'Failed to unbookmark post' });
  }
});
