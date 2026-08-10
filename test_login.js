const bcrypt = require('bcryptjs');
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));

const user = data.users.find(u => u.email === 'test@example.com');
if (user) {
  console.log('User found:', user.name);
  console.log('Hash:', user.password_hash.substring(0, 30) + '...');
  
  bcrypt.compare('test123', user.password_hash).then(result => {
    console.log('Password match:', result);
    if (!result) {
      bcrypt.hash('test123', 10).then(newHash => {
        console.log('New hash:', newHash);
        // Update the user with new hash
        user.password_hash = newHash;
        fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
        console.log('✅ Password updated for test@example.com');
      });
    } else {
      console.log('✅ Password is correct!');
    }
  }).catch(err => {
    console.error('Error:', err);
  });
} else {
  console.log('User not found');
}
