const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');
const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

console.log('📊 Current Data:');
console.log(`👥 Users: ${data.users.length}`);
console.log(`🤝 Friendships: ${data.friendships.length}`);
console.log(`📝 Posts: ${data.posts.length}`);

console.log('\n👤 Users:');
data.users.forEach(u => {
  console.log(`  - ${u.name} (ID: ${u.id}): phone=${u.phone || '❌ MISSING'}`);
});

console.log('\n🤝 Friendships:');
data.friendships.forEach(f => {
  console.log(`  - User ${f.userId} -> Friend ${f.friendId}`);
});
