const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { MEOLCOMPANY_UUID } = require('../config/seed');

const router = express.Router();

// ============================================================
// GET /balance - Get wallet balance
// ============================================================
router.get('/balance', requireAuth, async (req, res) => {
  try {
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
    console.error('Get balance error:', error);
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

// ============================================================
// GET /transactions - Get transaction history
// ============================================================
router.get('/transactions', requireAuth, async (req, res) => {
  try {
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
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

// ============================================================
// POST /withdraw - Withdraw funds (1% fee to MeolCompany)
// ============================================================
router.post('/withdraw', requireAuth, [
  body('amount').isFloat({ min: 10 }).withMessage('Minimum withdrawal is ₵10'),
  body('network').notEmpty().withMessage('Network is required'),
  body('phoneNumber').notEmpty().isLength({ min: 9 }).withMessage('Valid phone number is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { amount, network, phoneNumber } = req.body;
    const userId = req.userId;

    // Get wallet
    const walletResult = await query(
      'SELECT balance FROM wallets WHERE user_id = $1',
      [userId]
    );

    if (walletResult.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const balance = parseFloat(walletResult.rows[0].balance);
    const withdrawalAmount = parseFloat(amount);

    if (withdrawalAmount > balance) {
      return res.status(400).json({ error: `Insufficient balance. Available: ₵${balance.toFixed(2)}` });
    }

    // ✅ 1% withdrawal fee
    const feePercentage = parseFloat(process.env.WITHDRAWAL_FEE_PERCENTAGE || 0.01);
    const fee = withdrawalAmount * feePercentage;
    const totalDeduction = withdrawalAmount + fee;
    const newBalance = balance - totalDeduction;

    // ✅ Update user's wallet
    await query(
      `UPDATE wallets 
       SET balance = $1, 
           total_withdrawn = total_withdrawn + $2, 
           total_fees_paid = total_fees_paid + $3, 
           updated_at = CURRENT_TIMESTAMP, 
           version = version + 1
       WHERE user_id = $4`,
      [newBalance, withdrawalAmount, fee, userId]
    );

    // ✅ ADD FEE TO MEOLCOMPANY WALLET
    // Check if MeolCompany wallet exists
    const meolCheck = await query('SELECT id FROM wallets WHERE user_id = $1', [MEOLCOMPANY_UUID]);
    if (meolCheck.rows.length === 0) {
      await query(
        'INSERT INTO wallets (user_id, balance, total_received) VALUES ($1, $2, $3)',
        [MEOLCOMPANY_UUID, 0, 0]
      );
    }
    
    // Add fee to MeolCompany wallet
    await query(
      `UPDATE wallets 
       SET balance = balance + $1,
           total_received = total_received + $1,
           updated_at = CURRENT_TIMESTAMP,
           version = version + 1
       WHERE user_id = $2`,
      [fee, MEOLCOMPANY_UUID]
    );

    // Create transaction for user
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

    // ✅ Create transaction for MeolCompany (fee collected)
    await query(
      `INSERT INTO transactions (
        user_id, 
        type, 
        amount, 
        description, 
        status, 
        completed_at
      ) VALUES ($1, 'fee_collected', $2, $3, 'completed', CURRENT_TIMESTAMP)`,
      [MEOLCOMPANY_UUID, fee, `Withdrawal fee from user (${withdrawalAmount} × 1%)`]
    );

    const userReceives = withdrawalAmount - fee;

    console.log(`✅ Withdrawal successful!`);
    console.log(`   User receives: ₵${userReceives.toFixed(2)} to ${network}`);
    console.log(`   MeolCompany fee: ₵${fee.toFixed(2)} (1%)`);
    console.log(`   New balance: ₵${newBalance.toFixed(2)}`);

    res.json({
      success: true,
      newBalance,
      fee,
      userReceives: userReceives,
      amount: withdrawalAmount,
      company: {
        name: 'MeolCompany',
        account: '0596270302',
        feeCollected: fee
      }
    });
  } catch (error) {
    console.error('Withdraw error:', error);
    res.status(500).json({ error: 'Failed to process withdrawal' });
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

    // Check if user exists
    const userCheck = await query('SELECT id FROM users WHERE id = $1', [celebrantId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Celebrant not found' });
    }

    // Update wallet
    const result = await query(
      `UPDATE wallets 
       SET balance = balance + $1, 
           total_received = total_received + $1,
           updated_at = CURRENT_TIMESTAMP, 
           version = version + 1
       WHERE user_id = $2
       RETURNING balance`,
      [amount, celebrantId]
    );

    const newBalance = result.rows[0].balance;

    // Create transaction
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
    console.error('Add gift error:', error);
    res.status(500).json({ error: 'Failed to add gift' });
  }
});

module.exports = router;
