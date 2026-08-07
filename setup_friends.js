const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_FILE = path.join(__dirname, 'data.json');
const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

// ✅ 1. Add phone number to User 2 (New User)
const user2 = data.users.find(u => u.id === 2);
if (user2) {
  user2.phone = '0501234567';
  user2.network = 'MTN';
  console.log(`✅ Updated User 2: ${user2.name} -> ${user2.phone} (${user2.network})`);
}

// ✅ 2. Add more test friends
const additionalFriends = [
  {
    name: 'Sarah Johnson',
    email: 'sarah@test.com',
    username: 'sarahj',
    phone: '0244123456',
    network: 'MTN'
  },
  {
    name: 'Mike Chen',
    email: 'mike@test.com',
    username: 'mikec',
    phone: '0559876543',
    network: 'MTN'
  },
  {
    name: 'Emma Davis',
    email: 'emma@test.com',
    username: 'emmad',
    phone: '0201234567',
    network: 'Telecel'
  }
];

let addedCount = 0;
additionalFriends.forEach(friendData => {
  const exists = data.users.find(u => u.email === friendData.email);
  if (!exists) {
    const newUser = {
      id: data.users.length + 1,
      email: friendData.email,
      name: friendData.name,
      username: friendData.username,
      password_hash: bcrypt.hashSync('test123', 10),
      profileImage: `https://randomuser.me/api/portraits/${data.users.length % 2 === 0 ? 'women' : 'men'}/${data.users.length + 1}.jpg`,
      bio: '',
      location: 'Accra, Ghana',
      phone: friendData.phone,
      network: friendData.network || 'MTN',
      birthDate: '1995-06-17',
      created_at: new Date().toISOString()
    };
    data.users.push(newUser);
    addedCount++;
    console.log(`✅ Added friend: ${newUser.name} (${newUser.phone}, ${newUser.network})`);
  }
});

// ✅ 3. Create friendships with User 1
const userId = 1;
let friendshipCount = 0;

data.users.forEach(friend => {
  if (friend.id === userId) return; // Skip self
  
  // Check if friendship already exists
  const exists = data.friendships.some(f => 
    (f.userId === userId && f.friendId === friend.id)
  );
  
  if (!exists) {
    data.friendships.push({
      id: Date.now().toString() + '_' + friend.id,
      userId: userId,
      friendId: friend.id,
      createdAt: new Date().toISOString()
    });
    // Add reverse friendship
    data.friendships.push({
      id: (Date.now() + 1).toString() + '_' + friend.id,
      userId: friend.id,
      friendId: userId,
      createdAt: new Date().toISOString()
    });
    friendshipCount++;
    console.log(`✅ Added friendship: User ${userId} <-> ${friend.name}`);
  }
});

// Save data
fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

console.log(`\n✅ Added ${addedCount} friends and ${friendshipCount} friendships`);

// Show all users
console.log('\n📋 All users with phone numbers:');
data.users.forEach(u => {
  console.log(`  - ${u.name} (ID: ${u.id}): phone=${u.phone || '❌ MISSING'}, network=${u.network || '❌ MISSING'}`);
});

console.log('\n🤝 Friendships:');
data.friendships.forEach(f => {
  const user = data.users.find(u => u.id === f.userId);
  const friend = data.users.find(u => u.id === f.friendId);
  console.log(`  - ${user?.name} <-> ${friend?.name}`);
});
