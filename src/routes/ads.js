const express = require('express');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ✅ Get all active ads
router.get('/', requireAuth, async (req, res) => {
  try {
    // Try to get from database
    const result = await query(
      `SELECT id, title, description, image_url, destination_url, 
              advertiser, type, frequency, active, created_at, expires_at
       FROM ads 
       WHERE active = true AND expires_at > NOW()
       ORDER BY created_at DESC`
    ).catch(() => ({ rows: [] }));

    if (result.rows.length > 0) {
      return res.json({ ads: result.rows });
    }

    // Fallback ads
    const fallbackAds = [
      {
        id: 'ad_1',
        title: '🎁 Send a Gift!',
        description: 'Make someone\'s day special with a gift',
        image_url: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400&h=200&fit=crop',
        destination_url: '/gift_shop',
        advertiser: 'BirthdayApp',
        type: 'banner',
        frequency: 1,
        active: true,
      },
      {
        id: 'ad_2',
        title: '💎 Premium Gifts',
        description: 'Exclusive premium gifts for your loved ones',
        image_url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400&h=200&fit=crop',
        destination_url: '/premium_shop',
        advertiser: 'BirthdayApp',
        type: 'native',
        frequency: 8,
        active: true,
      },
      {
        id: 'ad_3',
        title: '📢 Birthday Reminder',
        description: 'Never miss a birthday again!',
        image_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=200&fit=crop',
        destination_url: '/calendar',
        advertiser: 'BirthdayApp',
        type: 'banner',
        frequency: 1,
        active: true,
      },
      {
        id: 'ad_4',
        title: '🎂 Today\'s Celebrations',
        description: 'See who\'s celebrating today!',
        image_url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&h=200&fit=crop',
        destination_url: '/today',
        advertiser: 'BirthdayApp',
        type: 'native',
        frequency: 12,
        active: true,
      },
    ];

    res.json({ ads: fallbackAds });
  } catch (error) {
    console.error('Failed to get ads:', error);
    res.json({ ads: [] });
  }
});

// ✅ Track ad view
router.post('/view', requireAuth, async (req, res) => {
  const { adId } = req.body;
  const userId = req.userId;
  console.log(`👁️ Ad viewed: ${adId} by user ${userId}`);
  res.json({ success: true });
});

// ✅ Track ad click
router.post('/click', requireAuth, async (req, res) => {
  const { adId } = req.body;
  const userId = req.userId;
  console.log(`👆 Ad clicked: ${adId} by user ${userId}`);
  res.json({ success: true });
});

// ✅ Track rewarded ad
router.post('/reward', requireAuth, async (req, res) => {
  const { adId } = req.body;
  const userId = req.userId;
  console.log(`🎁 Rewarded ad completed: ${adId} by user ${userId}`);
  res.json({ success: true });
});

module.exports = router;
