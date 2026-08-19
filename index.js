const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require("multer");
const { query } = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

app.use(cors());
app.use(express.json());

// ============ UPLOADS ============
const uploadsDir = path.join(__dirname, 'uploads');
const profilesDir = path.join(__dirname, 'uploads/profiles');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(profilesDir)) fs.mkdirSync(profilesDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, file.fieldname === 'profileImage' ? profilesDir : uploadsDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + unique + path.extname(file.originalname));
  }
});

const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });
app.use('/uploads', express.static('uploads'));

// ============ AUTH MIDDLEWARE ============
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    console.error('❌ Invalid token:', err.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ============ HEALTH CHECK ============
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.get("/", (req, res) => {
  res.json({ message: "BirthdayApp API is running!" });
});

// ============================================================
// AUTH ENDPOINTS
// ============================================================
app.post("/api/auth/register", async (req, res) => {
  const { email, password, name, username, birthDate, phone, network } = req.body;
  
  try {
    const existing = await query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email.toLowerCase(), username.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email or username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (email, password_hash, name, username, birth_date, phone, network)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, name, username, birth_date, profile_image`,
      [email.toLowerCase(), hashedPassword, name, username.toLowerCase(), birthDate, phone, network]
    );

    const user = result.rows[0];
    await query('INSERT INTO wallets (user_id) VALUES ($1)', [user.id]);
    await query('INSERT INTO user_settings (user_id) VALUES ($1)', [user.id]);

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const result = await query(
      'SELECT id, email, name, username, password_hash, profile_image, birth_date FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    delete user.password_hash;
    res.json({ token, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, req.userId]);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('❌ Password change error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// USER ENDPOINTS
// ============================================================
app.get('/api/users/profile', verifyToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, email, name, username, bio, location, profile_image, 
              phone, network, birth_date, created_at
       FROM users WHERE id = $1`,
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

app.put('/api/users/profile', verifyToken, async (req, res) => {
  try {
    const { name, username, bio, location, profile_image, phone, network, birth_date } = req.body;
    const userId = req.userId;

    if (username) {
      const existing = await query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username.toLowerCase(), userId]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    const fields = [];
    const values = [];
    let paramCount = 1;
    const fieldMap = { name, username, bio, location, profile_image, phone, network, birth_date };
    for (const [key, value] of Object.entries(fieldMap)) {
      if (value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(key === 'username' ? value.toLowerCase() : value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(userId);
    const result = await query(
      `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $${paramCount} 
       RETURNING id, email, name, username, bio, location, profile_image, phone, network, birth_date`,
      values
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.get('/api/users', verifyToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, username, profile_image, bio, birth_date, phone, network
       FROM users WHERE id != $1 ORDER BY name ASC LIMIT 50`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.json([]);
  }
});

// ============================================================
// POSTS ENDPOINTS
// ============================================================
app.get("/api/posts", async (req, res) => {
  try {
    const result = await query(`
      SELECT p.*, u.name as author_name, u.username as author_handle,
             u.profile_image as author_image, u.phone, u.network
      FROM posts p 
      LEFT JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `);

    const posts = [];
    for (const row of result.rows) {
      const commentsResult = await query(
        `SELECT id, user_id, text, user_name, user_avatar, created_at, likes_count
         FROM comments WHERE post_id = $1 ORDER BY created_at ASC`,
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

app.post("/api/posts", verifyToken, async (req, res) => {
  try {
    const { 
      content, image, video, location, celebrationType, 
      celebrantName, isBirthday, music, hashtags,
      birthdaySongId, birthdaySongUrl, birthdaySongName 
    } = req.body;
    const userId = req.userId;

    const result = await query(
      `INSERT INTO posts (user_id, content, image, video, location, celebration_type, 
        celebrant_name, is_birthday, music, hashtags, birthday_song_id, 
        birthday_song_url, birthday_song_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        userId, content || '', image || null, video || null, location || null, 
        celebrationType || 'general', celebrantName || '', isBirthday || false, 
        music || null, hashtags || [], birthdaySongId || null,
        birthdaySongUrl || null, birthdaySongName || null
      ]
    );

    const post = result.rows[0];
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

app.delete("/api/posts/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const check = await query('SELECT user_id FROM posts WHERE id = $1', [parseInt(id)]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    if (check.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await query('DELETE FROM posts WHERE id = $1', [parseInt(id)]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

app.post("/api/posts/:id/like", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const existing = await query(
      'SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2',
      [parseInt(id), userId]
    );

    if (existing.rows.length === 0) {
      await query(
        'INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)',
        [parseInt(id), userId]
      );
      await query('UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1', [parseInt(id)]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ error: 'Failed to like post' });
  }
});

app.delete("/api/posts/:id/like", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    await query('DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2', [parseInt(id), userId]);
    await query('UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1', [parseInt(id)]);

    res.json({ success: true });
  } catch (error) {
    console.error('Unlike error:', error);
    res.status(500).json({ error: 'Failed to unlike post' });
  }
});

app.post("/api/posts/:id/bookmark", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const existing = await query(
      'SELECT id FROM bookmarks WHERE post_id = $1 AND user_id = $2',
      [parseInt(id), userId]
    );

    if (existing.rows.length === 0) {
      await query(
        'INSERT INTO bookmarks (post_id, user_id) VALUES ($1, $2)',
        [parseInt(id), userId]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Bookmark error:', error);
    res.status(500).json({ error: 'Failed to bookmark post' });
  }
});

app.delete("/api/posts/:id/bookmark", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    await query('DELETE FROM bookmarks WHERE post_id = $1 AND user_id = $2', [parseInt(id), userId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Unbookmark error:', error);
    res.status(500).json({ error: 'Failed to unbookmark post' });
  }
});

// ============================================================
// ✅ COMMENTS ENDPOINTS (FULLY WORKING)
// ============================================================

// POST /api/posts/:postId/comments - Add comment
app.post("/api/posts/:postId/comments", verifyToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;
    const userId = req.userId;

    console.log(`💬 POST comment: postId=${postId}, userId=${userId}`);

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const userResult = await query(
      'SELECT name, profile_image FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    const result = await query(
      `INSERT INTO comments (post_id, user_id, text, user_name, user_avatar)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, text, user_name, user_avatar, created_at`,
      [parseInt(postId), userId, text.trim(), user.name, user.profile_image]
    );

    await query('UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1', [parseInt(postId)]);

    const comment = result.rows[0];
    console.log(`✅ Comment ${comment.id} added`);

    res.status(201).json({
      id: comment.id,
      userId: comment.user_id,
      userName: comment.user_name,
      userAvatar: comment.user_avatar,
      text: comment.text,
      createdAt: comment.created_at,
      likes: 0
    });
  } catch (error) {
    console.error('❌ POST comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// GET /api/posts/:postId/comments - Get all comments
app.get("/api/posts/:postId/comments", async (req, res) => {
  try {
    const { postId } = req.params;

    const result = await query(
      `SELECT id, user_id, text, user_name, user_avatar, created_at, likes_count
       FROM comments WHERE post_id = $1 ORDER BY created_at ASC`,
      [parseInt(postId)]
    );

    res.json({ comments: result.rows });
  } catch (error) {
    console.error('❌ GET comments error:', error);
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

// ✅ PUT /api/posts/:postId/comments/:commentId - Edit comment (WORKING)
app.put("/api/posts/:postId/comments/:commentId", verifyToken, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { text } = req.body;
    const userId = req.userId;

    console.log(`✏️ PUT comment: postId=${postId}, commentId=${commentId}, userId=${userId}`);

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const check = await query(
      'SELECT id, user_id FROM comments WHERE id = $1 AND post_id = $2',
      [parseInt(commentId), parseInt(postId)]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (check.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to edit this comment' });
    }

    await query(
      'UPDATE comments SET text = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [text.trim(), parseInt(commentId)]
    );

    console.log(`✅ Comment ${commentId} updated`);
    res.json({ success: true, message: 'Comment updated successfully' });
  } catch (error) {
    console.error('❌ PUT comment error:', error);
    res.status(500).json({ error: 'Failed to edit comment' });
  }
});

// ✅ DELETE /api/posts/:postId/comments/:commentId - Delete comment (WORKING)
app.delete("/api/posts/:postId/comments/:commentId", verifyToken, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.userId;

    console.log(`🗑️ DELETE comment: postId=${postId}, commentId=${commentId}, userId=${userId}`);

    const check = await query(
      'SELECT id, user_id FROM comments WHERE id = $1 AND post_id = $2',
      [parseInt(commentId), parseInt(postId)]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (check.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    await query('DELETE FROM comments WHERE id = $1', [parseInt(commentId)]);
    await query('UPDATE posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = $1', [parseInt(postId)]);

    console.log(`✅ Comment ${commentId} deleted`);
    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('❌ DELETE comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// ============================================================
// FRIENDS ENDPOINTS
// ============================================================
app.get("/api/friends/list", verifyToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.username, u.profile_image, u.birth_date, u.phone, u.network
       FROM friends f JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = $1 ORDER BY u.name ASC`,
      [req.userId]
    );
    res.json({ friends: result.rows });
  } catch (error) {
    console.error('Get friends error:', error);
    res.json({ friends: [] });
  }
});

app.get("/api/friends/requests", verifyToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT fr.*, u.name, u.username, u.profile_image
       FROM friend_requests fr JOIN users u ON u.id = fr.from_user_id
       WHERE fr.to_user_id = $1 AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [req.userId]
    );
    res.json({ requests: result.rows });
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.json({ requests: [] });
  }
});

app.post("/api/friends/request", verifyToken, async (req, res) => {
  const { toUserId } = req.body;
  const fromUserId = req.userId;

  try {
    if (fromUserId === parseInt(toUserId)) {
      return res.status(400).json({ error: 'Cannot add yourself' });
    }

    const existing = await query(
      `SELECT id FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
      [fromUserId, toUserId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Already friends' });
    }

    const requestExists = await query(
      `SELECT id FROM friend_requests WHERE from_user_id = $1 AND to_user_id = $2 AND status = 'pending'`,
      [fromUserId, toUserId]
    );
    if (requestExists.rows.length > 0) {
      return res.status(400).json({ error: 'Request already sent' });
    }

    await query(
      `INSERT INTO friend_requests (from_user_id, to_user_id) VALUES ($1, $2)`,
      [fromUserId, toUserId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Send request error:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

app.post("/api/friends/accept", verifyToken, async (req, res) => {
  const { requestId } = req.body;

  try {
    const result = await query(
      `UPDATE friend_requests SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND to_user_id = $2
       RETURNING from_user_id, to_user_id`,
      [requestId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const { from_user_id, to_user_id } = result.rows[0];
    await query(
      `INSERT INTO friends (user_id, friend_id) VALUES ($1, $2), ($2, $1)`,
      [from_user_id, to_user_id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Accept request error:', error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

app.post("/api/friends/decline", verifyToken, async (req, res) => {
  const { requestId } = req.body;

  try {
    await query(
      `UPDATE friend_requests SET status = 'declined', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND to_user_id = $2`,
      [requestId, req.userId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Decline request error:', error);
    res.status(500).json({ error: 'Failed to decline friend request' });
  }
});

app.delete("/api/friends/:friendId", verifyToken, async (req, res) => {
  const { friendId } = req.params;

  try {
    await query(
      `DELETE FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
      [req.userId, friendId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

app.get("/api/friends/birthdays", verifyToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.username, u.profile_image, u.birth_date, u.phone, u.network
       FROM friends f JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = $1 AND u.birth_date IS NOT NULL
       ORDER BY EXTRACT(MONTH FROM u.birth_date), EXTRACT(DAY FROM u.birth_date)`,
      [req.userId]
    );
    res.json({ friendsBirthdays: result.rows });
  } catch (error) {
    console.error('Get birthdays error:', error);
    res.json({ friendsBirthdays: [] });
  }
});

// ============================================================
// WALLET ENDPOINTS
// ============================================================
app.get("/api/wallet/balance", verifyToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT balance, total_received, total_sent, total_withdrawn, total_fees_paid
       FROM wallets WHERE user_id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      await query('INSERT INTO wallets (user_id) VALUES ($1)', [req.userId]);
      return res.json({ balance: 0, total_received: 0, total_sent: 0, total_withdrawn: 0, total_fees_paid: 0 });
    }

    const wallet = result.rows[0];
    res.json({
      balance: parseFloat(wallet.balance) || 0,
      total_received: parseFloat(wallet.total_received) || 0,
      total_sent: parseFloat(wallet.total_sent) || 0,
      total_withdrawn: parseFloat(wallet.total_withdrawn) || 0,
      total_fees_paid: parseFloat(wallet.total_fees_paid) || 0
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.json({ balance: 0 });
  }
});

app.get("/api/wallet/transactions", verifyToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, type, amount, fee, description, status, network, phone_number, created_at
       FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.userId]
    );
    res.json({ transactions: result.rows });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.json({ transactions: [] });
  }
});

app.post("/api/wallet/withdraw", verifyToken, async (req, res) => {
  try {
    const { amount, network, phoneNumber } = req.body;
    const userId = req.userId;

    if (!amount || !network || !phoneNumber) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const amountNum = parseFloat(amount);
    const fee = amountNum * 0.01;
    const totalDeduction = amountNum + fee;

    const walletResult = await query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
    if (walletResult.rows.length === 0) {
      return res.status(400).json({ error: 'Wallet not found' });
    }

    const currentBalance = parseFloat(walletResult.rows[0].balance) || 0;
    if (currentBalance < totalDeduction) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const newBalance = currentBalance - totalDeduction;

    await query(
      `UPDATE wallets SET balance = $1, total_withdrawn = total_withdrawn + $2,
       total_fees_paid = total_fees_paid + $3, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $4`,
      [newBalance, amountNum, fee, userId]
    );

    await query(
      `INSERT INTO transactions (user_id, type, amount, fee, description, status, network, phone_number)
       VALUES ($1, 'withdrawal', $2, $3, $4, 'completed', $5, $6)`,
      [userId, amountNum, fee, `Withdrawal to ${network}`, network, phoneNumber]
    );

    res.json({ success: true, newBalance, fee, userReceives: amountNum - fee });
  } catch (error) {
    console.error('Withdraw error:', error);
    res.status(500).json({ error: 'Withdrawal failed' });
  }
});

app.post("/api/wallet/add-gift", verifyToken, async (req, res) => {
  try {
    const { celebrantId, celebrantName, giftName, giftAmount, fromName } = req.body;
    const amount = parseFloat(giftAmount);

    if (!celebrantId || !amount || !giftName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await query(
      `UPDATE wallets SET balance = balance + $1, total_received = total_received + $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [amount, celebrantId]
    );

    await query(
      `INSERT INTO transactions (user_id, type, amount, description, status)
       VALUES ($1, 'gift_received', $2, $3, 'completed')`,
      [celebrantId, amount, `Gift received: ${giftName} from ${fromName || 'Someone'}`]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Add gift error:', error);
    res.status(500).json({ error: 'Failed to add gift' });
  }
});

// ============================================================
// BANNERS ENDPOINTS
// ============================================================
app.get("/api/banners", async (req, res) => {
  try {
    const result = await query(
      `SELECT id, title, subtitle, icon, colors, active, priority, views_count, clicks_count, created_at
       FROM banners WHERE active = true ORDER BY priority ASC`
    );

    if (result.rows.length > 0) {
      return res.json({ 
        success: true, 
        banners: result.rows.map(b => ({
          id: b.id,
          title: b.title,
          subtitle: b.subtitle,
          icon: b.icon || '🎉',
          colors: b.colors || ['#6366f1', '#8b5cf6', '#a855f7'],
          active: b.active,
          priority: b.priority || 0,
          views: b.views_count || 0,
          clicks: b.clicks_count || 0,
          createdAt: b.created_at
        }))
      });
    }

    res.json({
      success: true,
      banners: [
        { id: 'banner_1', title: '🎉 Today\'s Celebrations', subtitle: 'Check out today\'s events!', icon: '🎂', colors: ['#6366f1', '#8b5cf6', '#a855f7'], active: true, priority: 1, views: 0, clicks: 0, createdAt: new Date().toISOString() },
        { id: 'banner_2', title: '🎁 Gift Shop', subtitle: 'Send a gift to someone special', icon: '🎁', colors: ['#ec4899', '#f472b6', '#f9a8d4'], active: true, priority: 2, views: 0, clicks: 0, createdAt: new Date().toISOString() }
      ]
    });
  } catch (error) {
    console.error('Get banners error:', error);
    res.json({
      success: true,
      banners: [
        { id: 'banner_1', title: '🎉 Today\'s Celebrations', subtitle: 'Check out today\'s events!', icon: '🎂', colors: ['#6366f1', '#8b5cf6', '#a855f7'], active: true, priority: 1, views: 0, clicks: 0, createdAt: new Date().toISOString() },
        { id: 'banner_2', title: '🎁 Gift Shop', subtitle: 'Send a gift to someone special', icon: '🎁', colors: ['#ec4899', '#f472b6', '#f9a8d4'], active: true, priority: 2, views: 0, clicks: 0, createdAt: new Date().toISOString() }
      ]
    });
  }
});

app.post("/api/banners/:id/view", async (req, res) => {
  try {
    const { id } = req.params;
    await query('UPDATE banners SET views_count = views_count + 1 WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.json({ success: true });
  }
});

app.post("/api/banners/:id/click", async (req, res) => {
  try {
    const { id } = req.params;
    await query('UPDATE banners SET clicks_count = clicks_count + 1 WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.json({ success: true });
  }
});

// ============================================================
// NOTIFICATIONS ENDPOINTS
// ============================================================
app.get("/api/notifications", verifyToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, type, title, message, image_url, target_id, target_name, is_read, extra_data, created_at
       FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [req.userId]
    );

    const unreadResult = await query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.userId]
    );

    res.json({
      notifications: result.rows,
      unreadCount: parseInt(unreadResult.rows[0]?.count || 0)
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.json({ notifications: [], unreadCount: 0 });
  }
});

app.post("/api/notifications", verifyToken, async (req, res) => {
  try {
    const { userId, type, title, message, imageUrl, targetId, targetName, extraData } = req.body;

    const result = await query(
      `INSERT INTO notifications (user_id, type, title, message, image_url, target_id, target_name, extra_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [userId, type, title || type, message, imageUrl || null, targetId || null, targetName || null, extraData || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

app.put("/api/notifications/:id/read", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    await query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', [id, req.userId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

app.put("/api/notifications/read-all", verifyToken, async (req, res) => {
  try {
    await query('UPDATE notifications SET is_read = true WHERE user_id = $1', [req.userId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

app.delete("/api/notifications/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [id, req.userId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// ============================================================
// STORIES ENDPOINTS
// ============================================================
app.get("/api/stories", verifyToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT s.*, u.name as user_name, u.username as user_handle, u.profile_image as user_avatar
       FROM stories s JOIN users u ON u.id = s.user_id
       WHERE s.expires_at > NOW() ORDER BY s.created_at DESC`
    );
    res.json({ stories: result.rows });
  } catch (error) {
    console.error('Get stories error:', error);
    res.json({ stories: [] });
  }
});

app.post("/api/stories", verifyToken, upload.single('content'), async (req, res) => {
  try {
    const { isVideo, caption, isBirthday, celebrantName } = req.body;
    const userId = req.userId;

    if (!req.file) {
      return res.status(400).json({ error: 'No content uploaded' });
    }

    const contentUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = await query(
      `INSERT INTO stories (user_id, content_url, is_video, caption, is_birthday, celebrant_name, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, contentUrl, isVideo === 'true', caption || '', isBirthday === 'true', celebrantName || '', expiresAt]
    );

    res.status(201).json({ story: result.rows[0] });
  } catch (error) {
    console.error('Create story error:', error);
    res.status(500).json({ error: 'Failed to create story' });
  }
});

app.post("/api/stories/:id/like", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const existing = await query(
      'SELECT id FROM story_likes WHERE story_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existing.rows.length === 0) {
      await query('INSERT INTO story_likes (story_id, user_id) VALUES ($1, $2)', [id, userId]);
      await query('UPDATE stories SET likes_count = likes_count + 1 WHERE id = $1', [id]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Like story error:', error);
    res.status(500).json({ error: 'Failed to like story' });
  }
});

app.delete("/api/stories/:id/like", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    await query('DELETE FROM story_likes WHERE story_id = $1 AND user_id = $2', [id, userId]);
    await query('UPDATE stories SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1', [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Unlike story error:', error);
    res.status(500).json({ error: 'Failed to unlike story' });
  }
});

app.post("/api/stories/:id/view", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const existing = await query(
      'SELECT id FROM story_views WHERE story_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existing.rows.length === 0) {
      await query('INSERT INTO story_views (story_id, user_id) VALUES ($1, $2)', [id, userId]);
      await query('UPDATE stories SET views_count = views_count + 1 WHERE id = $1', [id]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('View story error:', error);
    res.status(500).json({ error: 'Failed to view story' });
  }
});

app.delete("/api/stories/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const check = await query('SELECT user_id FROM stories WHERE id = $1', [id]);
    if (check.rows.length === 0 || check.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await query('DELETE FROM stories WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete story error:', error);
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

// ============================================================
// FOLLOWS ENDPOINTS
// ============================================================
app.get('/api/follows', verifyToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.username, u.profile_image
       FROM follows f JOIN users u ON u.id = f.following_id
       WHERE f.follower_id = $1 ORDER BY u.name ASC`,
      [req.userId]
    );
    res.json({ following: result.rows });
  } catch (error) {
    console.error('Get follows error:', error);
    res.json({ following: [] });
  }
});

app.post('/api/follows/:userId', verifyToken, async (req, res) => {
  try {
    const followerId = req.userId;
    const followingId = parseInt(req.params.userId);

    if (followerId === followingId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const existing = await query(
      'SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2',
      [followerId, followingId]
    );

    if (existing.rows.length === 0) {
      await query('INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)', [followerId, followingId]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

app.delete('/api/follows/:userId', verifyToken, async (req, res) => {
  try {
    const followerId = req.userId;
    const followingId = parseInt(req.params.userId);

    await query('DELETE FROM follows WHERE follower_id = $1 AND following_id = $2', [followerId, followingId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Unfollow error:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// ============================================================
// GIFTS ENDPOINTS
// ============================================================
app.get("/api/gifts", (req, res) => {
  const gifts = [
    { id: 'g1', name: 'Gold Bar', price: 100, category: 'Luxury', icon: '🥇', isPopular: true },
    { id: 'g2', name: 'Diamond Ring', price: 150, category: 'Luxury', icon: '💍', isPopular: true },
    { id: 'g3', name: 'Celebration Cake', price: 50, category: 'Food', icon: '🎂', isNew: true },
    { id: 'g4', name: 'Fresh Flowers', price: 40, category: 'Flowers', icon: '🌹' },
    { id: 'g5', name: 'Premium Champagne', price: 20, category: 'Drinks', icon: '🍾' },
    { id: 'g6', name: 'Gift Card', price: 10, category: 'Cash', icon: '💳' },
    { id: 'g7', name: 'Teddy Bear', price: 25, category: 'Toys', icon: '🧸' },
    { id: 'g8', name: 'Chocolate Box', price: 15, category: 'Food', icon: '🍫' },
    { id: 'v1', name: 'Birthday Cake', price: 5, category: 'Virtual', icon: '🎂' },
    { id: 'v2', name: 'Balloons', price: 1, category: 'Virtual', icon: '🎈' },
    { id: 'v3', name: 'Party Popper', price: 2, category: 'Virtual', icon: '🎉' },
    { id: 'v4', name: 'Magic Sparkles', price: 10, category: 'Virtual', icon: '✨' },
    { id: 'v5', name: 'Heart', price: 3, category: 'Virtual', icon: '❤️' },
    { id: 'v6', name: 'Crown', price: 15, category: 'Virtual', icon: '👑' },
  ];
  res.json(gifts);
});

app.post("/api/gifts/purchase", verifyToken, async (req, res) => {
  try {
    const { giftId, giftName, amount, network, phoneNumber, recipientId, recipientName, isPremium, senderName } = req.body;
    const senderId = req.userId;
    const giftAmount = parseFloat(amount);

    // Check sender balance
    const senderWallet = await query('SELECT balance FROM wallets WHERE user_id = $1', [senderId]);
    if (senderWallet.rows.length === 0 || parseFloat(senderWallet.rows[0].balance) < giftAmount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Deduct from sender
    await query(
      'UPDATE wallets SET balance = balance - $1, total_sent = total_sent + $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
      [giftAmount, senderId]
    );

    // Add to recipient
    const recipientWallet = await query('SELECT balance FROM wallets WHERE user_id = $1', [recipientId]);
    if (recipientWallet.rows.length === 0) {
      await query('INSERT INTO wallets (user_id, balance) VALUES ($1, $2)', [recipientId, giftAmount]);
    } else {
      await query(
        'UPDATE wallets SET balance = balance + $1, total_received = total_received + $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
        [giftAmount, recipientId]
      );
    }

    // Record transaction for sender
    await query(
      `INSERT INTO transactions (user_id, type, amount, description, status)
       VALUES ($1, 'gift_sent', $2, $3, 'completed')`,
      [senderId, giftAmount, `Gift sent: ${giftName} to ${recipientName}`]
    );

    // Record transaction for recipient
    await query(
      `INSERT INTO transactions (user_id, type, amount, description, status)
       VALUES ($1, 'gift_received', $2, $3, 'completed')`,
      [recipientId, giftAmount, `Gift received: ${giftName} from ${senderName || 'Someone'}`]
    );

    res.json({ success: true, message: `Gift sent to ${recipientName}` });
  } catch (error) {
    console.error('Purchase gift error:', error);
    res.status(500).json({ error: 'Failed to purchase gift' });
  }
});

// ============================================================
// UPLOAD ENDPOINTS
// ============================================================
app.post("/api/upload/video", verifyToken, upload.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }
    const videoUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    console.log('🎬 Video uploaded:', videoUrl);
    res.json({ success: true, videoUrl });
  } catch (error) {
    console.error('Video upload error:', error);
    res.status(500).json({ error: 'Video upload failed' });
  }
});

app.post('/api/users/profile/image', verifyToken, upload.single('profileImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    const userId = req.userId;
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/profiles/${req.file.filename}`;

    await query('UPDATE users SET profile_image = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [imageUrl, userId]);

    res.json({ success: true, imageUrl });
  } catch (error) {
    console.error('Profile image upload error:', error);
    res.status(500).json({ error: 'Failed to upload profile image' });
  }
});

// ============================================================
// SERVER START
// ============================================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`✅ All endpoints ready including comments DELETE and PUT`);
});

// ============================================================
// GET /api/friends/list/:userId - Get friends of specific user
// ============================================================
app.get("/api/friends/list/:userId", verifyToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log(`👥 Getting friends list for user: ${userId}`);

    const result = await query(
      `SELECT u.id, u.name, u.username, u.profile_image, u.birth_date, u.phone, u.network
       FROM friends f 
       JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = $1
       ORDER BY u.name ASC`,
      [parseInt(userId)]
    );

    console.log(`👥 Found ${result.rows.length} friends`);
    res.json({ friends: result.rows });
  } catch (error) {
    console.error("❌ Get friends error:", error);
    res.status(500).json({ friends: [] });
  }
});

// ============================================================
// GET /api/friends/requests/sent - Get sent friend requests
// ============================================================
app.get("/api/friends/requests/sent", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    console.log(`📤 Getting sent friend requests for user: ${userId}`);

    const result = await query(
      `SELECT fr.*, u.name, u.username, u.profile_image
       FROM friend_requests fr 
       JOIN users u ON u.id = fr.to_user_id
       WHERE fr.from_user_id = $1 AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [userId]
    );

    res.json({ requests: result.rows });
  } catch (error) {
    console.error("❌ Get sent requests error:", error);
    res.json({ requests: [] });
  }
});

// ============================================================
// GET /api/friends/list/:userId - Get friends of specific user
// ============================================================

// ============================================================
// ✅ FIXED: GET /api/friends/list/:userId - Get friends of specific user
// ============================================================
app.get("/api/friends/list/:userId", verifyToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    console.log(`👥 [FIXED] Getting friends for user ID: ${userId}`);

    // Check if user exists
    const userCheck = await query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      console.log(`⚠️ User ${userId} not found`);
      return res.status(404).json({ friends: [], error: 'User not found' });
    }

    const result = await query(
      `SELECT u.id, u.name, u.username, u.profile_image, u.birth_date, u.phone, u.network
       FROM friends f 
       JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = $1
       ORDER BY u.name ASC`,
      [userId]
    );

    console.log(`✅ Found ${result.rows.length} friends for user ${userId}`);
    res.json({ friends: result.rows });
  } catch (error) {
    console.error("❌ Get friends error:", error);
    res.status(500).json({ friends: [], error: error.message });
  }
});

// ============================================================
// ✅ FIXED: GET /api/friends/list - Get current user's friends
// ============================================================
app.get("/api/friends/list", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    console.log(`👥 Getting friends for current user: ${userId}`);

    const result = await query(
      `SELECT u.id, u.name, u.username, u.profile_image, u.birth_date, u.phone, u.network
       FROM friends f 
       JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = $1
       ORDER BY u.name ASC`,
      [userId]
    );

    console.log(`✅ Found ${result.rows.length} friends for current user`);
    res.json({ friends: result.rows });
  } catch (error) {
    console.error("❌ Get friends error:", error);
    res.status(500).json({ friends: [] });
  }
});

// ============================================================
// ✅ FIXED: GET /api/friends/requests - Get pending friend requests
// ============================================================
app.get("/api/friends/requests", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    console.log(`📩 Getting friend requests for user: ${userId}`);

    const result = await query(
      `SELECT fr.*, u.name, u.username, u.profile_image
       FROM friend_requests fr 
       JOIN users u ON u.id = fr.from_user_id
       WHERE fr.to_user_id = $1 AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [userId]
    );

    console.log(`✅ Found ${result.rows.length} pending requests`);
    res.json({ requests: result.rows });
  } catch (error) {
    console.error("❌ Get friend requests error:", error);
    res.status(500).json({ requests: [] });
  }
});
