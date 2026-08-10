const bcrypt = require('bcryptjs');
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));

const user = data.users.find(u => u.email === 'test@example.com');
if (user) {
  console.log('User found:', user.name);
  console.log('Password hash:', user.password);
  
  bcrypt.compare('test123', user.password).then(result => {
    console.log('Password match result:', result);
    if (!result) {
      console.log('❌ Password does not match!');
      // Generate a new hash
      bcrypt.hash('test123', 10).then(newHash => {
        console.log('New hash:', newHash);
        user.password = newHash;
        fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
        console.log('✅ Password updated in data.json');
        console.log('Please restart the backend and try login again');
      });
    } else {
      console.log('✅ Password matches!');
    }
  }).catch(err => {
    console.error('Error:', err);
  });
} else {
  console.log('User not found');
}
