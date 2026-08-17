const { query } = require('./src/config/database');
const fs = require('fs');

async function migrateBanners() {
  try {
    // Try to read data from backup files
    let data = null;
    const files = ['data.json.backup', 'data.json', 'data.json.disabled'];
    
    for (const file of files) {
      try {
        if (fs.existsSync(file)) {
          data = JSON.parse(fs.readFileSync(file, 'utf8'));
          console.log('📥 Using:', file);
          break;
        }
      } catch (e) {
        // Continue to next file
      }
    }
    
    if (!data) {
      console.log('⚠️ No data file found, using default banner');
      data = { banners: [] };
    }
    
    console.log('📥 Migrating banners...');
    
    if (!data.banners || data.banners.length === 0) {
      console.log('📥 No banners found, creating default banner...');
      data.banners = [{
        id: 'banner_1',
        title: '🎉 Welcome to BirthdayApp!',
        subtitle: 'Celebrate every moment',
        icon: '🎂',
        colors: ['#6366f1', '#8b5cf6', '#a855f7'],
        active: true,
        views: 0,
        clicks: 0,
        createdAt: new Date().toISOString()
      }];
    }
    
    let migrated = 0;
    for (const banner of data.banners) {
      try {
        await query(
          `INSERT INTO banners (id, title, subtitle, icon, colors, active, views_count, clicks_count, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title`,
          [
            banner.id || 'banner_1',
            banner.title || 'Welcome',
            banner.subtitle || '',
            banner.icon || '🎉',
            banner.colors || ['#6366f1', '#8b5cf6', '#a855f7'],
            banner.active !== false,
            banner.views || 0,
            banner.clicks || 0,
            banner.createdAt || new Date().toISOString()
          ]
        );
        console.log('  ✅ Migrated banner:', banner.title);
        migrated++;
      } catch (err) {
        console.log('  ⚠️ Error with banner:', err.message);
        // Try without views_count
        try {
          await query(
            `INSERT INTO banners (id, title, subtitle, icon, colors, active, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title`,
            [
              banner.id || 'banner_1',
              banner.title || 'Welcome',
              banner.subtitle || '',
              banner.icon || '🎉',
              banner.colors || ['#6366f1', '#8b5cf6', '#a855f7'],
              banner.active !== false,
              banner.createdAt || new Date().toISOString()
            ]
          );
          console.log('  ✅ Migrated banner (without views):', banner.title);
          migrated++;
        } catch (err2) {
          console.log('  ❌ Failed to migrate banner:', err2.message);
        }
      }
    }
    console.log('✅ Banners migration complete! Migrated:', migrated, 'banners');
  } catch (error) {
    console.error('❌ Banner migration error:', error.message);
  }
}

migrateBanners();
