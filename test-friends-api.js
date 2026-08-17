const { query } = require('./src/config/database');
const jwt = require('jsonwebtoken');

// ✅ Test the GET /friends/requests endpoint
async function testFriendsRequests() {
  try {
    console.log('🔍 Testing GET /friends/requests endpoint...');
    console.log('========================================');
    
    // ✅ Get a test user (Test User = ID 1)
    const userResult = await query('SELECT id, name FROM users WHERE id = 1');
    if (userResult.rows.length === 0) {
      console.log('❌ User 1 not found');
      return;
    }
    
    const userId = userResult.rows[0].id;
    console.log(`👤 Testing for user: ${userResult.rows[0].name} (ID: ${userId})`);
    
    // ✅ Execute the exact query from your route
    const result = await query(
      `SELECT 
        fr.id, 
        fr.from_user_id, 
        fr.status, 
        fr.created_at,
        u.id as "fromUserId",
        u.name as "fromUserName",
        u.username as "fromUserUsername",
        u.profile_image as "fromUserAvatar",
        u.birth_date as "fromUserBirthDate"
       FROM friend_requests fr
       JOIN users u ON u.id = fr.from_user_id
       WHERE fr.to_user_id = $1 AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [userId]
    );
    
    console.log(`📊 Found ${result.rows.length} pending requests:`);
    console.log('----------------------------------------');
    result.rows.forEach(r => {
      console.log(`ID: ${r.id}`);
      console.log(`  From: ${r.fromUserName} (${r.from_user_id})`);
      console.log(`  Status: ${r.status}`);
      console.log(`  Created: ${r.created_at}`);
      console.log('----------------------------------------');
    });
    
    // ✅ Also check if there are any requests where this user is the sender
    const sentResult = await query(
      `SELECT 
        fr.id, 
        fr.to_user_id, 
        fr.status, 
        fr.created_at,
        u.id as "toUserId",
        u.name as "toUserName"
       FROM friend_requests fr
       JOIN users u ON u.id = fr.to_user_id
       WHERE fr.from_user_id = $1 AND fr.status = 'pending'`,
      [userId]
    );
    
    console.log(`📤 Sent requests: ${sentResult.rows.length}`);
    sentResult.rows.forEach(r => {
      console.log(`  To: ${r.toUserName} (${r.to_user_id})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testFriendsRequests();
