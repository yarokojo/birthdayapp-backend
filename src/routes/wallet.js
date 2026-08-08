const express = require('express');
const router = express.Router();

// Get balance
router.get('/balance', (req, res) => {
  res.json({
    balance: '100.00',
    total_received: '50.00',
    total_sent: '20.00',
    total_withdrawn: '10.00',
    total_fees_paid: '0.50'
  });
});

// Get transactions
router.get('/transactions', (req, res) => {
  res.json({
    transactions: [
      {
        id: '1',
        type: 'gift_received',
        amount: 50,
        description: 'Gift from Sarah',
        date: new Date().toISOString(),
        status: 'completed'
      },
      {
        id: '2',
        type: 'gift_sent',
        amount: 20,
        description: 'Gift to Mike',
        date: new Date(Date.now() - 86400000).toISOString(),
        status: 'completed'
      }
    ]
  });
});

// Withdraw
router.post('/withdraw', (req, res) => {
  res.json({
    success: true,
    newBalance: 80,
    fee: 0.50,
    userReceives: 9.50
  });
});

// Add gift
router.post('/add-gift', (req, res) => {
  res.json({ success: true });
});

module.exports = router;
