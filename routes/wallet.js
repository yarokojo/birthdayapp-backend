const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// In-memory storage (replace with database)
let wallets = new Map();
let transactions = [];

// Middleware to verify token
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// GET /api/wallet/balance - Get wallet balance
router.get('/balance', verifyToken, (req, res) => {
  const balance = wallets.get(req.userId)?.balance || 0;
  res.json({ 
    balance: balance,
    currency: 'GHS',
    pendingWithdrawals: 0
  });
});

// GET /api/wallet/transactions - Get transaction history
router.get('/transactions', verifyToken, (req, res) => {
  const userTransactions = transactions.filter(t => t.userId === req.userId);
  res.json(userTransactions);
});

// POST /api/wallet/withdraw - Withdraw funds
router.post('/withdraw', verifyToken, [
  body('amount').isFloat({ min: 1 }),
  body('network').notEmpty(),
  body('phoneNumber').isLength({ min: 9, max: 10 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { amount, network, phoneNumber } = req.body;
  const fee = amount * 0.01;
  const totalDeduction = amount + fee;
  
  const currentBalance = wallets.get(req.userId)?.balance || 0;
  
  if (currentBalance < totalDeduction) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }
  
  const newBalance = currentBalance - totalDeduction;
  wallets.set(req.userId, { balance: newBalance });
  
  const transaction = {
    id: 'WD' + Date.now(),
    userId: req.userId,
    type: 'withdrawal',
    amount: amount,
    fee: fee,
    network: network,
    phoneNumber: phoneNumber,
    status: 'completed',
    date: new Date().toISOString()
  };
  transactions.unshift(transaction);
  
  res.json({ 
    success: true, 
    newBalance: newBalance,
    transaction: transaction,
    fee: fee,
    totalDeduction: totalDeduction
  });
});

// POST /api/wallet/add-funds - Add funds (when gift received)
router.post('/add-funds', [
  body('amount').isFloat({ min: 1 }),
  body('userId').isInt()
], (req, res) => {
  const { userId, amount, giftName, fromName } = req.body;
  
  const currentBalance = wallets.get(userId)?.balance || 0;
  const newBalance = currentBalance + parseFloat(amount);
  wallets.set(userId, { balance: newBalance });
  
  const transaction = {
    id: 'GIFT' + Date.now(),
    userId: userId,
    type: 'gift_received',
    amount: parseFloat(amount),
    giftName: giftName || 'a gift',
    fromName: fromName || 'Someone',
    status: 'completed',
    date: new Date().toISOString()
  };
  transactions.unshift(transaction);
  
  res.json({ 
    success: true, 
    newBalance: newBalance,
    transaction: transaction
  });
});

module.exports = router;
