const express = require('express');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET /balance - Get user's wallet balance
// ============================================================
router.get('/balance', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    console.log(`👤 Fetching wallet for user: ${userId}`);

    const result = await query(
      `SELECT balance, total_received, total_sent, total_withdrawn, total_fees_paid
       FROM wallets
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      await query('INSERT INTO wallets (user_id) VALUES ($1)', [userId]);
      return res.json({
        balance: 0,
        total_received: 0,
        total_sent: 0,
        total_withdrawn: 0,
        total_fees_paid: 0,
        transactions: []
      });
    }

    const wallet = result.rows[0];
    res.json({
      balance: parseFloat(wallet.balance) || 0,
      total_received: parseFloat(wallet.total_received) || 0,
      total_sent: parseFloat(wallet.total_sent) || 0,
      total_withdrawn: parseFloat(wallet.total_withdrawn) || 0,
      total_fees_paid: parseFloat(wallet.total_fees_paid) || 0,
    });
  } catch (error) {
    console.error('❌ Get balance error:', error);
    res.json({ balance: 0, total_received: 0, total_sent: 0, total_withdrawn: 0, total_fees_paid: 0 });
  }
});

// ============================================================
// GET /transactions - Get user's transaction history
// ============================================================
router.get('/transactions', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    console.log(`📊 Getting transactions for user: ${userId}`);

    const result = await query(
      `SELECT id, type, amount, fee, balance_before, balance_after, 
              description, status, network, phone_number, created_at
       FROM transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    const transactions = result.rows.map(t => ({
      id: t.id,
      type: t.type,
      amount: parseFloat(t.amount),
      fee: parseFloat(t.fee) || 0,
      description: t.description || '',
      status: t.status || 'completed',
      network: t.network || '',
      phoneNumber: t.phone_number || '',
      createdAt: t.created_at
    }));

    res.json({ transactions });
  } catch (error) {
    console.error('❌ Get transactions error:', error);
    res.json({ transactions: [] });
  }
});

// ============================================================
// POST /withdraw - Withdraw funds
// ============================================================
router.post('/withdraw', requireAuth, async (req, res) => {
  try {
    const { amount, network, phoneNumber } = req.body;
    const userId = req.userId;

    if (!amount || !network || !phoneNumber) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const amountNum = parseFloat(amount);
    const fee = amountNum * 0.01;
    const totalDeduction = amountNum + fee;

    const walletResult = await query(
      'SELECT balance FROM wallets WHERE user_id = $1',
      [userId]
    );

    if (walletResult.rows.length === 0) {
      return res.status(400).json({ error: 'Wallet not found' });
    }

    const currentBalance = parseFloat(walletResult.rows[0].balance) || 0;
    if (currentBalance < totalDeduction) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const newBalance = currentBalance - totalDeduction;

    await query(
      `UPDATE wallets 
       SET balance = $1, total_withdrawn = total_withdrawn + $2, 
           total_fees_paid = total_fees_paid + $3, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $4`,
      [newBalance, amountNum, fee, userId]
    );

    await query(
      `INSERT INTO transactions (user_id, type, amount, fee, balance_before, balance_after, description, status, network, phone_number, completed_at)
       VALUES ($1, 'withdrawal', $2, $3, $4, $5, $6, 'completed', $7, $8, CURRENT_TIMESTAMP)`,
      [userId, amountNum, fee, currentBalance, newBalance, `Withdrawal to ${network}`, network, phoneNumber]
    );

    res.json({
      success: true,
      newBalance: newBalance,
      fee: fee,
      userReceives: amountNum - fee
    });
  } catch (error) {
    console.error('❌ Withdraw error:', error);
    res.status(500).json({ error: 'Withdrawal failed' });
  }
});

// ============================================================
// POST /add-gift - Add gift to wallet
// ============================================================
router.post('/add-gift', requireAuth, async (req, res) => {
  try {
    const { celebrantId, celebrantName, giftName, giftAmount, fromName, isAnonymous } = req.body;
    const amount = parseFloat(giftAmount);

    if (!celebrantId || !amount || !giftName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await query(
      `UPDATE wallets 
       SET balance = balance + $1, total_received = total_received + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [amount, celebrantId]
    );

    const senderName = isAnonymous ? 'Anonymous' : (fromName || 'Someone');

    await query(
      `INSERT INTO transactions (user_id, type, amount, description, status, completed_at)
       VALUES ($1, 'gift_received', $2, $3, 'completed', CURRENT_TIMESTAMP)`,
      [celebrantId, amount, `Gift received: ${giftName} from ${senderName}`]
    );

    res.json({ success: true, message: `₵${amount} added to wallet` });
  } catch (error) {
    console.error('❌ Add gift error:', error);
    res.status(500).json({ error: 'Failed to add gift' });
  }
});

module.exports = router;
