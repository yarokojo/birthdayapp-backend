const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET /events/me - Get user's calendar events
// ============================================================
router.get('/events/me', requireAuth, async (req, res) => {
  try {
    console.log(`📅 Getting calendar events for user: ${req.userId}`);
    
    const result = await query(
      `SELECT id, title, date, type, celebrant_name, celebrant_id, 
              reminder_set, reminder_time, created_at
       FROM calendar_events
       WHERE user_id = $1
       ORDER BY date ASC`,
      [req.userId]
    );
    
    res.json({ events: result.rows });
  } catch (error) {
    console.error('❌ Get calendar events error:', error);
    // Return mock events if table doesn't exist
    res.json({ events: [] });
  }
});

// ============================================================
// POST /events - Create calendar event
// ============================================================
router.post('/events', requireAuth, [
  body('title').notEmpty(),
  body('date').notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }
    
    const { title, date, type, celebrantName, celebrantId, reminderSet } = req.body;
    
    const result = await query(
      `INSERT INTO calendar_events (user_id, title, date, type, celebrant_name, celebrant_id, reminder_set)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.userId, title, date, type || 'birthday', celebrantName, celebrantId, reminderSet || false]
    );
    
    res.status(201).json({ event: result.rows[0] });
  } catch (error) {
    console.error('❌ Create calendar event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// ============================================================
// DELETE /events/:id - Delete calendar event
// ============================================================
router.delete('/events/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    await query(
      'DELETE FROM calendar_events WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Delete calendar event error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// ============================================================
// PUT /events/:id/reminder - Toggle reminder
// ============================================================
router.put('/events/:id/reminder', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      `UPDATE calendar_events 
       SET reminder_set = NOT reminder_set, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, req.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({ event: result.rows[0] });
  } catch (error) {
    console.error('❌ Toggle reminder error:', error);
    res.status(500).json({ error: 'Failed to toggle reminder' });
  }
});

module.exports = router;
