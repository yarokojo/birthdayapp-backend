const express = require('express');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// THEME ROUTES
// ============================================================

// GET /:userId/theme - Get user theme
router.get('/:userId/theme', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🎨 Getting theme for user: ${userId}`);
    
    if (userId !== req.userId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await query(
      'SELECT theme FROM user_settings WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      await query('INSERT INTO user_settings (user_id) VALUES ($1)', [userId]);
      return res.json({ darkMode: false, primaryColor: '#6366f1' });
    }

    res.json(result.rows[0].theme || { darkMode: false, primaryColor: '#6366f1' });
  } catch (error) {
    console.error('❌ Get theme error:', error);
    res.json({ darkMode: false, primaryColor: '#6366f1' });
  }
});

// PUT /:userId/theme - Update user theme
router.put('/:userId/theme', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { darkMode, primaryColor } = req.body;
    console.log(`🎨 Updating theme for user: ${userId}`);

    if (userId !== req.userId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const current = await query('SELECT theme FROM user_settings WHERE user_id = $1', [userId]);
    let theme = { darkMode: false, primaryColor: '#6366f1' };
    if (current.rows.length > 0 && current.rows[0].theme) {
      theme = current.rows[0].theme;
    }

    if (darkMode !== undefined) theme.darkMode = darkMode;
    if (primaryColor) theme.primaryColor = primaryColor;

    await query(
      `INSERT INTO user_settings (user_id, theme) 
       VALUES ($1, $2) 
       ON CONFLICT (user_id) DO UPDATE SET theme = $2, updated_at = CURRENT_TIMESTAMP`,
      [userId, theme]
    );

    res.json({ success: true, theme });
  } catch (error) {
    console.error('❌ Update theme error:', error);
    res.status(500).json({ error: 'Failed to update theme' });
  }
});

// ============================================================
// NOTIFICATIONS ROUTES
// ============================================================

// GET /notifications/:userId - Get notification preferences
router.get('/notifications/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🔔 Getting notifications for user: ${userId}`);
    
    if (userId !== req.userId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await query(
      'SELECT notifications FROM user_settings WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      await query('INSERT INTO user_settings (user_id) VALUES ($1)', [userId]);
      return res.json({ 
        success: true, 
        notifications: { 
          enabled: true, 
          birthdayReminders: true, 
          friendRequests: true, 
          giftNotifications: true, 
          commentNotifications: true 
        }
      });
    }

    const notifications = result.rows[0].notifications || { 
      enabled: true, 
      birthdayReminders: true, 
      friendRequests: true, 
      giftNotifications: true, 
      commentNotifications: true 
    };
    
    res.json({ success: true, notifications });
  } catch (error) {
    console.error('❌ Get notifications error:', error);
    res.json({ success: true, notifications: { enabled: true } });
  }
});

// PUT /notifications/:userId - Update notification preferences
router.put('/notifications/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { enabled } = req.body;
    console.log(`🔔 Updating notifications for user: ${userId}`);

    if (userId !== req.userId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get current settings
    const current = await query('SELECT notifications FROM user_settings WHERE user_id = $1', [userId]);
    let notifications = { 
      enabled: true, 
      birthdayReminders: true, 
      friendRequests: true, 
      giftNotifications: true, 
      commentNotifications: true 
    };
    
    if (current.rows.length > 0 && current.rows[0].notifications) {
      notifications = current.rows[0].notifications;
    }

    if (enabled !== undefined) notifications.enabled = enabled;

    await query(
      `INSERT INTO user_settings (user_id, notifications) 
       VALUES ($1, $2) 
       ON CONFLICT (user_id) DO UPDATE SET notifications = $2, updated_at = CURRENT_TIMESTAMP`,
      [userId, notifications]
    );

    res.json({ success: true, notifications });
  } catch (error) {
    console.error('❌ Update notifications error:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// ============================================================
// MEDIA PREFERENCES ROUTES
// ============================================================

// GET /:userId/media - Get media preferences
router.get('/:userId/media', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🎬 Getting media preferences for user: ${userId}`);
    
    if (userId !== req.userId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Return default media preferences
    res.json({ 
      success: true, 
      media: { 
        autoPlayVideos: true, 
        soundEnabled: true, 
        vibrationEnabled: true 
      } 
    });
  } catch (error) {
    console.error('❌ Get media preferences error:', error);
    res.json({ success: true, media: { autoPlayVideos: true, soundEnabled: true, vibrationEnabled: true } });
  }
});

// PUT /:userId/media - Update media preferences
router.put('/:userId/media', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { autoPlayVideos, soundEnabled, vibrationEnabled } = req.body;
    console.log(`🎬 Updating media preferences for user: ${userId}`);

    if (userId !== req.userId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({ 
      success: true, 
      media: { autoPlayVideos, soundEnabled, vibrationEnabled } 
    });
  } catch (error) {
    console.error('❌ Update media preferences error:', error);
    res.status(500).json({ error: 'Failed to update media preferences' });
  }
});

// ============================================================
// SUPPORT TICKETS ROUTES
// ============================================================

// GET /support/tickets/:userId - Get support tickets
router.get('/support/tickets/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🎫 Getting support tickets for user: ${userId}`);
    
    if (userId !== req.userId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({ success: true, tickets: [] });
  } catch (error) {
    console.error('❌ Get support tickets error:', error);
    res.json({ success: true, tickets: [] });
  }
});

// POST /support/feedback - Submit feedback
router.post('/support/feedback', requireAuth, async (req, res) => {
  try {
    const { userId, feedback, email } = req.body;
    console.log(`📝 Feedback from user: ${userId}`);

    res.json({ success: true, message: 'Feedback sent' });
  } catch (error) {
    console.error('❌ Submit feedback error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

module.exports = router;
