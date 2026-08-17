const { query } = require('./src/config/database');

async function checkFriendRequests() {
  try {
    console.log('📊 Checking friend requests...');
    console.log('========================================');
    
    // Check all friend requests
    const result = await query(`
      SELECT 
        fr.id, 
        fr.from_user_id, 
        fr.to_user_id, 
        fr.status, 
        fr.created_at,
        u1.name as from_name,
        u2.name as to_name
      FROM friend_requests fr
      JOIN users u1 ON u1.id = fr.from_user_id
      JOIN users u2 ON u2.id = fr.to_user_id
      ORDER BY fr.created_at DESC
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No friend requests found in database');
      return;
    }
    
    console.log(`✅ Found ${result.rows.length} friend requests:`);
    console.log('----------------------------------------');
    result.rows.forEach(r => {
      console.log(`ID: ${r.id}`);
      console.log(`  From: ${r.from_name} (${r.from_user_id})`);
      console.log(`  To: ${r.to_name} (${r.to_user_id})`);
      console.log(`  Status: ${r.status}`);
      console.log(`  Created: ${r.created_at}`);
      console.log('----------------------------------------');
    });
    
    // Check pending requests only
    const pending = await query(`
      SELECT COUNT(*) as count 
      FROM friend_requests 
      WHERE status = 'pending'
    `);
    console.log(`📊 Pending requests: ${pending.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkFriendRequests();
