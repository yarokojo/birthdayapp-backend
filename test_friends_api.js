const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');
const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

// Simulate the friends API response
const userId = 1;
const friendships = data.friendships.filter(f => f.userId === userId);
const friends = friendships
  .map(f => {
    const friend = data.users.find(u => u.id === f.friendId);
    if (!friend) return null;
    return {
      id: friend.id,
      name: friend.name,
      username: friend.username,
      profileImage: friend.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
      birthDate: friend.birthDate || null,
      phone: friend.phone || '',
      network: friend.network || 'MTN'
    };
  })
  .filter(Boolean);

console.log('📋 Friends list with phone numbers:');
friends.forEach(f => {
  console.log(`  - ${f.name}: phone=${f.phone || '❌ MISSING'}, network=${f.network || '❌ MISSING'}`);
});
