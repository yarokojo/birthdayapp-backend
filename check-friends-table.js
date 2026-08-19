const { query } = require('./database');

async function checkFriendsTable() {
  try {
    console.log('📊 Checking friends table...');
    
    // Check if friends table exists
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'friends'
      )
    `);
    console.log('✅ Friends table exists:', tableCheck.rows[0].exists);
    
    if (!tableCheck.rows[0].exists) {
      console.log('📝 Creating friends table...');
      await query(`
        CREATE TABLE IF NOT EXISTS friends (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          friend_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, friend_id)
        )
      `);
      console.log('✅ Friends table created');
    }
    
    // Check if friend_requests table exists
    const requestsCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'friend_requests'
      )
    `);
    console.log('✅ Friend_requests table exists:', requestsCheck.rows[0].exists);
    
    if (!requestsCheck.rows[0].exists) {
      console.log('📝 Creating friend_requests table...');
      await query(`
        CREATE TABLE IF NOT EXISTS friend_requests (
          id SERIAL PRIMARY KEY,
          from_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          to_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          status VARCHAR(20) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(from_user_id, to_user_id)
        )
      `);
      console.log('✅ Friend_requests table created');
    }
    
    // Check if user 6 exists
    const user6 = await query('SELECT id, name FROM users WHERE id = $1', [6]);
    console.log('👤 User 6:', user6.rows.length > 0 ? user6.rows[0] : 'NOT FOUND');
    
    // Check all friends
    const friends = await query('SELECT * FROM friends LIMIT 10');
    console.log('🤝 Friends in database:', friends.rows);
    
    // Check all friend requests
    const requests = await query('SELECT * FROM friend_requests LIMIT 10');
    console.log('📩 Friend requests in database:', requests.rows);
    
    // Get all users
    const users = await query('SELECT id, name FROM users LIMIT 10');
    console.log('👥 Users in database:', users.rows);
    
    console.log('✅ Check complete');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkFriendsTable();
