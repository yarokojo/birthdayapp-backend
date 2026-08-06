const express = require('express');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET / - Get active banners
// ============================================================
router.get('/', requireAuth, async (req, res) => {
  try {
    console.log('📢 Fetching banners...');
    
    const result = await query(
      `SELECT id, title, subtitle, icon, colors, type, link, active, priority, 
              views_count, clicks_count, created_at
       FROM banners 
       WHERE active = true 
       ORDER BY priority ASC`
    );
    
    console.log(`📢 Found ${result.rows.length} banners`);
    
    // If no banners in DB, return fallback banners
    if (result.rows.length === 0) {
      const fallbackBanners = [
        {
          id: 'banner_fallback_1',
          title: '🎉 Today\'s Celebrations',
          subtitle: 'Check out today\'s events!',
          icon: '🎂',
          colors: ['#6366f1', '#8b5cf6', '#a855f7'],
          type: 'celebrations',
          link: 'today',
          active: true,
          priority: 1,
          views_count: 0,
          clicks_count: 0,
          created_at: new Date().toISOString()
        },
        {
          id: 'banner_fallback_2',
          title: '🎁 Gift Shop',
          subtitle: 'Send a gift to someone special',
          icon: '🎁',
          colors: ['#ec4899', '#f472b6', '#f9a8d4'],
          type: 'gifts',
          link: 'gift_shop',
          active: true,
          priority: 2,
          views_count: 0,
          clicks_count: 0,
          created_at: new Date().toISOString()
        }
      ];
      
      return res.json({ success: true, banners: fallbackBanners });
    }
    
    res.json({ success: true, banners: result.rows });
  } catch (error) {
    console.error('❌ Get banners error:', error);
    // Return fallback banners on error
    const fallbackBanners = [
      {
        id: 'banner_fallback_1',
        title: '🎉 Today\'s Celebrations',
        subtitle: 'Check out today\'s events!',
        icon: '🎂',
        colors: ['#6366f1', '#8b5cf6', '#a855f7'],
        type: 'celebrations',
        link: 'today',
        active: true,
        priority: 1,
        views_count: 0,
        clicks_count: 0,
        created_at: new Date().toISOString()
      },
      {
        id: 'banner_fallback_2',
        title: '🎁 Gift Shop',
        subtitle: 'Send a gift to someone special',
        icon: '🎁',
        colors: ['#ec4899', '#f472b6', '#f9a8d4'],
        type: 'gifts',
        link: 'gift_shop',
        active: true,
        priority: 2,
        views_count: 0,
        clicks_count: 0,
        created_at: new Date().toISOString()
      }
    ];
    res.json({ success: true, banners: fallbackBanners });
  }
});

// ============================================================
// POST /:id/view - Track banner view
// ============================================================
router.post('/:id/view', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`👁️ Tracking view for banner: ${id}`);
    
    await query(
      'UPDATE banners SET views_count = views_count + 1 WHERE id = $1',
      [id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Track view error:', error);
    res.json({ success: true }); // Always return success
  }
});

// ============================================================
// POST /:id/click - Track banner click
// ============================================================
router.post('/:id/click', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`👆 Tracking click for banner: ${id}`);
    
    await query(
      'UPDATE banners SET clicks_count = clicks_count + 1 WHERE id = $1',
      [id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Track click error:', error);
    res.json({ success: true });
  }
});

module.exports = router;
