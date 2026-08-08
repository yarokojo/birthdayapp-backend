const express = require('express');
const router = express.Router();

// Get banners
router.get('/', (req, res) => {
  res.json({
    banners: [
      {
        id: 'b1',
        title: '🎉 Welcome to BirthdayApp!',
        subtitle: 'Celebrate every moment',
        icon: '🎂',
        colors: ['#6366f1', '#8b5cf6', '#a855f7'],
        type: 'celebrations',
        link: 'today',
        active: true,
        priority: 1
      },
      {
        id: 'b2',
        title: '🎁 Gift Shop',
        subtitle: 'Send a gift to someone special',
        icon: '🎁',
        colors: ['#ec4899', '#f472b6', '#f9a8d4'],
        type: 'gifts',
        link: 'gift_shop',
        active: true,
        priority: 2
      }
    ]
  });
});

// Track banner view
router.post('/:id/view', (req, res) => {
  res.json({ success: true });
});

// Track banner click
router.post('/:id/click', (req, res) => {
  res.json({ success: true });
});

module.exports = router;
