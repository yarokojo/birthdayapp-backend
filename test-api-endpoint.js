const { query } = require('./src/config/database');

async function testApiEndpoint() {
  try {
    console.log('🔍 Testing GET /api/friends/requests endpoint...');
    console.log('========================================');
    
    // ✅ Test for user ID 1 (Test User)
    const userId = 1;
    console.log(`👤 Testing for user ID: ${userId}`);
    
    // ✅ This is the EXACT query your route should use
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
    
    if (result.rows.length === 0) {
      console.log('❌ No pending requests found for user ID:', userId);
    } else {
      result.rows.forEach((r, i) => {
        console.log(`  ${i + 1}. From: ${r.fromUserName} (ID: ${r.from_user_id})`);
        console.log(`     Status: ${r.status}`);
        console.log(`     Created: ${r.created_at}`);
      });
    }
    
    console.log('========================================');
    console.log('✅ Test complete');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testApiEndpoint();
