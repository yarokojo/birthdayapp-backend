// ============================================================
// GET /api/banners - Get all banners
// ============================================================
app.get('/api/banners', async (req, res) => {
  try {
    // Try to get from database
    const result = await query(
      `SELECT id, title, subtitle, icon, colors, active, priority, views_count, clicks_count, created_at
       FROM banners 
       WHERE active = true
       ORDER BY priority ASC`
    ).catch(() => ({ rows: [] }));

    if (result.rows.length > 0) {
      return res.json({ 
        success: true, 
        banners: result.rows.map(b => ({
          id: b.id,
          title: b.title,
          subtitle: b.subtitle,
          icon: b.icon || '🎉',
          colors: b.colors || ['#6366f1', '#8b5cf6', '#a855f7'],
          active: b.active,
          priority: b.priority || 0,
          views: b.views_count || 0,
          clicks: b.clicks_count || 0,
          createdAt: b.created_at
        }))
      });
    }

    // Fallback banners
    res.json({
      success: true,
      banners: [
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
          views: 0,
          clicks: 0,
          createdAt: new Date().toISOString()
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
          views: 0,
          clicks: 0,
          createdAt: new Date().toISOString()
        }
      ]
    });
  } catch (error) {
    console.error('❌ Get banners error:', error);
    res.json({
      success: true,
      banners: [
        {
          id: 'banner_fallback_1',
          title: '🎉 Today\'s Celebrations',
          subtitle: 'Check out today\'s events!',
          icon: '🎂',
          colors: ['#6366f1', '#8b5cf6', '#a855f7'],
          active: true,
          priority: 1,
          views: 0,
          clicks: 0,
          createdAt: new Date().toISOString()
        },
        {
          id: 'banner_fallback_2',
          title: '🎁 Gift Shop',
          subtitle: 'Send a gift to someone special',
          icon: '🎁',
          colors: ['#ec4899', '#f472b6', '#f9a8d4'],
          active: true,
          priority: 2,
          views: 0,
          clicks: 0,
          createdAt: new Date().toISOString()
        }
      ]
    });
  }
});

// POST /api/banners/:id/view - Track banner view
app.post('/api/banners/:id/view', async (req, res) => {
  try {
    const { id } = req.params;
    // Try to update view count in database
    await query(
      'UPDATE banners SET views_count = views_count + 1 WHERE id = $1',
      [id]
    ).catch(() => {});
    res.json({ success: true });
  } catch (error) {
    res.json({ success: true });
  }
});

// POST /api/banners/:id/click - Track banner click
app.post('/api/banners/:id/click', async (req, res) => {
  try {
    const { id } = req.params;
    await query(
      'UPDATE banners SET clicks_count = clicks_count + 1 WHERE id = $1',
      [id]
    ).catch(() => {});
    res.json({ success: true });
  } catch (error) {
    res.json({ success: true });
  }
});
