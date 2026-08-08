const bcrypt = require('bcryptjs');
const { query } = require('./src/config/database');

async function addTestData() {
  console.log('📝 Adding test data to database...');

  // 1. Get or create test user
  console.log('📝 Checking test user...');
  let userResult = await query('SELECT id FROM users WHERE email = $1', ['test@example.com']);
  let userId;

  if (userResult.rows.length === 0) {
    const hashedPassword = await bcrypt.hash('test123', 10);
    const result = await query(
      `INSERT INTO users (email, password_hash, name, username, phone, network, profile_image, birth_date, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      ['test@example.com', hashedPassword, 'Test User', 'testuser', '0244123456', 'MTN', 'https://randomuser.me/api/portraits/men/1.jpg', '1990-06-15', true]
    );
    userId = result.rows[0].id;
    console.log('✅ Test user created');
  } else {
    userId = userResult.rows[0].id;
    console.log('✅ Test user already exists (ID:', userId, ')');
  }

  // 2. Add wallet
  console.log('📝 Creating wallet...');
  await query(
    `INSERT INTO wallets (user_id, balance, total_received, total_sent)
     VALUES ($1, 100, 50, 20)
     ON CONFLICT (user_id) DO UPDATE SET balance = 100`,
    [userId]
  );
  console.log('✅ Wallet created with ₵100');

  // 3. Add test posts (only if none exist)
  console.log('📝 Checking existing posts...');
  const postCheck = await query('SELECT COUNT(*) FROM posts WHERE user_id = $1', [userId]);
  if (parseInt(postCheck.rows[0].count) === 0) {
    console.log('📝 Creating test posts...');
    const posts = [
      {
        content: '🎉 Happy Birthday to me! Today is my special day! 🎂',
        celebration_type: 'birthday',
        celebrant_name: 'Test User',
        is_birthday: true,
        likes_count: 5,
        comments_count: 2
      },
      {
        content: 'Just celebrated my anniversary with the love of my life! ❤️ #love #anniversary',
        celebration_type: 'anniversary',
        celebrant_name: 'Test User',
        is_birthday: false,
        likes_count: 3,
        comments_count: 1
      },
      {
        content: '🎊 Big party tonight! Everyone is invited! 🥳 #party #celebration',
        celebration_type: 'party',
        celebrant_name: 'Test User',
        is_birthday: false,
        likes_count: 8,
        comments_count: 4
      }
    ];

    for (const post of posts) {
      await query(
        `INSERT INTO posts (user_id, content, celebration_type, celebrant_name, is_birthday, likes_count, comments_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, post.content, post.celebration_type, post.celebrant_name, post.is_birthday, post.likes_count, post.comments_count]
      );
      console.log(`  ✅ Post: ${post.content.substring(0, 30)}...`);
    }
  } else {
    console.log(`✅ ${postCheck.rows[0].count} posts already exist`);
  }

  // 4. Add notifications (only if none exist)
  console.log('📝 Checking existing notifications...');
  const notifCheck = await query('SELECT COUNT(*) FROM notifications WHERE user_id = $1', [userId]);
  if (parseInt(notifCheck.rows[0].count) === 0) {
    console.log('📝 Creating notifications...');
    const notifications = [
      { type: 'like', title: '❤️ New Like', message: 'Someone liked your post' },
      { type: 'comment', title: '💬 New Comment', message: 'Someone commented on your post' },
      { type: 'gift', title: '🎁 Gift Received', message: 'You received a gift!' }
    ];

    for (const notif of notifications) {
      await query(
        `INSERT INTO notifications (user_id, type, title, message, is_read)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, notif.type, notif.title, notif.message, false]
      );
      console.log(`  ✅ Notification: ${notif.title}`);
    }
  } else {
    console.log(`✅ ${notifCheck.rows[0].count} notifications already exist`);
  }

  // 5. Add banners (only if none exist)
  console.log('📝 Checking existing banners...');
  const bannerCheck = await query('SELECT COUNT(*) FROM banners');
  if (parseInt(bannerCheck.rows[0].count) === 0) {
    console.log('📝 Creating banners...');
    const banners = [
      { title: '🎉 Welcome to BirthdayApp!', subtitle: 'Celebrate every moment', icon: '🎂', colors: ['#6366f1', '#8b5cf6', '#a855f7'], active: true, priority: 1 },
      { title: '🎁 Send a Gift!', subtitle: 'Make someone\'s day special', icon: '🎁', colors: ['#ec4899', '#f472b6', '#f9a8d4'], active: true, priority: 2 }
    ];

    for (const banner of banners) {
      await query(
        `INSERT INTO banners (title, subtitle, icon, colors, active, priority)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [banner.title, banner.subtitle, banner.icon, banner.colors, banner.active, banner.priority]
      );
      console.log(`  ✅ Banner: ${banner.title}`);
    }
  } else {
    console.log(`✅ ${bannerCheck.rows[0].count} banners already exist`);
  }

  console.log('');
  console.log('✅ Test data added successfully!');
  console.log('📋 Login credentials:');
  console.log('   Email: test@example.com');
  console.log('   Password: test123');
  console.log('   Wallet: ₵100');
  process.exit(0);
}

addTestData().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
