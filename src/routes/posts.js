const express = require('express');
const router = express.Router();

// Mock posts storage
let posts = [];

// Get all posts
router.get('/', (req, res) => {
  res.json(posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
});

// Create post
router.post('/', (req, res) => {
  const { content, image_url, video_url, location, celebration_type } = req.body;
  
  const newPost = {
    id: posts.length + 1,
    user_id: req.userId || 1,
    content,
    image_url,
    video_url,
    location,
    celebration_type,
    likes_count: 0,
    comments_count: 0,
    created_at: new Date().toISOString()
  };
  
  posts.push(newPost);
  res.status(201).json(newPost);
});

// Like post
router.post('/:id/like', (req, res) => {
  const post = posts.find(p => p.id === parseInt(req.params.id));
  if (post) {
    post.likes_count += 1;
  }
  res.json({ message: 'Post liked' });
});

module.exports = router;
