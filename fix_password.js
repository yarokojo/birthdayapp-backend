const bcrypt = require('bcryptjs');
const fs = require('fs');

const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));

// Find user with email test@example.com
const userIndex = data.users.findIndex(u => u.email === 'test@example.com');
if (userIndex !== -1) {
  // Generate a NEW hash for password123
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync('password123', salt);
  data.users[userIndex].password_hash = hashedPassword;
  console.log(`✅ Updated password_hash for: ${data.users[userIndex].name}`);
  console.log(`📝 New hash: ${hashedPassword}`);
} else {
  console.log('❌ User not found');
}

fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
console.log('✅ data.json updated!');
