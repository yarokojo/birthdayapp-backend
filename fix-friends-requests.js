// ✅ FIXED: GET /api/friends/requests - Get pending friend requests
app.get("/api/friends/requests", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    console.log(`👋 Getting friend requests for user: ${userId}`);

    // ✅ Get pending requests where current user is the recipient
    const result = await query(
      `SELECT 
        fr.id, 
        fr.from_user_id, 
        fr.status, 
        fr.created_at,
        u.id as "fromUserId",
        u.name as "fromUserName",
        u.username as "fromUserUsername",
        u.profile_image as "fromUserAvatar",
        u.birth_date as "fromUserBirthDate",
        u.phone as "fromUserPhone"
       FROM friend_requests fr
       JOIN users u ON u.id = fr.from_user_id
       WHERE fr.to_user_id = $1 AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [userId]
    );

    console.log(`👋 Found ${result.rows.length} pending friend requests for user ${userId}`);
    
    // ✅ Log each request for debugging
    result.rows.forEach((r, i) => {
      console.log(`  ${i + 1}. From: ${r.fromUserName} (${r.from_user_id})`);
    });

    res.json({ requests: result.rows });
  } catch (error) {
    console.error("❌ Get friend requests error:", error);
    res.json({ requests: [] });
  }
});
