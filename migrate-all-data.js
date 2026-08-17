const fs = require('fs');
const { query } = require('./src/config/database');

async function migrateAllData() {
  try {
    console.log('📝 Migrating ALL data from data.json to PostgreSQL...');
    
    const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
    
    // 1. Migrate users
    console.log('\n📌 Migrating users...');
    let usersMigrated = 0;
    for (const user of data.users) {
      try {
        const check = await query('SELECT id FROM users WHERE id = $1', [user.id]);
        if (check.rows.length === 0) {
          await query(
            `INSERT INTO users (id, email, name, username, password_hash, profile_image, bio, location, phone, network, birth_date, is_admin, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [
              user.id,
              user.email,
              user.name,
              user.username,
              user.password_hash || '',
              user.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
              user.bio || '',
              user.location || '',
              user.phone || '',
              user.network || 'MTN',
              user.birthDate || null,
              user.is_admin || false,
              true,
              user.created_at || new Date().toISOString(),
              user.updated_at || user.created_at || new Date().toISOString()
            ]
          );
          usersMigrated++;
          console.log(`  ✅ User ${user.id}: ${user.name}`);
        }
      } catch (error) {
        console.error(`  ❌ Failed to migrate user ${user.id}:`, error.message);
      }
    }
    console.log(`✅ Migrated ${usersMigrated} users`);

    // 2. Migrate wallets
    console.log('\n📌 Migrating wallets...');
    let walletsMigrated = 0;
    for (const [userId, wallet] of Object.entries(data.wallets || {})) {
      try {
        const check = await query('SELECT user_id FROM wallets WHERE user_id = $1', [parseInt(userId)]);
        if (check.rows.length === 0) {
          await query(
            `INSERT INTO wallets (user_id, balance, total_received, total_sent, total_withdrawn, total_fees_paid, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              parseInt(userId),
              wallet.balance || 0,
              wallet.totalReceived || 0,
              wallet.totalSent || 0,
              wallet.totalWithdrawn || 0,
              wallet.totalFeesPaid || 0,
              wallet.created_at || new Date().toISOString(),
              wallet.updated_at || wallet.created_at || new Date().toISOString()
            ]
          );
          walletsMigrated++;
          console.log(`  ✅ Wallet for user ${userId}`);
        }
      } catch (error) {
        console.error(`  ❌ Failed to migrate wallet ${userId}:`, error.message);
      }
    }
    console.log(`✅ Migrated ${walletsMigrated} wallets`);

    // 3. Migrate posts
    console.log('\n📌 Migrating posts...');
    let postsMigrated = 0;
    for (const post of data.posts || []) {
      try {
        const check = await query('SELECT id FROM posts WHERE id = $1', [parseInt(post.id)]);
        if (check.rows.length === 0) {
          await query(
            `INSERT INTO posts (id, user_id, content, image, video, location, celebration_type, celebrant_name, is_birthday, music, hashtags, likes_count, comments_count, views_count, birthday_song_id, birthday_song_url, birthday_song_name, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
            [
              parseInt(post.id),
              post.userId,
              post.content || '',
              post.image || null,
              post.video || null,
              post.location || null,
              post.celebrationType || 'general',
              post.celebrantName || '',
              post.isBirthday || false,
              post.music || null,
              post.hashtags || [],
              post.likes || 0,
              post.comments || 0,
              post.views || 0,
              post.birthdaySongId || null,
              post.birthdaySongUrl || null,
              post.birthdaySongName || null,
              post.createdAt || new Date().toISOString(),
              post.updatedAt || post.createdAt || new Date().toISOString()
            ]
          );
          postsMigrated++;
          console.log(`  ✅ Post ${post.id}`);
        }
      } catch (error) {
        console.error(`  ❌ Failed to migrate post ${post.id}:`, error.message);
      }
    }
    console.log(`✅ Migrated ${postsMigrated} posts`);

    // 4. Migrate comments
    console.log('\n📌 Migrating comments...');
    let commentsMigrated = 0;
    for (const post of data.posts || []) {
      for (const comment of post.commentList || []) {
        try {
          const check = await query('SELECT id FROM comments WHERE id = $1', [parseInt(comment.id)]);
          if (check.rows.length === 0) {
            await query(
              `INSERT INTO comments (id, post_id, user_id, text, likes_count, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                parseInt(comment.id),
                parseInt(post.id),
                comment.userId,
                comment.text,
                comment.likes || 0,
                comment.createdAt || new Date().toISOString(),
                comment.updatedAt || comment.createdAt || new Date().toISOString()
              ]
            );
            commentsMigrated++;
            console.log(`  ✅ Comment ${comment.id}: "${comment.text}"`);
          }
        } catch (error) {
          console.error(`  ❌ Failed to migrate comment ${comment.id}:`, error.message);
        }
      }
    }
    console.log(`✅ Migrated ${commentsMigrated} comments`);

    // 5. Migrate friendships
    console.log('\n📌 Migrating friendships...');
    let friendshipsMigrated = 0;
    for (const friendship of data.friendships || []) {
      try {
        await query(
          `INSERT INTO friends (user_id, friend_id, created_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, friend_id) DO NOTHING`,
          [friendship.userId, friendship.friendId, friendship.createdAt || new Date().toISOString()]
        );
        friendshipsMigrated++;
      } catch (error) {
        // Ignore duplicates
      }
    }
    console.log(`✅ Migrated ${friendshipsMigrated} friendships`);

    // 6. Migrate notifications
    console.log('\n📌 Migrating notifications...');
    let notificationsMigrated = 0;
    for (const notification of data.notifications || []) {
      try {
        await query(
          `INSERT INTO notifications (user_id, type, title, message, image_url, target_id, target_name, extra_data, is_read, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            notification.userId,
            notification.type,
            notification.title || notification.type,
            notification.message || '',
            notification.imageUrl || null,
            notification.targetId || null,
            notification.targetName || null,
            notification.extraData || null,
            notification.isRead || false,
            notification.createdAt || new Date().toISOString()
          ]
        );
        notificationsMigrated++;
      } catch (error) {
        console.error(`  ❌ Failed to migrate notification:`, error.message);
      }
    }
    console.log(`✅ Migrated ${notificationsMigrated} notifications`);

    console.log('\n✅ ALL DATA MIGRATION COMPLETE!');
    console.log(`   Users: ${usersMigrated}`);
    console.log(`   Wallets: ${walletsMigrated}`);
    console.log(`   Posts: ${postsMigrated}`);
    console.log(`   Comments: ${commentsMigrated}`);
    console.log(`   Friendships: ${friendshipsMigrated}`);
    console.log(`   Notifications: ${notificationsMigrated}`);

  } catch (error) {
    console.error('❌ Migration error:', error.message);
  }
}

migrateAllData();
