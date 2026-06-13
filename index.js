const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Test endpoint
app.get('/', (req, res) => {
  res.json({ message: 'BirthdayApp API is running!' });
});

// Auth routes (add your existing routes here)
app.post('/api/auth/register', (req, res) => {
  const { email, password, name, username } = req.body;
  res.json({ 
    token: 'test-token', 
    user: { id: 1, email, name, username } 
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  res.json({ 
    token: 'test-token', 
    user: { id: 1, email, name: 'Test User', username: '@testuser' } 
  });
});

// Gifts endpoint
app.get('/api/gifts', (req, res) => {
  res.json([
    { id: 1, name: 'Gold Bar', price: 100, category: 'Luxury', icon: '🥇' },
    { id: 2, name: 'Diamond Ring', price: 150, category: 'Luxury', icon: '💍' },
    { id: 3, name: 'Celebration Cake', price: 50, category: 'Food', icon: '🎂' }
  ]);
});

// Posts endpoint
app.get('/api/posts', (req, res) => {
  res.json([
    { id: 1, content: 'Happy Birthday! 🎂', authorName: 'Sarah Johnson', likes: 45 },
    { id: 2, content: 'Celebrating! 🎉', authorName: 'Mike Chen', likes: 89 }
  ]);
});

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`📍 Network: http://154.161.179.197:${PORT}`);
  console.log(`📝 Health: http://localhost:${PORT}/health`);
});
