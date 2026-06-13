const express = require('express');
const router = express.Router();

const GIFTS = [
  { id: 1, name: 'Gold Bar', price: 100, category: 'Luxury', icon: '🥇', description: '24K pure gold bar' },
  { id: 2, name: 'Diamond Ring', price: 150, category: 'Luxury', icon: '💍', description: 'Exclusive diamond ring' },
  { id: 3, name: 'Celebration Cake', price: 50, category: 'Food', icon: '🎂', description: 'Delicious birthday cake' },
  { id: 4, name: 'Fresh Flowers', price: 40, category: 'Flowers', icon: '🌹', description: 'Beautiful flower bouquet' },
  { id: 5, name: 'Premium Drink', price: 20, category: 'Drinks', icon: '🍾', description: 'Premium champagne' },
];

router.get('/', (req, res) => {
  res.json(GIFTS);
});

router.post('/:id/purchase', (req, res) => {
  const { network, phoneNumber, phone_number } = req.body;
  const gift = GIFTS.find(g => g.id === parseInt(req.params.id));
  if (!gift) {
    return res.status(404).json({ error: 'Gift not found' });
  }
  const finalPhone = phoneNumber || phone_number;
  const transaction = {
    id: 'TXN' + Date.now(),
    gift_id: gift.id,
    amount: gift.price,
    network,
    phone_number: finalPhone,
    status: 'completed',
    created_at: new Date().toISOString()
  };
  res.status(201).json(transaction);
});

module.exports = router;
