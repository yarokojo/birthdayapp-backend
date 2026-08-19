// ============================================================
// GET /api/friends/birthdays - Get friends birthdays (FIXED)
// ============================================================
app.get('/api/friends/birthdays', verifyToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.username, u.profile_image, u.birth_date, u.phone, u.network 
       FROM friends f 
       JOIN users u ON u.id = f.friend_id 
       WHERE f.user_id = $1 AND u.birth_date IS NOT NULL 
       ORDER BY EXTRACT(MONTH FROM u.birth_date), EXTRACT(DAY FROM u.birth_date)`,
      [req.userId]
    );
    res.json({ friendsBirthdays: result.rows });
  } catch (error) {
    console.error("❌ Get birthdays error:", error);
    res.json({ friendsBirthdays: [] });
  }
});
