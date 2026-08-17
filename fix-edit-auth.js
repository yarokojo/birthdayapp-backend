const fs = require('fs');

// Read the file
let content = fs.readFileSync('src/routes/posts.js', 'utf8');

// Find and replace the user_id comparison
content = content.replace(
  /if \(checkResult\.rows\[0\]\.user_id !== userId\) \{/g,
  'if (checkResult.rows[0].user_id.toString() !== userId.toString()) {'
);

// Write back
fs.writeFileSync('src/routes/posts.js', content);
console.log('✅ Fixed user_id comparison in edit route');
