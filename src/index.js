
// ============================================================
// STORIES ROUTES
// ============================================================

// GET /api/stories - Get all stories
app.get('/api/stories', verifyToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT s.*, u.name as user_name, u.username as user_handle, u.profile_image as user_avatar
       FROM stories s
       JOIN users u ON u.id = s.user_id
       WHERE s.expires_at > NOW()
       ORDER BY s.created_at DESC`
    );
    res.json({ stories: result.rows });
  } catch (error) {
    console.error('Get stories error:', error);
    res.json({ stories: [] });
  }
});

// POST /api/stories - Create a story
app.post('/api/stories', verifyToken, upload.single('content'), async (req, res) => {
  try {
    const { isVideo, caption } = req.body;
    const userId = req.userId;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No content uploaded' });
    }
    
    const contentUrl = `http://localhost:5000/uploads/${req.file.filename}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    const result = await query(
      `INSERT INTO stories (user_id, content_url, is_video, caption, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, contentUrl, isVideo === 'true', caption || '', expiresAt]
    );
    
    res.status(201).json({ story: result.rows[0] });
  } catch (error) {
    console.error('Create story error:', error);
    res.status(500).json({ error: 'Failed to create story' });
  }
});

// POST /api/stories/:id/view - Mark story as viewed
app.post('/api/stories/:id/view', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    await query(
      `INSERT INTO story_views (story_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (story_id, user_id) DO NOTHING`,
      [id, userId]
    );
    
    await query(
      'UPDATE stories SET views_count = views_count + 1 WHERE id = $1',
      [id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('View story error:', error);
    res.json({ success: true });
  }
});

// POST /api/stories/:id/like - Like a story
app.post('/api/stories/:id/like', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
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
    console.error('Like story error:', error);
    res.status(500).json({ error: 'Failed to like story' });
  }
});

// DELETE /api/stories/:id/like - Unlike a story
app.delete('/api/stories/:id/like', verifyToken, async (req, res) => {
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
    console.error('Unlike story error:', error);
    res.status(500).json({ error: 'Failed to unlike story' });
  }
});
