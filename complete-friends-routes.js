// ============================================================
// ✅ COMPLETE FRIENDS ROUTES WITH DEBUG LOGS
// ============================================================

// GET /api/friends/list - Get friends
app.get("/api/friends/list", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    console.log(`👥 [FRIENDS] Getting friends list for user: ${userId}`);

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

    console.log(`👥 [FRIENDS] Found ${result.rows.length} friends`);
    res.json({ friends: result.rows });
  } catch (error) {
    console.error("❌ [FRIENDS] Get friends error:", error);
    res.json({ friends: [] });
  }
});

// GET /api/friends/requests - Get pending friend requests
app.get("/api/friends/requests", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    console.log(`👋 [FRIENDS] Getting friend requests for user: ${userId}`);

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
        u.birth_date as "fromUserBirthDate"
       FROM friend_requests fr
       JOIN users u ON u.id = fr.from_user_id
       WHERE fr.to_user_id = $1 AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [userId]
    );

    console.log(`👋 [FRIENDS] Found ${result.rows.length} pending requests for user ${userId}`);
    
    if (result.rows.length > 0) {
      result.rows.forEach((r, i) => {
        console.log(`  ${i + 1}. From: ${r.fromUserName} (ID: ${r.from_user_id})`);
      });
    }

    res.json({ requests: result.rows });
  } catch (error) {
    console.error("❌ [FRIENDS] Get friend requests error:", error);
    res.json({ requests: [] });
  }
});

// GET /api/friends/requests/sent - Get sent friend requests
app.get("/api/friends/requests/sent", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    console.log(`📤 [FRIENDS] Getting sent friend requests for user: ${userId}`);

    const result = await query(
      `SELECT 
        fr.id, 
        fr.to_user_id, 
        fr.status, 
        fr.created_at,
        u.id as "toUserId",
        u.name as "toUserName",
        u.username as "toUserUsername",
        u.profile_image as "toUserAvatar"
       FROM friend_requests fr
       JOIN users u ON u.id = fr.to_user_id
       WHERE fr.from_user_id = $1 AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [userId]
    );

    console.log(`📤 [FRIENDS] Found ${result.rows.length} sent requests`);
    res.json({ requests: result.rows });
  } catch (error) {
    console.error("❌ [FRIENDS] Get sent requests error:", error);
    res.json({ requests: [] });
  }
});

// POST /api/friends/request - Send friend request
app.post("/api/friends/request", verifyToken, async (req, res) => {
  const { toUserId } = req.body;
  const fromUserId = req.userId;

  console.log(`📤 [FRIENDS] Friend request from ${fromUserId} to ${toUserId}`);

  try {
    // Check if trying to add self
    if (fromUserId === parseInt(toUserId)) {
      return res.status(400).json({ error: "Cannot add yourself" });
    }

    // Check if already friends
    const existing = await query(
      `SELECT id FROM friends
       WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
      [fromUserId, toUserId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Already friends" });
    }

    // Check if request already sent
    const requestExists = await query(
      `SELECT id FROM friend_requests
       WHERE from_user_id = $1 AND to_user_id = $2 AND status = 'pending'`,
      [fromUserId, toUserId]
    );
    if (requestExists.rows.length > 0) {
      return res.status(400).json({ error: "Request already sent" });
    }

    // Create friend request
    const result = await query(
      `INSERT INTO friend_requests (from_user_id, to_user_id, status, created_at)
       VALUES ($1, $2, 'pending', CURRENT_TIMESTAMP)
       RETURNING id, from_user_id, to_user_id, status, created_at`,
      [fromUserId, toUserId]
    );

    console.log(`✅ [FRIENDS] Friend request sent: ${result.rows[0].id}`);

    // Get sender info for notification
    const sender = await query(
      `SELECT name, profile_image FROM users WHERE id = $1`,
      [fromUserId]
    );

    // Create notification for recipient
    if (sender.rows.length > 0) {
      await query(
        `INSERT INTO notifications (user_id, type, title, message, image_url, target_id, target_name, created_at)
         VALUES ($1, 'friend_request', '👋 Friend Request', $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [
          toUserId,
          `${sender.rows[0].name} sent you a friend request!`,
          sender.rows[0].profile_image || 'https://randomuser.me/api/portraits/men/1.jpg',
          fromUserId,
          sender.rows[0].name
        ]
      );
      console.log(`✅ [FRIENDS] Notification created for user ${toUserId}`);
    }

    res.json({ 
      success: true, 
      request: result.rows[0],
      message: "Friend request sent successfully!"
    });
  } catch (error) {
    console.error("❌ [FRIENDS] Send request error:", error);
    res.status(500).json({ error: "Failed to send friend request" });
  }
});

// POST /api/friends/accept - Accept friend request
app.post("/api/friends/accept", verifyToken, async (req, res) => {
  const { requestId } = req.body;
  const userId = req.userId;

  console.log(`✅ [FRIENDS] Accepting friend request: ${requestId} for user ${userId}`);

  try {
    // Get the request
    const request = await query(
      `SELECT from_user_id, to_user_id FROM friend_requests
       WHERE id = $1 AND to_user_id = $2 AND status = 'pending'`,
      [requestId, userId]
    );

    if (request.rows.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    const { from_user_id, to_user_id } = request.rows[0];

    // Update request status
    await query(
      `UPDATE friend_requests
       SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [requestId]
    );

    // Create bidirectional friendship
    await query(
      `INSERT INTO friends (user_id, friend_id, created_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP), ($2, $1, CURRENT_TIMESTAMP)`,
      [from_user_id, to_user_id]
    );

    console.log(`✅ [FRIENDS] Friend request accepted: ${requestId}`);

    // Get user info for notification
    const user = await query(
      `SELECT name, profile_image FROM users WHERE id = $1`,
      [to_user_id]
    );

    // Create notification for sender
    if (user.rows.length > 0) {
      await query(
        `INSERT INTO notifications (user_id, type, title, message, image_url, target_id, target_name, created_at)
         VALUES ($1, 'friend_accept', '✅ Friend Request Accepted', $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [
          from_user_id,
          `${user.rows[0].name} accepted your friend request!`,
          user.rows[0].profile_image || 'https://randomuser.me/api/portraits/men/1.jpg',
          to_user_id,
          user.rows[0].name
        ]
      );
      console.log(`✅ [FRIENDS] Notification created for user ${from_user_id}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("❌ [FRIENDS] Accept request error:", error);
    res.status(500).json({ error: "Failed to accept friend request" });
  }
});

// POST /api/friends/decline - Decline friend request
app.post("/api/friends/decline", verifyToken, async (req, res) => {
  const { requestId } = req.body;
  const userId = req.userId;

  console.log(`❌ [FRIENDS] Declining friend request: ${requestId} for user ${userId}`);

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

    console.log(`✅ [FRIENDS] Friend request declined: ${requestId}`);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ [FRIENDS] Decline request error:", error);
    res.status(500).json({ error: "Failed to decline friend request" });
  }
});

// DELETE /api/friends/:friendId - Remove friend
app.delete("/api/friends/:friendId", verifyToken, async (req, res) => {
  const { friendId } = req.params;
  const userId = req.userId;

  console.log(`🗑️ [FRIENDS] Removing friend ${friendId} for user ${userId}`);

  try {
    await query(
      `DELETE FROM friends
       WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
      [userId, friendId]
    );

    console.log(`✅ [FRIENDS] Friend removed: ${friendId}`);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ [FRIENDS] Remove friend error:", error);
    res.status(500).json({ error: "Failed to remove friend" });
  }
});
