const express = require('express');
const router = express.Router();

// Get all posts
router.get('/', (req, res) => {
  res.json([
    {
      id: '1',
      userId: 1,
      content: '🎉 Welcome to BirthdayApp! This is your first post.',
      image: null,
      video: null,
      location: 'Accra, Ghana',
      celebrationType: 'birthday',
      celebrantName: 'Demo User',
      isBirthday: true,
      likes: 5,
      comments: 2,
      createdAt: new Date().toISOString(),
      authorName: 'Demo User',
      authorHandle: '@demouser',
      authorImage: 'https://randomuser.me/api/portraits/men/1.jpg',
      commentList: []
    }
  ]);
});

// Create post
router.post('/', (req, res) => {
  const newPost = {
    id: Date.now().toString(),
    userId: 1,
    ...req.body,
    likes: 0,
    comments: 0,
    createdAt: new Date().toISOString(),
    authorName: 'Demo User',
    authorHandle: '@demouser',
    authorImage: 'https://randomuser.me/api/portraits/men/1.jpg',
    commentList: []
  };
  res.status(201).json(newPost);
});

// Like post
router.post('/:id/like', (req, res) => {
  res.json({ success: true });
});

// Unlike post
router.delete('/:id/like', (req, res) => {
  res.json({ success: true });
});

// Bookmark post
router.post('/:id/bookmark', (req, res) => {
  res.json({ success: true });
});

// Unbookmark post
router.delete('/:id/bookmark', (req, res) => {
  res.json({ success: true });
});

// Add comment
router.post('/:id/comments', (req, res) => {
  res.status(201).json({
    id: Date.now().toString(),
    userId: 1,
    userName: 'Demo User',
    userAvatar: 'https://randomuser.me/api/portraits/men/1.jpg',
    text: req.body.text,
    createdAt: new Date().toISOString(),
    likes: 0
  });
});

// Delete comment
router.delete('/:postId/comments/:commentId', (req, res) => {
  res.json({ success: true });
});

module.exports = router;
