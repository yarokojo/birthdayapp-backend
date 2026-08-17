const { query } = require('./src/config/database');

async function fixComments() {
  try {
    console.log('📝 Fixing comments table with BIGINT...');
    
    // 1. Drop existing foreign key constraints
    console.log('📌 Dropping foreign key constraints...');
    try {
      await query(`ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_post_id_fkey`);
      await query(`ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_user_id_fkey`);
      console.log('✅ Dropped constraints');
    } catch (error) {
      console.log('⚠️ Could not drop constraints:', error.message);
    }

    // 2. Drop the comments table
    console.log('📌 Dropping comments table...');
    await query(`DROP TABLE IF EXISTS comments CASCADE`);
    console.log('✅ Dropped comments table');

    // 3. Create comments table with BIGINT for id
    console.log('📌 Creating comments table with BIGINT...');
    await query(`
      CREATE TABLE comments (
        id BIGINT PRIMARY KEY,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        likes_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created comments table with BIGINT');

    // 4. Create indexes
    console.log('📌 Creating indexes...');
    await query(`CREATE INDEX idx_comments_post_id ON comments(post_id)`);
    await query(`CREATE INDEX idx_comments_user_id ON comments(user_id)`);
    console.log('✅ Indexes created');

    // 5. Create trigger for updated_at
    console.log('📌 Creating updated_at trigger...');
    await query(`
      CREATE OR REPLACE FUNCTION update_comments_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    
    await query(`
      DROP TRIGGER IF EXISTS update_comments_updated_at ON comments;
      CREATE TRIGGER update_comments_updated_at
        BEFORE UPDATE ON comments
        FOR EACH ROW
        EXECUTE FUNCTION update_comments_updated_at()
    `);
    console.log('✅ Trigger created');

    // 6. Verify the structure
    console.log('\n📊 Verifying structure...');
    const result = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'comments'
      ORDER BY ordinal_position
    `);
    
    console.log('✅ Comments table structure:');
    result.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    console.log('\n✅ Migration completed successfully!');
    console.log('💡 Now comments can store large IDs like: 1786527351799');
  } catch (error) {
    console.error('❌ Migration error:', error.message);
  }
}

fixComments();
