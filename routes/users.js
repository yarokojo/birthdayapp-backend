const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// Reference to users array from auth.js (will be populated)
let users = [];

// Function to set users reference from auth.js
const setUsersRef = (usersRef) => {
  users = usersRef;
};

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

// GET /api/users/profile - Get user profile
router.get('/profile', verifyToken, (req, res) => {
  const user = users.find(u => u.id === req.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    bio: user.bio || '',
    location: user.location || '',
    profileImage: user.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
    createdAt: user.created_at
  });
});

// PUT /api/users/profile - Update user profile
router.put('/profile', verifyToken, [
  body('name').optional().notEmpty(),
  body('bio').optional(),
  body('location').optional(),
  body('username').optional()
], (req, res) => {
  const user = users.find(u => u.id === req.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const { name, bio, location, username, profileImage } = req.body;
  if (name) user.name = name;
  if (bio) user.bio = bio;
  if (location) user.location = location;
  if (username) user.username = username;
  if (profileImage) user.profileImage = profileImage;
  
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    bio: user.bio,
    location: user.location,
    profileImage: user.profileImage
  });
});

// POST /api/users/follow/:userId - Follow user
router.post('/follow/:userId', verifyToken, (req, res) => {
  const { userId } = req.params;
  res.json({ success: true, message: `Now following user ${userId}` });
});

// DELETE /api/users/follow/:userId - Unfollow user
router.delete('/follow/:userId', verifyToken, (req, res) => {
  const { userId } = req.params;
  res.json({ success: true, message: `Unfollowed user ${userId}` });
});

// GET /api/users/search - Search users
router.get('/search', (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) {
    return res.json([]);
  }
  
  const results = users.filter(user => 
    user.name?.toLowerCase().includes(q.toLowerCase()) ||
    user.username?.toLowerCase().includes(q.toLowerCase())
  ).map(user => ({
    id: user.id,
    name: user.name,
    username: user.username,
    profileImage: user.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg'
  }));
  
  res.json(results);
});

module.exports = { router, setUsersRef };
