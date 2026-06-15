const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// Reference to users array from auth.js (will be populated)
let users = [];
let friendships = [];

const setUsersRef = (usersRef) => {
  users = usersRef;
};

const setFriendshipsRef = (friendshipsRef) => {
  friendships = friendshipsRef;
};

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
    birthDate: user.birthDate || null,
    createdAt: user.created_at
  });
});

router.put('/profile', verifyToken, [
  body('name').optional().notEmpty(),
  body('bio').optional(),
  body('location').optional(),
  body('username').optional(),
  body('profileImage').optional()
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
    profileImage: user.profileImage,
    birthDate: user.birthDate
  });
});

router.get('/birthdays', verifyToken, (req, res) => {
  const user = users.find(u => u.id === req.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const friendIds = friendships
    .filter(f => f.userId === req.userId)
    .map(f => f.friendId);
  
  const friendsWithBirthdays = users
    .filter(u => friendIds.includes(u.id) && u.birthDate)
    .map(friend => ({
      id: friend.id,
      name: friend.name,
      username: friend.username,
      birthDate: friend.birthDate,
      avatar: friend.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg'
    }));
  
  res.json({
    userBirthday: user.birthDate || null,
    friendsBirthdays: friendsWithBirthdays
  });
});

router.post('/follow/:userId', verifyToken, (req, res) => {
  const { userId } = req.params;
  const targetId = parseInt(userId);
  
  const existing = friendships.find(f => f.userId === req.userId && f.friendId === targetId);
  if (!existing) {
    friendships.push({
      id: Date.now().toString(),
      userId: req.userId,
      friendId: targetId,
      createdAt: new Date().toISOString()
    });
  }
  
  res.json({ success: true, message: `Now following user ${userId}` });
});

router.delete('/follow/:userId', verifyToken, (req, res) => {
  const { userId } = req.params;
  const targetId = parseInt(userId);
  
  const index = friendships.findIndex(f => f.userId === req.userId && f.friendId === targetId);
  if (index !== -1) {
    friendships.splice(index, 1);
  }
  
  res.json({ success: true, message: `Unfollowed user ${userId}` });
});

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
    profileImage: user.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
    birthDate: user.birthDate || null
  }));
  
  res.json(results);
});

module.exports = { router, setUsersRef, setFriendshipsRef };
