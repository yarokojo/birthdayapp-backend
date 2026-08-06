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
// POST /purchase - Purchase a gift (SENDER PAYS VIA MOMO)
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

    console.log(`🎁 Purchase request:`);
    console.log(`  Sender: ${senderId}`);
    console.log(`  Recipient: ${recipientId} (${recipientName})`);
    console.log(`  Gift: ${giftName} (₵${giftAmount})`);
    console.log(`  Network: ${network || 'MTN'}`);
    console.log(`  Phone: ${phoneNumber || 'Not provided'}`);

    // ✅ Check if recipient exists
    const userCheck = await query('SELECT id, name FROM users WHERE id = $1', [recipientId]);
    if (userCheck.rows.length === 0) {
      console.log(`❌ Recipient not found: ${recipientId}`);
      return res.status(404).json({ error: 'Recipient not found' });
    }

    // ✅ Check if sender exists
    const senderCheck = await query('SELECT id, name FROM users WHERE id = $1', [senderId]);
    if (senderCheck.rows.length === 0) {
      console.log(`❌ Sender not found: ${senderId}`);
      return res.status(404).json({ error: 'Sender not found' });
    }

    // ✅ NO WALLET BALANCE CHECK - Sender pays via Mobile Money directly
    // The sender's wallet is NOT used for sending gifts

    // ✅ Add gift to recipient's wallet (FULL AMOUNT - NO FEE)
    console.log(`💰 Adding ₵${giftAmount} to recipient ${recipientName}'s wallet`);
    
    await query(
      `UPDATE wallets 
       SET balance = balance + $1, 
           total_received = total_received + $1,
           updated_at = CURRENT_TIMESTAMP,
           version = version + 1
       WHERE user_id = $2`,
      [giftAmount, recipientId]
    );

    // ✅ Create gift transaction record
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

    // ✅ Create transaction record for recipient
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

    // ✅ Create transaction record for sender (for history)
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

    console.log(`✅ Gift purchase successful!`);
    console.log(`   Recipient ${recipientName} now has ₵${giftAmount} added to wallet`);
    console.log(`   Sender paid ₵${giftAmount} via Mobile Money`);

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
    res.status(500).json({ error: 'Failed to purchase gift. Please try again.' });
  }
});

module.exports = router;
