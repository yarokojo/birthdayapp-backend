const bcrypt = require('bcryptjs');
const fs = require('fs');

const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));

// Add password hash for test user
const userIndex = data.users.findIndex(u => u.id === 1);
if (userIndex !== -1) {
  const hashedPassword = bcrypt.hashSync('password123', 10);
  data.users[userIndex].password_hash = hashedPassword;
  console.log(`✅ Added password_hash for user ${data.users[userIndex].name}`);
}

fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
console.log('✅ data.json updated!');
