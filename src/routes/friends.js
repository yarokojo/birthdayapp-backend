const express = require('express');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /list - Get friends list
router.get('/list', requireAuth, async (req, res) => {
  try {
    console.log(`👥 Getting friends list for user: ${req.userId}`);
    
    const result = await query(
      `SELECT u.id, u.name, u.username, u.profile_image, u.birth_date, u.phone, u.network
       FROM friends f
       JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = $1
       ORDER BY u.name ASC`,
      [req.userId]
    );
    
    console.log(`👥 Found ${result.rows.length} friends`);
    res.json({ friends: result.rows });
  } catch (error) {
    console.error('❌ Get friends error:', error);
    res.json({ friends: [] });
  }
});

// GET /requests - Get friend requests
router.get('/requests', requireAuth, async (req, res) => {
  try {
    console.log(`👋 Getting friend requests for user: ${req.userId}`);
    
    const result = await query(
      `SELECT fr.id, fr.from_user_id, fr.status, fr.created_at,
              u.name, u.username, u.profile_image
       FROM friend_requests fr
       JOIN users u ON u.id = fr.from_user_id
       WHERE fr.to_user_id = $1 AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [req.userId]
    );
    
    console.log(`👋 Found ${result.rows.length} friend requests`);
    res.json({ requests: result.rows });
  } catch (error) {
    console.error('❌ Get friend requests error:', error);
    res.json({ requests: [] });
  }
});

// GET /birthdays - Get friends birthdays
router.get('/birthdays', requireAuth, async (req, res) => {
  try {
    console.log(`🎂 Getting friends birthdays for user: ${req.userId}`);
    
    const result = await query(
      `SELECT u.id, u.name, u.username, u.profile_image, u.birth_date, u.phone, u.network
       FROM friends f
       JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = $1
       AND u.birth_date IS NOT NULL
       ORDER BY EXTRACT(MONTH FROM u.birth_date), EXTRACT(DAY FROM u.birth_date)`,
      [req.userId]
    );
    
    console.log(`🎂 Found ${result.rows.length} friends with birthdays`);
    res.json({ friendsBirthdays: result.rows });
  } catch (error) {
    console.error('❌ Get birthdays error:', error);
    res.json({ friendsBirthdays: [] });
  }
});

// POST /request - Send friend request
router.post('/request', requireAuth, async (req, res) => {
  const { toUserId } = req.body;
  const fromUserId = req.userId;

  try {
    if (fromUserId === toUserId) {
      return res.status(400).json({ error: 'Cannot add yourself' });
    }

    const existing = await query(
      `SELECT id FROM friends
       WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
      [fromUserId, toUserId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Already friends' });
    }

    const requestExists = await query(
      `SELECT id FROM friend_requests
       WHERE from_user_id = $1 AND to_user_id = $2 AND status = 'pending'`,
      [fromUserId, toUserId]
    );
    if (requestExists.rows.length > 0) {
      return res.status(400).json({ error: 'Request already sent' });
    }

    await query(
      `INSERT INTO friend_requests (from_user_id, to_user_id)
       VALUES ($1, $2)`,
      [fromUserId, toUserId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Send request error:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// POST /accept - Accept friend request
router.post('/accept', requireAuth, async (req, res) => {
  const { requestId } = req.body;

  try {
    const result = await query(
      `UPDATE friend_requests
       SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND to_user_id = $2
       RETURNING from_user_id, to_user_id`,
      [requestId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const { from_user_id, to_user_id } = result.rows[0];

    await query(
      `INSERT INTO friends (user_id, friend_id)
       VALUES ($1, $2), ($2, $1)`,
      [from_user_id, to_user_id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Accept request error:', error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

// POST /decline - Decline friend request
router.post('/decline', requireAuth, async (req, res) => {
  const { requestId } = req.body;

  try {
    await query(
      `UPDATE friend_requests
       SET status = 'declined', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND to_user_id = $2`,
      [requestId, req.userId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Decline request error:', error);
    res.status(500).json({ error: 'Failed to decline friend request' });
  }
});

// DELETE /:friendId - Remove friend
router.delete('/:friendId', requireAuth, async (req, res) => {
  const { friendId } = req.params;

  try {
    await query(
      `DELETE FROM friends
       WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
      [req.userId, friendId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Remove friend error:', error);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

module.exports = router;
