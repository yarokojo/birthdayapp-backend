const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET /balance - Get wallet balance
// ============================================================
router.get('/balance', requireAuth, async (req, res) => {
  try {
    console.log(`💰 Getting balance for user: ${req.userId}`);
    
    const result = await query(
      `SELECT balance, total_received, total_sent, total_withdrawn, total_fees_paid
       FROM wallets WHERE user_id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      await query('INSERT INTO wallets (user_id) VALUES ($1)', [req.userId]);
      return res.json({ balance: 0, totalReceived: 0, totalSent: 0, totalWithdrawn: 0, totalFeesPaid: 0 });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Get balance error:', error);
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

// ============================================================
// GET /transactions - Get transaction history
// ============================================================
router.get('/transactions', requireAuth, async (req, res) => {
  try {
    console.log(`📊 Getting transactions for user: ${req.userId}`);
    
    const result = await query(
      `SELECT id, type, amount, fee, description, status, network, phone_number, created_at
       FROM transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [req.userId]
    );

    res.json({ transactions: result.rows });
  } catch (error) {
    console.error('❌ Get transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

// ============================================================
// POST /withdraw - Withdraw funds
// ============================================================
router.post('/withdraw', requireAuth, [
  body('amount').isFloat({ min: 10 }).withMessage('Minimum withdrawal is ₵10'),
  body('network').notEmpty().withMessage('Network is required'),
  body('phoneNumber').notEmpty().isLength({ min: 9 }).withMessage('Valid phone number is required'),
], async (req, res) => {
  try {
    console.log('💰 ===== WITHDRAWAL REQUEST =====');
    console.log('📝 req.userId:', req.userId);
    console.log('📝 req.body:', req.body);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { amount, network, phoneNumber } = req.body;
    const userId = req.userId;
    const withdrawalAmount = parseFloat(amount);

    console.log(`💰 Withdrawing ₵${withdrawalAmount} to ${network} • ${phoneNumber}`);

    // ✅ Step 1: Check if user exists
    console.log('📌 Step 1: Checking user...');
    const userCheck = await query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      console.log('❌ User not found');
      return res.status(404).json({ error: 'User not found' });
    }
    console.log('✅ User found');

    // ✅ Step 2: Check wallet balance
    console.log('📌 Step 2: Getting wallet...');
    const walletResult = await query(
      'SELECT balance FROM wallets WHERE user_id = $1',
      [userId]
    );

    if (walletResult.rows.length === 0) {
      console.log('❌ Wallet not found, creating one...');
      await query('INSERT INTO wallets (user_id) VALUES ($1)', [userId]);
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const balance = parseFloat(walletResult.rows[0].balance);
    console.log(`📊 Current balance: ₵${balance}`);

    if (withdrawalAmount > balance) {
      console.log(`❌ Insufficient balance. Available: ₵${balance}, Requested: ₵${withdrawalAmount}`);
      return res.status(400).json({ error: `Insufficient balance. Available: ₵${balance.toFixed(2)}` });
    }

    // ✅ Step 3: Calculate fee (1%)
    const feePercentage = parseFloat(process.env.WITHDRAWAL_FEE_PERCENTAGE || 0.01);
    const fee = withdrawalAmount * feePercentage;
    const totalDeduction = withdrawalAmount + fee;
    const newBalance = balance - totalDeduction;

    console.log(`💰 Fee: ₵${fee.toFixed(2)} (${feePercentage * 100}%)`);
    console.log(`💰 Total deduction: ₵${totalDeduction.toFixed(2)}`);
    console.log(`💰 New balance: ₵${newBalance.toFixed(2)}`);

    // ✅ Step 4: Update wallet
    console.log('📌 Step 4: Updating wallet...');
    await query(
      `UPDATE wallets 
       SET balance = $1, 
           total_withdrawn = total_withdrawn + $2, 
           total_fees_paid = total_fees_paid + $3, 
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $4`,
      [newBalance, withdrawalAmount, fee, userId]
    );
    console.log('✅ Wallet updated');

    // ✅ Step 5: Create transaction record
    console.log('📌 Step 5: Creating transaction...');
    await query(
      `INSERT INTO transactions (
        user_id, 
        type, 
        amount, 
        fee, 
        description, 
        status, 
        network, 
        phone_number, 
        completed_at
      ) VALUES ($1, 'withdrawal', $2, $3, $4, 'completed', $5, $6, CURRENT_TIMESTAMP)`,
      [userId, withdrawalAmount, fee, `Withdrawal to ${network}`, network, phoneNumber]
    );
    console.log('✅ Transaction created');

    console.log(`✅ Withdrawal successful!`);
    console.log(`   User receives: ₵${(withdrawalAmount - fee).toFixed(2)} to ${network}`);
    console.log(`   Fee: ₵${fee.toFixed(2)} (${feePercentage * 100}%)`);
    console.log(`   New balance: ₵${newBalance.toFixed(2)}`);

    res.json({
      success: true,
      newBalance,
      fee,
      userReceives: withdrawalAmount - fee,
      amount: withdrawalAmount,
    });
  } catch (error) {
    console.error('❌ Withdrawal error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to process withdrawal', details: error.message });
  }
});

// ============================================================
// POST /add-gift - Add gift to wallet (for testing/admin)
// ============================================================
router.post('/add-gift', requireAuth, [
  body('celebrantId').notEmpty(),
  body('celebrantName').notEmpty(),
  body('giftAmount').isFloat({ min: 0 }),
  body('giftName').notEmpty(),
  body('fromName').optional(),
  body('isAnonymous').optional().isBoolean(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { celebrantId, celebrantName, giftAmount, giftName, fromName, isAnonymous } = req.body;
    const amount = parseFloat(giftAmount);
    const senderName = isAnonymous ? 'Anonymous' : (fromName || 'Someone');

    // ✅ Check if user exists
    const userCheck = await query('SELECT id FROM users WHERE id = $1', [celebrantId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Celebrant not found' });
    }

    // ✅ Check if wallet exists
    const walletCheck = await query('SELECT id FROM wallets WHERE user_id = $1', [celebrantId]);
    if (walletCheck.rows.length === 0) {
      await query('INSERT INTO wallets (user_id) VALUES ($1)', [celebrantId]);
    }

    // ✅ Update wallet
    const result = await query(
      `UPDATE wallets 
       SET balance = balance + $1, 
           total_received = total_received + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2
       RETURNING balance`,
      [amount, celebrantId]
    );

    const newBalance = result.rows[0].balance;

    // ✅ Create transaction
    await query(
      `INSERT INTO transactions (
        user_id, 
        type, 
        amount, 
        description, 
        status, 
        completed_at
      ) VALUES ($1, 'gift_received', $2, $3, 'completed', CURRENT_TIMESTAMP)`,
      [celebrantId, amount, `Gift received: ${giftName} from ${senderName}`]
    );

    res.json({
      success: true,
      newBalance,
      message: `₵${amount} added to wallet for ${celebrantName}`,
    });
  } catch (error) {
    console.error('❌ Add gift error:', error);
    res.status(500).json({ error: 'Failed to add gift' });
  }
});

module.exports = router;
