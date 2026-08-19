// ============================================================
// GET /api/friends/requests - Get pending friend requests (FIXED)
// ============================================================
app.get('/api/friends/requests', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    console.log(`👋 Getting friend requests for user: ${userId}`);

    // ✅ Fixed: using single quotes for 'pending'
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
    res.json({ requests: [] });
  }
});
