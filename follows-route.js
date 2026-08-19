// ============================================================
// GET /api/follows - Get users the current user follows
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

// POST /api/follows/:userId - Follow a user
app.post('/api/follows/:userId', verifyToken, async (req, res) => {
  try {
    const followerId = req.userId;
    const followingId = req.params.userId;
    
    if (followerId === parseInt(followingId)) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }
    
    // Check if already following
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

// DELETE /api/follows/:userId - Unfollow a user
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
