const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require("multer");
const { query } = require('./src/config/database');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: '*',
  credentials: true,
}));
app.use(express.json());

// ============================================================
// STATIC FILE SERVING
// ============================================================
app.use('/uploads', express.static('uploads'));

// ============================================================
// UPLOAD CONFIGURATION
// ============================================================
const uploadsDir = path.join(__dirname, 'uploads');
const profilesDir = path.join(uploadsDir, 'profiles');
const storiesDir = path.join(uploadsDir, 'stories');
const videosDir = path.join(uploadsDir, 'videos');
const imagesDir = path.join(uploadsDir, 'images');

[uploadsDir, profilesDir, storiesDir, videosDir, imagesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created: ${dir}`);
  }
});

// Video upload config
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, videosDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'video-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  }
});

// Profile image upload config
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, profilesDir),
  filename: (req, file, cb) => {
    const userId = req.userId || Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `profile_${userId}_${Date.now()}${ext}`);
  }
});

const profileUpload = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');

    const result = await query(
      `SELECT id, name, username, email, profile_image, is_admin, is_active 
       FROM users WHERE id = $1`,
      [decoded.userId]
    );

    if (!result || result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!result.rows[0].is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    req.user = result.rows[0];
    req.userId = decoded.userId;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    console.error('❌ Auth error:', error.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// ============================================================
// HEALTH CHECK
// ============================================================
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
  try {
    const { email, password, name, username, birthDate, phone, network } = req.body;

    if (!email || !password || !name || !username) {
      return res.status(400).json({ error: 'All fields are required' });
    }

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
       RETURNING id, email, name, username, birth_date, profile_image, phone, network`,
      [email.toLowerCase(), hashedPassword, name, username.toLowerCase(), birthDate, phone, network]
    );

    const user = result.rows[0];

    await query('INSERT INTO wallets (user_id) VALUES ($1)', [user.id]);
    await query('INSERT INTO user_settings (user_id) VALUES ($1)', [user.id]);

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your_jwt_secret_key',
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, user });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await query(
      `SELECT id, email, name, username, password_hash, profile_image, birth_date, phone, network, is_admin
       FROM users WHERE email = $1`,
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

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your_jwt_secret_key',
      { expiresIn: '7d' }
    );

    delete user.password_hash;
    res.json({ token, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post("/api/auth/change-password", verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.userId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const result = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, userId]
    );

    res.json({ success: true, message: 'Password updated' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
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

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.post('/api/users/profile/image', verifyToken, profileUpload.single('profileImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const userId = req.userId;
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/profiles/${req.file.filename}`;

    await query(
      'UPDATE users SET profile_image = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [imageUrl, userId]
    );

    const result = await query(
      'SELECT id, email, name, username, profile_image, bio, location, phone, network, birth_date FROM users WHERE id = $1',
      [userId]
    );

    res.json({ 
      success: true, 
      imageUrl: imageUrl,
      user: result.rows[0],
      message: 'Profile image updated successfully'
    });
  } catch (error) {
    console.error('Profile image upload error:', error);
    res.status(500).json({ error: 'Failed to upload profile image' });
  }
});

// ============================================================
// VIDEO UPLOAD
// ============================================================
app.post('/api/upload/video', videoUpload.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }
    const videoUrl = `${req.protocol}://${req.get('host')}/uploads/videos/${req.file.filename}`;
    console.log('🎬 Video uploaded:', videoUrl);
    res.json({ success: true, videoUrl });
  } catch (error) {
    console.error('❌ Video upload error:', error);
    res.status(500).json({ error: 'Video upload failed' });
  }
});

// ============================================================
// POSTS ENDPOINTS
// ============================================================
app.get('/api/posts', async (req, res) => {
  try {
    const result = await query(`
      SELECT p.*, u.name as author_name, u.username as author_handle,
      u.profile_image as author_image, u.phone, u.network
      FROM posts p LEFT JOIN users u ON p.user_id = u.id
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
        content: row.content || "",
        image: row.image,
        video: row.video,
        location: row.location,
        celebrationType: row.celebration_type || "general",
        celebrantName: row.celebrant_name || "",
        isBirthday: row.is_birthday || false,
        music: row.music,
        hashtags: row.hashtags || [],
        birthdaySongId: row.birthday_song_id,
        birthdaySongUrl: row.birthday_song_url,
        birthdaySongName: row.birthday_song_name,
        authorName: row.author_name || "Unknown",
        authorHandle: row.author_handle || "@user",
        authorImage: row.author_image || "https://randomuser.me/api/portraits/men/1.jpg",
        phone: row.phone || "",
        network: row.network || "MTN",
        likes: parseInt(row.likes_count) || 0,
        comments: parseInt(row.comments_count) || 0,
        views: parseInt(row.views_count) || 0,
        createdAt: row.created_at,
        commentList: commentsResult.rows.map(c => ({
          id: c.id,
          userId: c.user_id,
          userName: c.user_name || "Anonymous",
          userAvatar: c.user_avatar || "https://randomuser.me/api/portraits/men/1.jpg",
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

app.post('/api/posts', verifyToken, async (req, res) => {
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
        userId, content || "", image || null, video || null, location || null,
        celebrationType || "general", celebrantName || "", isBirthday || false,
        music || null, hashtags || [], birthdaySongId || null,
        birthdaySongUrl || null, birthdaySongName || null
      ]
    );

    const post = result.rows[0];
    const userResult = await query(
      "SELECT name, username, profile_image, phone, network FROM users WHERE id = $1",
      [userId]
    );
    const user = userResult.rows[0];

    res.status(201).json({
      id: post.id,
      userId: post.user_id,
      content: post.content || "",
      image: post.image,
      video: post.video,
      location: post.location,
      celebrationType: post.celebration_type || "general",
      celebrantName: post.celebrant_name || "",
      isBirthday: post.is_birthday || false,
      music: post.music,
      hashtags: post.hashtags || [],
      birthdaySongId: post.birthday_song_id,
      birthdaySongUrl: post.birthday_song_url,
      birthdaySongName: post.birthday_song_name,
      authorName: user.name,
      authorHandle: user.username,
      authorImage: user.profile_image || "https://randomuser.me/api/portraits/men/1.jpg",
      phone: user.phone || "",
      network: user.network || "MTN",
      likes: 0,
      comments: 0,
      views: 0,
      createdAt: post.created_at,
      commentList: []
    });
  } catch (error) {
    console.error('❌ Create post error:', error);
    res.status(500).json({ error: "Failed to create post" });
  }
});

app.delete('/api/posts/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const check = await query(
      'SELECT user_id FROM posts WHERE id = $1',
      [id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (check.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }

    await query('DELETE FROM posts WHERE id = $1', [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// ============================================================
// COMMENTS ENDPOINTS
// ============================================================
app.post('/api/posts/:postId/comments', verifyToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;
    const userId = req.userId;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Comment text is required" });
    }

    const userResult = await query(
      "SELECT name, profile_image FROM users WHERE id = $1",
      [userId]
    );
    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const result = await query(
      `INSERT INTO comments (post_id, user_id, text, user_name, user_avatar) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [postId, userId, text.trim(), user.name, user.profile_image]
    );

    await query(
      "UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1",
      [postId]
    );

    const comment = result.rows[0];

    res.status(201).json({
      id: comment.id,
      userId: comment.user_id,
      userName: comment.user_name || user.name,
      userAvatar: comment.user_avatar || user.profile_image || "https://randomuser.me/api/portraits/men/1.jpg",
      text: comment.text,
      createdAt: comment.created_at,
      likes: 0
    });
  } catch (error) {
    console.error('❌ Add comment error:', error);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

app.put('/api/posts/:postId/comments/:commentId', verifyToken, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { text } = req.body;
    const userId = req.userId;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Comment text is required" });
    }

    const checkResult = await query(
      `SELECT id, user_id FROM comments WHERE id = $1 AND post_id = $2`,
      [commentId, postId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Comment not found" });
    }

    if (checkResult.rows[0].user_id !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const result = await query(
      `UPDATE comments SET text = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 AND post_id = $3
       RETURNING id, text, created_at, updated_at`,
      [text.trim(), commentId, postId]
    );

    res.json({
      id: result.rows[0].id,
      text: result.rows[0].text,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at
    });
  } catch (error) {
    console.error('❌ Edit comment error:', error);
    res.status(500).json({ error: "Failed to edit comment" });
  }
});

app.delete('/api/posts/:postId/comments/:commentId', verifyToken, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.userId;

    const checkResult = await query(
      `SELECT user_id FROM comments WHERE id = $1 AND post_id = $2`,
      [commentId, postId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Comment not found" });
    }

    if (checkResult.rows[0].user_id !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await query("DELETE FROM comments WHERE id = $1", [commentId]);

    await query(
      "UPDATE posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = $1",
      [postId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Delete comment error:', error);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

// ============================================================
// LIKE ENDPOINTS
// ============================================================
app.post('/api/posts/:id/like', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const existing = await query(
      'SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existing.rows.length === 0) {
      await query(
        'INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)',
        [id, userId]
      );
      await query(
        'UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1',
        [id]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ error: 'Failed to like post' });
  }
});

app.delete('/api/posts/:id/like', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    await query(
      'DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2',
      [id, userId]
    );
    await query(
      'UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1',
      [id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Unlike error:', error);
    res.status(500).json({ error: 'Failed to unlike post' });
  }
});

// ============================================================
// BOOKMARK ENDPOINTS
// ============================================================
app.post('/api/posts/:id/bookmark', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const existing = await query(
      'SELECT id FROM bookmarks WHERE post_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existing.rows.length === 0) {
      await query(
        'INSERT INTO bookmarks (post_id, user_id) VALUES ($1, $2)',
        [id, userId]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Bookmark error:', error);
    res.status(500).json({ error: 'Failed to bookmark post' });
  }
});

app.delete('/api/posts/:id/bookmark', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    await query(
      'DELETE FROM bookmarks WHERE post_id = $1 AND user_id = $2',
      [id, userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Unbookmark error:', error);
    res.status(500).json({ error: 'Failed to unbookmark post' });
  }
});

// ============================================================
// FRIENDS ENDPOINTS (FIXED)
// ============================================================
app.get("/api/friends/list", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    console.log(`👥 Getting friends list for user: ${userId}`);

    const result = await query(
      `SELECT u.id, u.name, u.username, u.profile_image, u.birth_date, u.phone, u.network
       FROM friends f
       JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = $1
       ORDER BY u.name ASC`,
      [userId]
    );

    console.log(`👥 Found ${result.rows.length} friends`);
    res.json({ friends: result.rows });
  } catch (error) {
    console.error("❌ Get friends error:", error);
    res.json({ friends: [] });
  }
});

app.get("/api/friends/requests", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    console.log(`👋 Getting friend requests for user: ${userId}`);

    const result = await query(
      `SELECT fr.id, fr.from_user_id, fr.status, fr.created_at,
              u.name, u.username, u.profile_image
       FROM friend_requests fr
       JOIN users u ON u.id = fr.from_user_id
       WHERE fr.to_user_id = $1 AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [userId]
    );

    console.log(`👋 Found ${result.rows.length} friend requests`);
    res.json({ requests: result.rows });
  } catch (error) {
    console.error("❌ Get friend requests error:", error);
    res.json({ requests: [] });
  }
});

app.post("/api/friends/request", verifyToken, async (req, res) => {
  const { toUserId } = req.body;
  const fromUserId = req.userId;

  console.log(`📤 Friend request from ${fromUserId} to ${toUserId}`);

  try {
    if (fromUserId === toUserId) {
      return res.status(400).json({ error: "Cannot add yourself" });
    }

    const existing = await query(
      `SELECT id FROM friends
       WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
      [fromUserId, toUserId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Already friends" });
    }

    const requestExists = await query(
      `SELECT id FROM friend_requests
       WHERE from_user_id = $1 AND to_user_id = $2 AND status = 'pending'`,
      [fromUserId, toUserId]
    );
    if (requestExists.rows.length > 0) {
      return res.status(400).json({ error: "Request already sent" });
    }

    const result = await query(
      `INSERT INTO friend_requests (from_user_id, to_user_id)
       VALUES ($1, $2)
       RETURNING id`,
      [fromUserId, toUserId]
    );

    console.log(`✅ Friend request sent: ${result.rows[0].id}`);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Send request error:", error);
    res.status(500).json({ error: "Failed to send friend request" });
  }
});

// ✅ FIXED: Accept friend request with ON CONFLICT
app.post("/api/friends/accept", verifyToken, async (req, res) => {
  const { requestId } = req.body;
  const userId = req.userId;

  console.log(`✅ Accepting friend request: ${requestId} for user ${userId}`);

  try {
    const request = await query(
      `SELECT from_user_id, to_user_id FROM friend_requests
       WHERE id = $1 AND to_user_id = $2 AND status = 'pending'`,
      [requestId, userId]
    );

    if (request.rows.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    const { from_user_id, to_user_id } = request.rows[0];

    await query(
      `UPDATE friend_requests
       SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [requestId]
    );

    // ✅ Create bidirectional friendship with ON CONFLICT
    await query(`
      INSERT INTO friends (user_id, friend_id)
      VALUES ($1, $2), ($2, $1)
      ON CONFLICT (user_id, friend_id) DO NOTHING
    `, [from_user_id, to_user_id]);

    console.log(`✅ Friend request accepted: ${requestId}`);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Accept request error:", error);
    res.status(500).json({ error: "Failed to accept friend request: " + error.message });
  }
});

app.post("/api/friends/decline", verifyToken, async (req, res) => {
  const { requestId } = req.body;
  const userId = req.userId;

  console.log(`❌ Declining friend request: ${requestId}`);

  try {
    const result = await query(
      `UPDATE friend_requests
       SET status = 'declined', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND to_user_id = $2`,
      [requestId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    console.log(`✅ Friend request declined: ${requestId}`);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Decline request error:", error);
    res.status(500).json({ error: "Failed to decline friend request" });
  }
});

app.delete("/api/friends/:friendId", verifyToken, async (req, res) => {
  const { friendId } = req.params;
  const userId = req.userId;

  console.log(`🗑️ Removing friend ${friendId} for user ${userId}`);

  try {
    await query(
      `DELETE FROM friends
       WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
      [userId, friendId]
    );

    console.log(`✅ Friend removed: ${friendId}`);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Remove friend error:", error);
    res.status(500).json({ error: "Failed to remove friend" });
  }
});

app.get("/api/friends/birthdays", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    console.log(`🎂 Getting friends birthdays for user: ${userId}`);

    const result = await query(
      `SELECT u.id, u.name, u.username, u.profile_image, u.birth_date, u.phone, u.network
       FROM friends f
       JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = $1
       AND u.birth_date IS NOT NULL
       ORDER BY EXTRACT(MONTH FROM u.birth_date), EXTRACT(DAY FROM u.birth_date)`,
      [userId]
    );

    console.log(`🎂 Found ${result.rows.length} friends with birthdays`);
    res.json({ friendsBirthdays: result.rows });
  } catch (error) {
    console.error("❌ Get birthdays error:", error);
    res.json({ friendsBirthdays: [] });
  }
});

// ============================================================
// WALLET ENDPOINTS
// ============================================================
app.get('/api/wallet/balance', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;

    const result = await query(
      `SELECT balance, total_received, total_sent, total_withdrawn, total_fees_paid
       FROM wallets WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      await query('INSERT INTO wallets (user_id) VALUES ($1)', [userId]);
      return res.json({ balance: 0, total_received: 0, total_sent: 0, total_withdrawn: 0, total_fees_paid: 0 });
    }

    const wallet = result.rows[0];
    res.json({
      balance: parseFloat(wallet.balance) || 0,
      total_received: parseFloat(wallet.total_received) || 0,
      total_sent: parseFloat(wallet.total_sent) || 0,
      total_withdrawn: parseFloat(wallet.total_withdrawn) || 0,
      total_fees_paid: parseFloat(wallet.total_fees_paid) || 0,
    });
  } catch (error) {
    console.error('❌ Get balance error:', error);
    res.json({ balance: 0, total_received: 0, total_sent: 0, total_withdrawn: 0, total_fees_paid: 0 });
  }
});

app.get('/api/wallet/transactions', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;

    const result = await query(
      `SELECT id, type, amount, fee, balance_before, balance_after, 
              description, status, network, phone_number, created_at
       FROM transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    const transactions = result.rows.map(t => ({
      id: t.id,
      type: t.type,
      amount: parseFloat(t.amount),
      fee: parseFloat(t.fee) || 0,
      description: t.description || '',
      status: t.status || 'completed',
      network: t.network || '',
      phoneNumber: t.phone_number || '',
      createdAt: t.created_at
    }));

    res.json({ transactions });
  } catch (error) {
    console.error('❌ Get transactions error:', error);
    res.json({ transactions: [] });
  }
});

app.post('/api/wallet/withdraw', verifyToken, async (req, res) => {
  try {
    const { amount, network, phoneNumber } = req.body;
    const userId = req.userId;

    if (!amount || !network || !phoneNumber) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const amountNum = parseFloat(amount);
    const fee = amountNum * 0.01;
    const totalDeduction = amountNum + fee;

    const walletResult = await query(
      'SELECT balance FROM wallets WHERE user_id = $1',
      [userId]
    );

    if (walletResult.rows.length === 0) {
      return res.status(400).json({ error: 'Wallet not found' });
    }

    const currentBalance = parseFloat(walletResult.rows[0].balance) || 0;
    if (currentBalance < totalDeduction) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const newBalance = currentBalance - totalDeduction;

    await query(
      `UPDATE wallets 
       SET balance = $1, total_withdrawn = total_withdrawn + $2, 
           total_fees_paid = total_fees_paid + $3, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $4`,
      [newBalance, amountNum, fee, userId]
    );

    await query(
      `INSERT INTO transactions (user_id, type, amount, fee, balance_before, balance_after, description, status, network, phone_number, completed_at)
       VALUES ($1, 'withdrawal', $2, $3, $4, $5, $6, 'completed', $7, $8, CURRENT_TIMESTAMP)`,
      [userId, amountNum, fee, currentBalance, newBalance, `Withdrawal to ${network}`, network, phoneNumber]
    );

    res.json({
      success: true,
      newBalance: newBalance,
      fee: fee,
      userReceives: amountNum - fee
    });
  } catch (error) {
    console.error('❌ Withdraw error:', error);
    res.status(500).json({ error: 'Withdrawal failed' });
  }
});

app.post('/api/wallet/add-gift', verifyToken, async (req, res) => {
  try {
    const { celebrantId, celebrantName, giftName, giftAmount, fromName, isAnonymous } = req.body;
    const amount = parseFloat(giftAmount);

    if (!celebrantId || !amount || !giftName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await query(
      `UPDATE wallets 
       SET balance = balance + $1, total_received = total_received + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [amount, celebrantId]
    );

    const senderName = isAnonymous ? 'Anonymous' : (fromName || 'Someone');

    await query(
      `INSERT INTO transactions (user_id, type, amount, description, status, completed_at)
       VALUES ($1, 'gift_received', $2, $3, 'completed', CURRENT_TIMESTAMP)`,
      [celebrantId, amount, `Gift received: ${giftName} from ${senderName}`]
    );

    res.json({ success: true, message: `₵${amount} added to wallet` });
  } catch (error) {
    console.error('❌ Add gift error:', error);
    res.status(500).json({ error: 'Failed to add gift' });
  }
});

// ============================================================
// STORIES ENDPOINTS
// ============================================================
// Stories routes are imported from ./src/routes/stories.js
const storiesRoutes = require('./src/routes/stories');
app.use('/api/stories', storiesRoutes);

// ============================================================
// NOTIFICATIONS ENDPOINTS
// ============================================================
app.get('/api/notifications', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;

    const result = await query(
      `SELECT id, type, title, message, image_url, target_id, target_name, 
              is_read, extra_data, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId]
    );

    const unreadResult = await query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );

    const notifications = result.rows.map(n => ({
      id: n.id,
      userId: n.user_id,
      type: n.type,
      title: n.title,
      message: n.message,
      imageUrl: n.image_url,
      targetId: n.target_id,
      targetName: n.target_name,
      isRead: n.is_read,
      extraData: n.extra_data,
      createdAt: n.created_at
    }));

    res.json({
      notifications,
      unreadCount: parseInt(unreadResult.rows[0]?.count || 0)
    });
  } catch (error) {
    console.error('❌ Get notifications error:', error);
    res.json({ notifications: [], unreadCount: 0 });
  }
});

app.post('/api/notifications', verifyToken, async (req, res) => {
  try {
    const { userId, type, title, message, imageUrl, targetId, targetName, extraData } = req.body;

    if (!userId || !type || !message) {
      return res.status(400).json({ error: 'userId, type, and message are required' });
    }

    const result = await query(
      `INSERT INTO notifications (user_id, type, title, message, image_url, target_id, target_name, extra_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [userId, type, title || type, message, imageUrl || null, targetId || null, targetName || null, extraData || null]
    );

    const n = result.rows[0];
    res.status(201).json({
      id: n.id,
      userId: n.user_id,
      type: n.type,
      title: n.title,
      message: n.message,
      imageUrl: n.image_url,
      targetId: n.target_id,
      targetName: n.target_name,
      isRead: n.is_read,
      extraData: n.extra_data,
      createdAt: n.created_at
    });
  } catch (error) {
    console.error('❌ Create notification error:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

app.put('/api/notifications/:id/read', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    await query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

app.put('/api/notifications/read-all', verifyToken, async (req, res) => {
  try {
    await query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1',
      [req.userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Mark all read error:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

app.delete('/api/notifications/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    await query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// ============================================================
// BANNERS ENDPOINTS
// ============================================================
app.get('/api/banners', async (req, res) => {
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
        {
          id: 'banner_fallback_1',
          title: '🎉 Today\'s Celebrations',
          subtitle: 'Check out today\'s events!',
          icon: '🎂',
          colors: ['#6366f1', '#8b5cf6', '#a855f7'],
          type: 'celebrations',
          link: 'today',
          active: true,
          priority: 1,
          views: 0,
          clicks: 0,
          createdAt: new Date().toISOString()
        },
        {
          id: 'banner_fallback_2',
          title: '🎁 Gift Shop',
          subtitle: 'Send a gift to someone special',
          icon: '🎁',
          colors: ['#ec4899', '#f472b6', '#f9a8d4'],
          type: 'gifts',
          link: 'gift_shop',
          active: true,
          priority: 2,
          views: 0,
          clicks: 0,
          createdAt: new Date().toISOString()
        }
      ]
    });
  } catch (error) {
    console.error('❌ Get banners error:', error);
    res.json({
      success: true,
      banners: [
        {
          id: 'banner_fallback_1',
          title: '🎉 Today\'s Celebrations',
          subtitle: 'Check out today\'s events!',
          icon: '🎂',
          colors: ['#6366f1', '#8b5cf6', '#a855f7'],
          active: true,
          priority: 1,
          views: 0,
          clicks: 0,
          createdAt: new Date().toISOString()
        },
        {
          id: 'banner_fallback_2',
          title: '🎁 Gift Shop',
          subtitle: 'Send a gift to someone special',
          icon: '🎁',
          colors: ['#ec4899', '#f472b6', '#f9a8d4'],
          active: true,
          priority: 2,
          views: 0,
          clicks: 0,
          createdAt: new Date().toISOString()
        }
      ]
    });
  }
});

// ============================================================
// GIFTS ENDPOINTS
// ============================================================
app.post('/api/gifts/purchase', verifyToken, async (req, res) => {
  try {
    const { giftId, giftName, amount, network, phoneNumber, recipientId, recipientName } = req.body;
    const senderId = req.userId;
    const giftAmount = parseFloat(amount);

    if (!giftId || !giftName || !amount || !recipientId || !recipientName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if sender exists
    const senderCheck = await query('SELECT id, name FROM users WHERE id = $1', [senderId]);
    if (senderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Sender not found' });
    }

    // Check if recipient exists
    const userCheck = await query('SELECT id, name FROM users WHERE id = $1', [recipientId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    // Add gift to recipient's wallet
    await query(
      `UPDATE wallets 
       SET balance = balance + $1, 
           total_received = total_received + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [giftAmount, recipientId]
    );

    // Create gift transaction
    const giftResult = await query(
      `INSERT INTO gifts (sender_id, recipient_id, gift_id, gift_name, amount, network, phone_number, status, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', CURRENT_TIMESTAMP)
       RETURNING id`,
      [senderId, recipientId, giftId, giftName, giftAmount, network || 'MTN', phoneNumber || '']
    );

    // Create recipient transaction
    await query(
      `INSERT INTO transactions (user_id, type, amount, description, status, completed_at)
       VALUES ($1, 'gift_received', $2, $3, 'completed', CURRENT_TIMESTAMP)`,
      [recipientId, giftAmount, `Gift received: ${giftName} from ${senderCheck.rows[0].name}`]
    );

    res.json({
      success: true,
      message: `Gift sent successfully to ${recipientName}`,
      recipientId: recipientId,
      recipientName: recipientName,
      amount: giftAmount,
      giftName: giftName,
    });
  } catch (error) {
    console.error('❌ Purchase gift error:', error);
    res.status(500).json({ error: 'Failed to purchase gift. Please try again.' });
  }
});

// ============================================================
// FOLLOWS ENDPOINTS
// ============================================================
app.get('/api/follows', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;

    const result = await query(
      `SELECT u.id, u.name, u.username, u.profile_image
       FROM follows f
       JOIN users u ON u.id = f.following_id
       WHERE f.follower_id = $1
       ORDER BY u.name ASC`,
      [userId]
    );

    res.json({ following: result.rows });
  } catch (error) {
    console.error('❌ Get follows error:', error);
    res.json({ following: [] });
  }
});

app.post('/api/follows/:userId', verifyToken, async (req, res) => {
  try {
    const followerId = req.userId;
    const followingId = req.params.userId;

    if (followerId === parseInt(followingId)) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const existing = await query(
      'SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2',
      [followerId, followingId]
    );

    if (existing.rows.length > 0) {
      return res.json({ success: true, message: 'Already following' });
    }

    await query(
      'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)',
      [followerId, followingId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Follow error:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

app.delete('/api/follows/:userId', verifyToken, async (req, res) => {
  try {
    const followerId = req.userId;
    const followingId = req.params.userId;

    await query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [followerId, followingId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Unfollow error:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// ============================================================
// USERS ENDPOINTS
// ============================================================
app.get('/api/users', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;

    const result = await query(
      `SELECT id, name, username, profile_image, bio, location, birth_date, phone, network
       FROM users
       WHERE id != $1 AND is_active = true
       ORDER BY name ASC
       LIMIT 50`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Get users error:', error);
    res.json([]);
  }
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Uploads directory: ${uploadsDir}`);
  console.log(`📁 Profiles directory: ${profilesDir}`);
  console.log(`📁 Stories directory: ${storiesDir}`);
});

// ============================================================
// FRIENDS LIST BY USER ID
// ============================================================
app.get("/api/friends/list/:userId", verifyToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log(`👥 Getting friends list for user ID: ${userId}`);

    const result = await query(
      `SELECT u.id, u.name, u.username, u.profile_image, u.birth_date, u.phone, u.network
       FROM friends f
       JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = $1
       ORDER BY u.name ASC`,
      [userId]
    );

    console.log(`👥 Found ${result.rows.length} friends for user ${userId}`);
    res.json({ friends: result.rows });
  } catch (error) {
    console.error("❌ Get friends by userId error:", error);
    res.status(500).json({ friends: [], error: error.message });
  }
});

// ============================================================
// LEADERBOARD ENDPOINT
// ============================================================
app.get("/api/leaderboard", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    console.log(`📊 Getting leaderboard for user: ${userId}`);

    const result = await query(`
      SELECT 
        u.id, 
        u.name, 
        u.username, 
        u.profile_image,
        COUNT(DISTINCT p.id) as post_count,
        COUNT(DISTINCT pl.id) as like_count,
        COUNT(DISTINCT c.id) as comment_count,
        (COUNT(DISTINCT p.id) * 10 + 
         COUNT(DISTINCT pl.id) * 2 + 
         COUNT(DISTINCT c.id) * 5) as score
      FROM users u
      LEFT JOIN posts p ON p.user_id = u.id
      LEFT JOIN post_likes pl ON pl.user_id = u.id
      LEFT JOIN comments c ON c.user_id = u.id
      WHERE u.is_active = true
      GROUP BY u.id
      ORDER BY score DESC
      LIMIT 20
    `);

    const users = result.rows.map((user, index) => ({
      id: user.id,
      name: user.name,
      username: user.username,
      profileImage: user.profile_image || 'https://randomuser.me/api/portraits/men/1.jpg',
      score: parseInt(user.score) || 0,
      posts: parseInt(user.post_count) || 0,
      likes: parseInt(user.like_count) || 0,
      comments: parseInt(user.comment_count) || 0,
      rank: index + 1
    }));

    console.log(`📊 Leaderboard: ${users.length} users ranked`);
    res.json({ users });
  } catch (error) {
    console.error('❌ Leaderboard error:', error);
    // Return mock data if query fails
    const mockUsers = [
      { id: 1, name: '🌟 Star User', username: 'staruser', profileImage: 'https://randomuser.me/api/portraits/women/1.jpg', score: 450, rank: 1, posts: 15, likes: 120, comments: 45 },
      { id: 2, name: '🎉 Party King', username: 'partyking', profileImage: 'https://randomuser.me/api/portraits/men/2.jpg', score: 380, rank: 2, posts: 12, likes: 95, comments: 38 },
      { id: 3, name: '💝 Gift Master', username: 'giftmaster', profileImage: 'https://randomuser.me/api/portraits/women/3.jpg', score: 320, rank: 3, posts: 8, likes: 75, comments: 30 },
    ];
    res.json({ users: mockUsers });
  }
});
