const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET / - Get all gifts
// ============================================================
router.get('/', async (req, res) => {
  const gifts = [
    { id: 'g1', name: 'Gold Bar', price: 100, category: 'Luxury', icon: '🥇', isPopular: true },
    { id: 'g2', name: 'Diamond Ring', price: 150, category: 'Luxury', icon: '💍', isPopular: true },
    { id: 'g3', name: 'Celebration Cake', price: 50, category: 'Food', icon: '🎂', isNew: true },
    { id: 'g4', name: 'Fresh Flowers', price: 40, category: 'Flowers', icon: '🌹' },
    { id: 'g5', name: 'Premium Champagne', price: 20, category: 'Drinks', icon: '🍾' },
    { id: 'g6', name: 'Gift Card', price: 10, category: 'Cash', icon: '💳' },
    { id: 'g7', name: 'Teddy Bear', price: 25, category: 'Toys', icon: '🧸' },
    { id: 'g8', name: 'Chocolate Box', price: 15, category: 'Food', icon: '🍫' },
    { id: 'v1', name: 'Birthday Cake', price: 5, category: 'Virtual', icon: '🎂' },
    { id: 'v2', name: 'Balloons', price: 1, category: 'Virtual', icon: '🎈' },
    { id: 'v3', name: 'Party Popper', price: 2, category: 'Virtual', icon: '🎉' },
    { id: 'v4', name: 'Magic Sparkles', price: 10, category: 'Virtual', icon: '✨' },
    { id: 'v5', name: 'Heart', price: 3, category: 'Virtual', icon: '❤️' },
    { id: 'v6', name: 'Crown', price: 15, category: 'Virtual', icon: '👑' },
  ];
  res.json(gifts);
});

// ============================================================
// POST /purchase - Purchase a gift
// ============================================================
router.post('/purchase', requireAuth, [
  body('giftId').notEmpty().withMessage('Gift ID is required'),
  body('giftName').notEmpty().withMessage('Gift name is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('recipientId').notEmpty().withMessage('Recipient ID is required'),
  body('recipientName').notEmpty().withMessage('Recipient name is required'),
  body('network').optional().isString(),
  body('phoneNumber').optional().isString(),
], async (req, res) => {
  try {
    console.log('🎁 ===== GIFT PURCHASE REQUEST =====');
    console.log('📝 req.userId:', req.userId);
    console.log('📝 req.body:', req.body);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { 
      giftId, 
      giftName, 
      amount, 
      network, 
      phoneNumber, 
      recipientId, 
      recipientName 
    } = req.body;
    
    const senderId = req.userId;
    const giftAmount = parseFloat(amount);

    console.log(`🎁 Sender: ${senderId}`);
    console.log(`🎁 Recipient: ${recipientId} (${recipientName})`);
    console.log(`🎁 Gift: ${giftName} (₵${giftAmount})`);

    // ✅ Step 1: Check if sender exists
    console.log('📌 Step 1: Checking sender...');
    const senderCheck = await query('SELECT id, name FROM users WHERE id = $1', [senderId]);
    if (senderCheck.rows.length === 0) {
      console.log(`❌ Sender not found: ${senderId}`);
      return res.status(404).json({ error: 'Sender not found' });
    }
    console.log(`✅ Sender found: ${senderCheck.rows[0].name}`);

    // ✅ Step 2: Check if recipient exists
    console.log('📌 Step 2: Checking recipient...');
    const userCheck = await query('SELECT id, name FROM users WHERE id = $1', [recipientId]);
    if (userCheck.rows.length === 0) {
      console.log(`❌ Recipient not found: ${recipientId}`);
      return res.status(404).json({ error: 'Recipient not found' });
    }
    console.log(`✅ Recipient found: ${userCheck.rows[0].name}`);

    // ✅ Step 3: Check if recipient has a wallet
    console.log('📌 Step 3: Checking wallet...');
    const walletCheck = await query('SELECT id FROM wallets WHERE user_id = $1', [recipientId]);
    if (walletCheck.rows.length === 0) {
      console.log(`💰 Creating wallet for recipient: ${recipientId}`);
      await query('INSERT INTO wallets (user_id) VALUES ($1)', [recipientId]);
    }
    console.log('✅ Wallet ready');

    // ✅ Step 4: Add gift to recipient's wallet
    console.log(`📌 Step 4: Adding ₵${giftAmount} to recipient's wallet...`);
    await query(
      `UPDATE wallets 
       SET balance = balance + $1, 
           total_received = total_received + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [giftAmount, recipientId]
    );
    console.log(`✅ Added ₵${giftAmount} to recipient's wallet`);

    // ✅ Step 5: Create gift transaction record
    console.log('📌 Step 5: Creating gift record...');
    const giftResult = await query(
      `INSERT INTO gifts (
        sender_id, 
        recipient_id, 
        gift_id, 
        gift_name, 
        amount, 
        network, 
        phone_number, 
        status, 
        completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', CURRENT_TIMESTAMP)
      RETURNING id`,
      [senderId, recipientId, giftId, giftName, giftAmount, network || 'MTN', phoneNumber || '']
    );
    console.log(`✅ Gift record created: ${giftResult.rows[0].id}`);

    // ✅ Step 6: Create transaction record for recipient
    console.log('📌 Step 6: Creating recipient transaction...');
    await query(
      `INSERT INTO transactions (
        user_id, 
        type, 
        amount, 
        description, 
        status, 
        completed_at
      ) VALUES ($1, 'gift_received', $2, $3, 'completed', CURRENT_TIMESTAMP)`,
      [recipientId, giftAmount, `Gift received: ${giftName} from ${senderCheck.rows[0].name || 'Someone'}`]
    );
    console.log('✅ Recipient transaction created');

    // ✅ Step 7: Create transaction record for sender
    console.log('📌 Step 7: Creating sender transaction...');
    await query(
      `INSERT INTO transactions (
        user_id, 
        type, 
        amount, 
        description, 
        status, 
        completed_at
      ) VALUES ($1, 'gift_sent', $2, $3, 'completed', CURRENT_TIMESTAMP)`,
      [senderId, giftAmount, `Gift sent: ${giftName} to ${recipientName}`]
    );
    console.log('✅ Sender transaction created');

    console.log(`✅ Gift purchase successful!`);
    console.log(`   Recipient ${recipientName} now has ₵${giftAmount} added to wallet`);

    res.json({ 
      success: true, 
      message: `Gift sent successfully to ${recipientName}`,
      recipientId: recipientId,
      recipientName: recipientName,
      amount: giftAmount,
      giftName: giftName,
    });

  } catch (error) {
    console.error('❌ Purchase gift error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to purchase gift. Please try again.', details: error.message });
  }
});

module.exports = router;
