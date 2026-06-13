const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// In-memory storage (replace with database in production)
let groupGifts = [];
let groupGiftContributions = [];

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

// GET /api/group-gifts - Get all group gifts
router.get('/', (req, res) => {
  res.json(groupGifts);
});

// GET /api/group-gifts/active - Get active group gifts
router.get('/active', (req, res) => {
  const active = groupGifts.filter(g => g.status === 'active');
  res.json(active);
});

// POST /api/group-gifts - Create a group gift
router.post('/', [
  body('giftName').notEmpty(),
  body('celebrantName').notEmpty(),
  body('targetAmount').isFloat({ min: 1 }),
  body('deadline').optional()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { giftName, celebrantName, targetAmount, deadline, imageUrl } = req.body;
  
  const newGroupGift = {
    id: Date.now().toString(),
    giftName,
    celebrantName,
    celebrantId: `celebrant_${Date.now()}`,
    targetAmount: parseFloat(targetAmount),
    currentAmount: 0,
    contributorsCount: 0,
    deadline: deadline || 'No deadline',
    imageUrl: imageUrl || 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=300&h=300&fit=crop',
    status: 'active',
    contributors: [],
    createdAt: new Date().toISOString()
  };
  
  groupGifts.push(newGroupGift);
  res.status(201).json(newGroupGift);
});

// POST /api/group-gifts/:id/contribute - Contribute to group gift
router.post('/:id/contribute', [
  body('amount').isFloat({ min: 1 }),
  body('userName').optional()
], (req, res) => {
  const { id } = req.params;
  const { amount, userName } = req.body;
  
  const gift = groupGifts.find(g => g.id === id);
  if (!gift) {
    return res.status(404).json({ error: 'Group gift not found' });
  }
  
  if (gift.status === 'completed') {
    return res.status(400).json({ error: 'Group gift already completed' });
  }
  
  if (gift.currentAmount + amount > gift.targetAmount) {
    return res.status(400).json({ error: 'Contribution would exceed target' });
  }
  
  gift.currentAmount += parseFloat(amount);
  gift.contributorsCount += 1;
  gift.contributors.push({
    userName: userName || 'Anonymous',
    amount: parseFloat(amount),
    date: new Date().toISOString()
  });
  
  const isComplete = gift.currentAmount >= gift.targetAmount;
  if (isComplete) {
    gift.status = 'completed';
    gift.completedAt = new Date().toISOString();
  }
  
  res.json({ 
    success: true, 
    isComplete,
    currentAmount: gift.currentAmount,
    targetAmount: gift.targetAmount,
    message: isComplete ? 'Group gift completed!' : 'Contribution added successfully'
  });
});

// GET /api/group-gifts/:id - Get single group gift
router.get('/:id', (req, res) => {
  const gift = groupGifts.find(g => g.id === req.params.id);
  if (!gift) {
    return res.status(404).json({ error: 'Group gift not found' });
  }
  res.json(gift);
});

module.exports = router;
