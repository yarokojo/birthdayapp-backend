const express = require('express');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET / - Get notifications for current user
// ============================================================
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    console.log(`📨 Getting notifications for user: ${userId}`);
    
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

// ============================================================
// GET /:userId - Get notifications for specific user (self only)
// ============================================================
router.get('/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`📨 Getting notifications for user: ${userId}`);
    
    // ✅ Only allow users to see their own notifications
    if (parseInt(userId) !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
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

// ============================================================
// POST / - Create notification
// ============================================================
router.post('/', requireAuth, async (req, res) => {
  try {
    const { userId, type, title, message, imageUrl, targetId, targetName, extraData } = req.body;
    
    console.log(`📨 Creating notification for user: ${userId}`);
    
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

// ============================================================
// PUT /:id/read - Mark notification as read
// ============================================================
router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// ============================================================
// PUT /read-all - Mark all notifications as read
// ============================================================
router.put('/read-all', requireAuth, async (req, res) => {
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

// ============================================================
// DELETE /:id - Delete notification
// ============================================================
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

module.exports = router;
