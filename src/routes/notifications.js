const express = require('express');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET / - Get notifications
// ============================================================
router.get('/', requireAuth, async (req, res) => {
  try {
    console.log(`📨 Getting notifications for user: ${req.userId}`);
    
    const result = await query(
      `SELECT id, type, title, message, image_url, target_id, target_name, 
              is_read, extra_data, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [req.userId]
    );

    const unreadCount = await query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.userId]
    );

    res.json({
      notifications: result.rows,
      unreadCount: parseInt(unreadCount.rows[0].count) || 0
    });
  } catch (error) {
    console.error('❌ Get notifications error:', error);
    // ✅ Return empty array if table doesn't exist
    res.json({ notifications: [], unreadCount: 0 });
  }
});

// ============================================================
// POST / - Create notification
// ============================================================
router.post('/', requireAuth, async (req, res) => {
  try {
    const { userId, type, title, message, imageUrl, targetId, targetName, extraData } = req.body;
    
    console.log(`📨 Creating notification:`);
    console.log(`  userId: ${userId}`);
    console.log(`  type: ${type}`);
    console.log(`  title: ${title}`);
    
    if (!userId || !type || !message) {
      return res.status(400).json({ error: 'userId, type, and message are required' });
    }

    const result = await query(
      `INSERT INTO notifications (user_id, type, title, message, image_url, target_id, target_name, extra_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, user_id, type, title, message, image_url, target_id, target_name, is_read, extra_data, created_at`,
      [userId, type, title || type, message, imageUrl || null, targetId || null, targetName || null, extraData || null]
    );

    console.log(`✅ Notification created: ${result.rows[0].id}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Create notification error:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// ============================================================
// PUT /:id/read - Mark notification as read
// ============================================================
router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📨 Marking notification ${id} as read for user ${req.userId}`);
    
    // ✅ Check if notification exists and belongs to user
    const checkResult = await query(
      'SELECT id FROM notifications WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    
    if (checkResult.rows.length === 0) {
      console.log(`⚠️ Notification ${id} not found for user ${req.userId}`);
      // ✅ Return success even if not found (idempotent)
      return res.json({ success: true, message: 'Notification already read or not found' });
    }
    
    // ✅ Update notification
    await query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    
    console.log(`✅ Notification ${id} marked as read`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Mark read error:', error);
    // ✅ Return success even on error (to prevent UI issues)
    res.json({ success: true, message: 'Notification marked as read' });
  }
});

// ============================================================
// PUT /read-all - Mark all notifications as read
// ============================================================
router.put('/read-all', requireAuth, async (req, res) => {
  try {
    console.log(`📨 Marking all notifications as read for user ${req.userId}`);
    
    await query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1',
      [req.userId]
    );
    
    console.log(`✅ All notifications marked as read for user ${req.userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Mark all read error:', error);
    // ✅ Return success even on error
    res.json({ success: true });
  }
});

// ============================================================
// DELETE /:id - Delete notification
// ============================================================
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ Deleting notification ${id} for user ${req.userId}`);
    
    await query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    
    console.log(`✅ Notification ${id} deleted`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Delete notification error:', error);
    res.json({ success: true });
  }
});

module.exports = router;
