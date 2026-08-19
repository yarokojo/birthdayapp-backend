// ============================================================
// FIXED REGISTER ENDPOINT - WITH FULL ERROR LOGGING
// ============================================================
app.post("/api/auth/register", async (req, res) => {
  try {
    console.log('========================================');
    console.log('📝 REGISTER REQUEST RECEIVED');
    console.log('📝 Body:', JSON.stringify(req.body, null, 2));
    console.log('========================================');
    
    const { email, password, name, username, birthDate, phone, network } = req.body;
    
    // Step 1: Validate
    if (!email) {
      console.log('❌ Missing email');
      return res.status(400).json({ error: 'Email is required' });
    }
    if (!password) {
      console.log('❌ Missing password');
      return res.status(400).json({ error: 'Password is required' });
    }
    if (!name) {
      console.log('❌ Missing name');
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!username) {
      console.log('❌ Missing username');
      return res.status(400).json({ error: 'Username is required' });
    }
    console.log('✅ Validation passed');
    
    // Step 2: Check existing user
    console.log('📊 Checking if user exists...');
    const exists = await query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email.toLowerCase(), username.toLowerCase()]
    );
    if (exists.rows.length) {
      console.log('❌ User already exists');
      return res.status(400).json({ error: 'User already exists' });
    }
    console.log('✅ User does not exist');
    
    // Step 3: Hash password
    console.log('🔐 Hashing password...');
    const hash = await bcrypt.hash(password, 10);
    console.log('✅ Password hashed');
    
    // Step 4: Insert user
    console.log('📝 Inserting user...');
    const result = await query(
      `INSERT INTO users (email, password_hash, name, username, birth_date, phone, network)
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, email, name, username, birth_date, profile_image`,
      [email.toLowerCase(), hash, name, username.toLowerCase(), birthDate || null, phone || '', network || 'MTN']
    );
    const user = result.rows[0];
    console.log('✅ User created with ID:', user.id);
    
    // Step 5: Create wallet
    console.log('💰 Creating wallet...');
    try {
      await query('INSERT INTO wallets (user_id, balance) VALUES ($1, $2)', [user.id, 0]);
      console.log('✅ Wallet created');
    } catch (walletErr) {
      console.error('❌ Wallet creation error:', walletErr.message);
      console.error('❌ Stack:', walletErr.stack);
      // Continue anyway
    }
    
    // Step 6: Create user settings
    console.log('⚙️ Creating user settings...');
    try {
      await query('INSERT INTO user_settings (user_id) VALUES ($1)', [user.id]);
      console.log('✅ User settings created');
    } catch (settingsErr) {
      console.error('❌ User settings creation error:', settingsErr.message);
      console.error('❌ Stack:', settingsErr.stack);
      // Continue anyway
    }
    
    // Step 7: Generate token
    console.log('🎫 Generating token...');
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    console.log('✅ Token generated');
    
    console.log('✅ REGISTRATION SUCCESSFUL for:', email);
    console.log('========================================');
    res.status(201).json({ token, user });
    
  } catch (error) {
    console.error('❌ REGISTRATION ERROR:', error.message);
    console.error('❌ Stack:', error.stack);
    console.log('========================================');
    res.status(500).json({ error: error.message || 'Registration failed' });
  }
});
