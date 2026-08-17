const { query } = require('./src/config/database');

async function checkAllData() {
  try {
    console.log('📊 Checking all PostgreSQL data...\n');
    
    // Users
    const users = await query('SELECT id, name, email, username, birth_date, phone, network FROM users');
    console.log(`👥 Users (${users.rows.length}):`);
    users.rows.forEach(u => console.log(`  - ${u.name} (${u.email})`));
    
    // Posts
    const posts = await query('SELECT id, user_id, content, image, video, created_at FROM posts');
    console.log(`\n📝 Posts (${posts.rows.length}):`);
    posts.rows.forEach(p => console.log(`  - ${p.id}: ${p.content || '(no content)'}`));
    
    // Comments
    const comments = await query('SELECT id, post_id, user_id, text, created_at FROM comments');
    console.log(`\n💬 Comments (${comments.rows.length}):`);
    comments.rows.forEach(c => console.log(`  - ${c.id}: "${c.text}" on post ${c.post_id}`));
    
    // Wallets
    const wallets = await query('SELECT user_id, balance, total_received, total_withdrawn FROM wallets');
    console.log(`\n💰 Wallets (${wallets.rows.length}):`);
    wallets.rows.forEach(w => console.log(`  - User ${w.user_id}: ₵${w.balance}`));
    
    // Banners
    const banners = await query('SELECT id, title, active FROM banners');
    console.log(`\n🎯 Banners (${banners.rows.length}):`);
    banners.rows.forEach(b => console.log(`  - ${b.id}: ${b.title}`));
    
    // Friendships
    const friends = await query('SELECT user_id, friend_id FROM friends');
    console.log(`\n🤝 Friendships (${friends.rows.length}):`);
    friends.rows.forEach(f => console.log(`  - ${f.user_id} -> ${f.friend_id}`));
    
    // Notifications
    const notifications = await query('SELECT id, user_id, type, title FROM notifications');
    console.log(`\n🔔 Notifications (${notifications.rows.length}):`);
    notifications.rows.forEach(n => console.log(`  - ${n.type}: ${n.title}`));
    
    // Friend Requests
    const requests = await query('SELECT id, from_user_id, to_user_id, status FROM friend_requests');
    console.log(`\n📩 Friend Requests (${requests.rows.length}):`);
    requests.rows.forEach(r => console.log(`  - ${r.from_user_id} -> ${r.to_user_id}: ${r.status}`));
    
    console.log('\n✅ All data check complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkAllData();
