// ============================================================
// ✅ COMPLETE FIXED FRIENDS ROUTES
// ============================================================

// GET /api/friends/list - Get all friends of current user
app.get("/api/friends/list", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    console.log(`👥 Getting friends list for user: ${userId}`);

    // ✅ Get friends from friends table
    const result = await query(
      `SELECT 
        u.id, 
        u.name, 
        u.username, 
        u.profile_image, 
        u.birth_date, 
        u.phone, 
        u.network,
        u.bio,
        u.location
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

// GET /api/friends/list/:userId - Get friends of a specific user
app.get("/api/friends/list/:userId", verifyToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log(`👥 Getting friends list for user: ${userId}`);

    const result = await query(
      `SELECT 
        u.id, 
        u.name, 
        u.username, 
        u.profile_image, 
        u.birth_date, 
        u.phone, 
        u.network
       FROM friends f
       JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = $1
       ORDER BY u.name ASC`,
      [userId]
    );

    res.json({ friends: result.rows });
  } catch (error) {
    console.error("❌ Get friends error:", error);
    res.json({ friends: [] });
  }
});

// GET /api/friends/requests - Get pending friend requests
app.get("/api/friends/requests", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    console.log(`👋 Getting friend requests for user: ${userId}`);

    const result = await query(
      `SELECT 
        fr.id, 
        fr.from_user_id, 
        fr.status, 
        fr.created_at,
        u.id as "fromUserId",
        u.name as "fromUserName",
        u.username as "fromUserUsername",
        u.profile_image as "fromUserAvatar"
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

// POST /api/friends/request - Send a friend request
app.post("/api/friends/request", verifyToken, async (req, res) => {
  const { toUserId } = req.body;
  const fromUserId = req.userId;

  console.log(`📤 Friend request from ${fromUserId} to ${toUserId}`);

  try {
    // ✅ Check if trying to add self
    if (fromUserId === parseInt(toUserId)) {
      return res.status(400).json({ error: "Cannot add yourself" });
    }

    // ✅ Check if already friends
    const existing = await query(
      `SELECT id FROM friends
       WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
      [fromUserId, toUserId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Already friends" });
    }

    // ✅ Check if request already sent
    const requestExists = await query(
      `SELECT id FROM friend_requests
       WHERE from_user_id = $1 AND to_user_id = $2 AND status = 'pending'`,
      [fromUserId, toUserId]
    );
    if (requestExists.rows.length > 0) {
      return res.status(400).json({ error: "Request already sent" });
    }

    // ✅ Create friend request
    const result = await query(
      `INSERT INTO friend_requests (from_user_id, to_user_id, status)
       VALUES ($1, $2, 'pending')
       RETURNING id, from_user_id, to_user_id, status, created_at`,
      [fromUserId, toUserId]
    );

    // ✅ Get sender info for notification
    const sender = await query(
      `SELECT name, profile_image FROM users WHERE id = $1`,
      [fromUserId]
    );

    // ✅ Create notification for recipient
    if (sender.rows.length > 0) {
      await query(
        `INSERT INTO notifications (user_id, type, title, message, image_url, target_id, target_name)
         VALUES ($1, 'friend_request', '👋 Friend Request', $2, $3, $4, $5)`,
        [
          toUserId,
          `${sender.rows[0].name} sent you a friend request!`,
          sender.rows[0].profile_image || 'https://randomuser.me/api/portraits/men/1.jpg',
          fromUserId,
          sender.rows[0].name
        ]
      );
    }

    console.log(`✅ Friend request sent: ${result.rows[0].id}`);
    res.json({ success: true, request: result.rows[0] });
  } catch (error) {
    console.error("❌ Send request error:", error);
    res.status(500).json({ error: "Failed to send friend request" });
  }
});

// POST /api/friends/accept - Accept a friend request
app.post("/api/friends/accept", verifyToken, async (req, res) => {
  const { requestId } = req.body;
  const userId = req.userId;

  console.log(`✅ Accepting friend request: ${requestId}`);

  try {
    // ✅ Get the request
    const request = await query(
      `SELECT from_user_id, to_user_id FROM friend_requests
       WHERE id = $1 AND to_user_id = $2 AND status = 'pending'`,
      [requestId, userId]
    );

    if (request.rows.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    const { from_user_id, to_user_id } = request.rows[0];

    // ✅ Update request status
    await query(
      `UPDATE friend_requests
       SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [requestId]
    );

    // ✅ Create bidirectional friendship
    await query(
      `INSERT INTO friends (user_id, friend_id)
       VALUES ($1, $2), ($2, $1)`,
      [from_user_id, to_user_id]
    );

    // ✅ Get user info for notification
    const user = await query(
      `SELECT name, profile_image FROM users WHERE id = $1`,
      [to_user_id]
    );

    // ✅ Create notification for sender
    if (user.rows.length > 0) {
      await query(
        `INSERT INTO notifications (user_id, type, title, message, image_url, target_id, target_name)
         VALUES ($1, 'friend_accept', '✅ Friend Request Accepted', $2, $3, $4, $5)`,
        [
          from_user_id,
          `${user.rows[0].name} accepted your friend request!`,
          user.rows[0].profile_image || 'https://randomuser.me/api/portraits/men/1.jpg',
          to_user_id,
          user.rows[0].name
        ]
      );
    }

    console.log(`✅ Friend request accepted: ${requestId}`);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Accept request error:", error);
    res.status(500).json({ error: "Failed to accept friend request" });
  }
});

// POST /api/friends/decline - Decline a friend request
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

// DELETE /api/friends/:friendId - Remove a friend
app.delete("/api/friends/:friendId", verifyToken, async (req, res) => {
  const { friendId } = req.params;
  const userId = req.userId;

  console.log(`🗑️ Removing friend ${friendId} for user ${userId}`);

  try {
    // ✅ Remove friendship (both directions)
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

// GET /api/friends/birthdays - Get friends with birthdays
app.get("/api/friends/birthdays", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    console.log(`🎂 Getting friends birthdays for user: ${userId}`);

    const result = await query(
      `SELECT 
        u.id, 
        u.name, 
        u.username, 
        u.profile_image, 
        u.birth_date, 
        u.phone, 
        u.network
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

// GET /api/users - Get all users (for search)
app.get("/api/users", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    console.log(`👥 Getting all users (excluding self)`);

    const result = await query(
      `SELECT 
        id, 
        name, 
        username, 
        profile_image, 
        bio, 
        birth_date, 
        phone, 
        network
       FROM users
       WHERE id != $1
       AND is_active = true
       ORDER BY name ASC
       LIMIT 50`,
      [userId]
    );

    console.log(`👥 Found ${result.rows.length} users`);
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Get users error:", error);
    res.json([]);
  }
});
