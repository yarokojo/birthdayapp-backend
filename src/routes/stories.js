const express = require('express');
const router = express.Router();

// Mock stories data
const mockStories = [
  {
    id: '1',
    userId: '1',
    userName: 'Demo User',
    userHandle: '@demouser',
    userAvatar: 'https://randomuser.me/api/portraits/men/1.jpg',
    contentUrl: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=400&h=400&fit=crop',
    isVideo: false,
    caption: '🎉 Celebrating my birthday! 🎂',
    timestamp: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    seen: false,
    viewers: 15,
    liked: false,
    likes: 5,
    privacy: 'friends'
  },
  {
    id: '2',
    userId: '2',
    userName: 'Sarah Johnson',
    userHandle: '@sarahj',
    userAvatar: 'https://randomuser.me/api/portraits/women/1.jpg',
    contentUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&h=400&fit=crop',
    isVideo: false,
    caption: '🎊 Party time! 🥳',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    expiresAt: new Date(Date.now() + 82800000).toISOString(),
    seen: false,
    viewers: 8,
    liked: false,
    likes: 3,
    privacy: 'friends'
  }
];

// Get stories
router.get('/', (req, res) => {
  console.log('📸 Fetching stories, count:', mockStories.length);
  res.json({ stories: mockStories });
});

// Create story
router.post('/', (req, res) => {
  const newStory = {
    id: Date.now().toString(),
    userId: '1',
    userName: 'Demo User',
    userHandle: '@demouser',
    userAvatar: 'https://randomuser.me/api/portraits/men/1.jpg',
    ...req.body,
    timestamp: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    seen: false,
    viewers: 0,
    liked: false,
    likes: 0
  };
  mockStories.unshift(newStory);
  res.status(201).json({ success: true, story: newStory });
});

// Mark story as seen
router.post('/seen', (req, res) => {
  const { storyId } = req.body;
  const story = mockStories.find(s => s.id === storyId);
  if (story) {
    story.seen = true;
    story.viewers = (story.viewers || 0) + 1;
  }
  res.json({ success: true });
});

// Get seen stories
router.get('/seen/:userId', (req, res) => {
  const seenIds = mockStories.filter(s => s.seen).map(s => s.id);
  res.json({ seenStoryIds: seenIds });
});

// Like story
router.post('/:id/like', (req, res) => {
  const story = mockStories.find(s => s.id === req.params.id);
  if (story) {
    story.liked = true;
    story.likes = (story.likes || 0) + 1;
  }
  res.json({ success: true });
});

// Unlike story
router.delete('/:id/like', (req, res) => {
  const story = mockStories.find(s => s.id === req.params.id);
  if (story) {
    story.liked = false;
    story.likes = Math.max(0, (story.likes || 0) - 1);
  }
  res.json({ success: true });
});

// Delete story
router.delete('/:id', (req, res) => {
  const index = mockStories.findIndex(s => s.id === req.params.id);
  if (index !== -1) {
    mockStories.splice(index, 1);
  }
  res.json({ success: true });
});

module.exports = router;
