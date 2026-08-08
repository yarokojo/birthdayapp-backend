const express = require('express');
const router = express.Router();

// Get stories
router.get('/', (req, res) => {
  res.json({ stories: [] });
});

// Create story
router.post('/', (req, res) => {
  res.status(201).json({ success: true, story: req.body });
});

// Mark story as seen
router.post('/seen', (req, res) => {
  res.json({ success: true });
});

// Get seen stories
router.get('/seen/:userId', (req, res) => {
  res.json({ seenStoryIds: [] });
});

// Like story
router.post('/:id/like', (req, res) => {
  res.json({ success: true });
});

// Unlike story
router.delete('/:id/like', (req, res) => {
  res.json({ success: true });
});

// Delete story
router.delete('/:id', (req, res) => {
  res.json({ success: true });
});

module.exports = router;
