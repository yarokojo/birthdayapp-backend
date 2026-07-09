const fs = require('fs');
const bcrypt = require('bcryptjs');

const dataFile = './data.json';
const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

// ✅ Fix all users without password_hash
data.users.forEach(user => {
  if (!user.password_hash) {
    console.log(`⚠️ User ${user.email} has no password_hash, creating one...`);
    // Set default password to "password123"
    user.password_hash = bcrypt.hashSync('password123', 10);
    console.log(`✅ Added password_hash for ${user.email}`);
  }
});

fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
console.log('✅ All users fixed!');
