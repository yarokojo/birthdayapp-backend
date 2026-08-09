const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require("multer");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ============ DATA STORAGE ============
const DATA_FILE = path.join(__dirname, 'data.json');

let data = {
  users: [],
  wallets: {},
  companyFees: [],
  giftTransactions: [],
  notifications: [],
  groupGifts: [],
  friendRequests: [],
  friendships: [],
  follows: [],
  posts: [],
  postLikes: [],
  bookmarks: [],
  videoPositions: [],
  seenStories: [],
  reminders: [],
  banners: [],
  userSettings: {},
  blockedUsers: {},
  calendarEvents: {},
  stories: [],
  liveStreams: [],
  companyAccount: {
    name: 'MeolCompany',
    accountNumber: '0596270302',
    network: 'MTN',
    totalFees: 0
  }
};

try {
  if (fs.existsSync(DATA_FILE)) {
    const saved = fs.readFileSync(DATA_FILE, 'utf8');
    data = JSON.parse(saved);
    console.log(`📂 Loaded data: ${data.users.length} users, ${data.posts.length} posts`);
  }
} catch (err) {
  console.log("📂 Starting fresh data");
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ============ INITIALIZE BANNERS ============
const initBanners = () => {
  if (!data.banners || data.banners.length === 0) {
    data.banners = [
      { 
        id: 'banner_1', 
        title: '🎉 Today\'s Celebrations', 
        subtitle: 'Check out today\'s events!', 
        icon: '🎂', 
        colors: ['#6366f1', '#8b5cf6', '#a855f7'], 
        type: 'celebrations', 
        link: 'today', 
        active: true, 
        priority: 1, 
        views: 0, 
        clicks: 0, 
        createdAt: new Date().toISOString() 
      },
      { 
        id: 'banner_2', 
        title: '🎁 Gift Shop', 
        subtitle: 'Send a gift to someone special', 
        icon: '🎁', 
        colors: ['#ec4899', '#f472b6', '#f9a8d4'], 
        type: 'gifts', 
        link: 'gift_shop', 
        active: true, 
        priority: 2, 
        views: 0, 
        clicks: 0, 
        createdAt: new Date().toISOString() 
      }
    ];
    saveData();
    console.log('✅ Banners initialized');
  }
};
initBanners();

// ============ VIDEO UPLOAD ============
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'video-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  }
});

app.use('/uploads', express.static('uploads'));

// ============ HELPER FUNCTIONS ============
const getWalletBalance = (userId) => data.wallets[userId]?.balance || 0;

const addToWallet = (userId, amount, giftName, fromName) => {
  if (!data.wallets[userId]) data.wallets[userId] = { balance: 0, transactions: [] };
  data.wallets[userId].balance += amount;
  data.wallets[userId].transactions.unshift({
    id: Date.now().toString(),
    type: 'credit',
    amount,
    giftName,
    fromName,
    date: new Date().toISOString()
  });
  saveData();
  return data.wallets[userId].balance;
};

const deductFromWallet = (userId, amount, description) => {
  if (!data.wallets[userId]) data.wallets[userId] = { balance: 0, transactions: [] };
  if (data.wallets[userId].balance < amount) {
    return { success: false, error: 'Insufficient balance' };
  }
  data.wallets[userId].balance -= amount;
  data.wallets[userId].transactions.unshift({
    id: Date.now().toString(),
    type: 'debit',
    amount,
    description,
    date: new Date().toISOString()
  });
  saveData();
  return { success: true, newBalance: data.wallets[userId].balance };
};

const addNotification = (userId, type, title, message, imageUrl = null, targetId = null, targetName = null, extraData = {}) => {
  console.log(`📨 Creating notification for user ${userId}: ${title}`);
  
  const newNotification = {
    id: Date.now().toString(),
    userId: parseInt(userId),
    type,
    title,
    message,
    imageUrl,
    targetId,
    targetName,
    extraData,
    isRead: false,
    createdAt: new Date().toISOString()
  };
  
  if (!data.notifications) data.notifications = [];
  data.notifications.unshift(newNotification);
  saveData();
  
  console.log(`✅ Notification created: ${newNotification.id}`);
  return newNotification;
};

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
    req.userId = decoded.userId;
    next();
  } catch (err) {
    console.error('❌ Invalid token:', err.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ============ HEALTH CHECK ============
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.get("/", (req, res) => {
  res.json({ message: "BirthdayApp API is running!" });
});

// ============================================================
// ✅ AUTH ENDPOINTS
// ============================================================
app.post("/api/auth/register", async (req, res) => {
  const { email, password, name, username, birthDate } = req.body;
  const normalizedEmail = email.toLowerCase();
  
  if (data.users.find(u => u.email === normalizedEmail)) {
    return res.status(400).json({ error: "User already exists" });
  }
  if (!birthDate) {
    return res.status(400).json({ error: 'Birth date is required' });
  }
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = { 
      id: data.users.length + 1, 
      email: normalizedEmail, 
      name, 
      username,
      birthDate: birthDate || null,
      phone: req.body.phone || '',
      network: req.body.network || '',
      password_hash: hashedPassword,
      profileImage: 'https://randomuser.me/api/portraits/men/1.jpg',
      bio: '',
      location: '',
      created_at: new Date().toISOString() 
    };
    data.users.push(newUser);
    
    data.wallets[newUser.id] = { balance: 0, transactions: [] };
    data.userSettings[newUser.id] = {
      theme: { darkMode: false, primaryColor: '#6366f1' },
      privacy: { birthdayVisibility: 'friends', postVisibility: 'friends', allowWishes: 'everyone', allowTagging: 'friends' },
      notifications: { enabled: true, birthdayReminders: true, friendRequests: true, giftNotifications: true, commentNotifications: true }
    };
    data.blockedUsers[newUser.id] = [];
    data.calendarEvents[newUser.id] = [];
    saveData();
    
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      process.env.JWT_SECRET || 'your_jwt_secret_key',
      { expiresIn: '7d' }
    );
    
    res.json({ token, user: { id: newUser.id, email: newUser.email, name, username, birthDate: newUser.birthDate } });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = email.toLowerCase();
  const user = data.users.find(u => u.email === normalizedEmail);
  
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  
  try {
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your_jwt_secret_key',
      { expiresIn: '7d' }
    );
    
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, username: user.username, birthDate: user.birthDate } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/change-password', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    
    const user = data.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password_hash = hashedPassword;
    saveData();
    
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('❌ Password change error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// ✅ USERS ENDPOINTS
// ============================================================
app.get('/api/users/profile', verifyToken, (req, res) => {
  const user = data.users.find(u => u.id === req.userId);
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
    phone: user.phone || '',
    network: user.network || '',
    createdAt: user.created_at,
    followersCount: data.follows ? data.follows.filter(f => f.followingId === user.id).length : 0,
    followingCount: data.follows ? data.follows.filter(f => f.followerId === user.id).length : 0
  });
});

app.put('/api/users/profile', verifyToken, (req, res) => {
  const userIndex = data.users.findIndex(u => u.id === req.userId);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const { name, bio, location, username, profileImage, phone, network, birthDate } = req.body;
  if (name !== undefined) data.users[userIndex].name = name;
  if (bio !== undefined) data.users[userIndex].bio = bio;
  if (location !== undefined) data.users[userIndex].location = location;
  if (username !== undefined) data.users[userIndex].username = username;
  if (profileImage !== undefined) data.users[userIndex].profileImage = profileImage;
  if (phone !== undefined) data.users[userIndex].phone = phone;
  if (network !== undefined) data.users[userIndex].network = network;
  if (birthDate !== undefined) data.users[userIndex].birthDate = birthDate;
  saveData();
  
  const updatedUser = data.users[userIndex];
  res.json({
    id: updatedUser.id,
    name: updatedUser.name,
    email: updatedUser.email,
    username: updatedUser.username,
    bio: updatedUser.bio || '',
    location: updatedUser.location || '',
    profileImage: updatedUser.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
    birthDate: updatedUser.birthDate || null,
    phone: updatedUser.phone || '',
    network: updatedUser.network || '',
    createdAt: updatedUser.created_at
  });
});

app.get('/api/users/search', (req, res) => {
  const { q } = req.query;
  if (!q || q.length === 0) {
    return res.json([]);
  }
  const searchTerm = q.toLowerCase().trim();
  const results = data.users.filter(user => {
    const nameMatch = user.name?.toLowerCase().includes(searchTerm);
    const usernameMatch = user.username?.toLowerCase().includes(searchTerm);
    const emailMatch = user.email?.toLowerCase().includes(searchTerm);
    return nameMatch || usernameMatch || emailMatch;
  });
  res.json(results.map(user => ({
    id: user.id,
    name: user.name,
    username: user.username,
    profileImage: user.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
    birthDate: user.birthDate || null,
    phone: user.phone || '',
    network: user.network || ''
  })));
});

app.delete('/api/user/delete', verifyToken, (req, res) => {
  const userId = req.userId;
  const userIndex = data.users.findIndex(u => u.id === userId);
  if (userIndex !== -1) data.users.splice(userIndex, 1);
  delete data.wallets[userId];
  data.friendships = data.friendships.filter(f => f.userId !== userId && f.friendId !== userId);
  data.friendRequests = data.friendRequests.filter(r => r.fromUserId !== userId && r.toUserId !== userId);
  data.posts = data.posts.filter(p => p.userId !== userId);
  data.notifications = data.notifications.filter(n => n.userId !== userId);
  delete data.userSettings[userId];
  delete data.blockedUsers[userId];
  delete data.calendarEvents[userId];
  saveData();
  res.json({ success: true, message: 'Account deleted successfully' });
});

// ============================================================
// ✅ WALLET ENDPOINTS
// ============================================================
app.get('/api/wallet/balance', verifyToken, (req, res) => {
  const userId = req.userId;
  const wallet = data.wallets[userId] || { balance: 0, transactions: [] };
  res.json({
    balance: wallet.balance || 0,
    total_received: 0,
    total_sent: 0,
    total_withdrawn: 0,
    total_fees_paid: 0
  });
});

app.get('/api/wallet/transactions', verifyToken, (req, res) => {
  const userId = req.userId;
  const wallet = data.wallets[userId] || { balance: 0, transactions: [] };
  res.json({ transactions: wallet.transactions || [] });
});

app.post('/api/wallet/withdraw', verifyToken, (req, res) => {
  const { amount, network, phoneNumber } = req.body;
  const userId = req.userId;
  
  if (!amount || !network || !phoneNumber) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const amountNum = parseFloat(amount);
  const fee = amountNum * 0.01;
  const totalDeduction = amountNum + fee;
  
  if (!data.wallets[userId]) {
    return res.status(400).json({ error: 'Wallet not found' });
  }
  
  if (data.wallets[userId].balance < totalDeduction) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }
  
  data.wallets[userId].balance -= totalDeduction;
  data.wallets[userId].transactions.unshift({
    id: Date.now().toString(),
    type: 'withdrawal',
    amount: amountNum,
    fee: fee,
    network,
    phoneNumber,
    description: `Withdrawal to ${network}`,
    date: new Date().toISOString()
  });
  
  data.companyFees.unshift({
    id: Date.now().toString(),
    amount: fee,
    fromUserId: userId,
    withdrawalAmount: amountNum,
    date: new Date().toISOString()
  });
  data.companyAccount.totalFees += fee;
  saveData();
  
  res.json({
    success: true,
    amount: amountNum,
    fee: fee,
    userReceives: amountNum - fee,
    newBalance: data.wallets[userId].balance
  });
});

app.post('/api/wallet/add-gift', verifyToken, (req, res) => {
  const { celebrantId, celebrantName, giftAmount, giftName, fromName, isAnonymous } = req.body;
  const amount = parseFloat(giftAmount);
  const senderName = isAnonymous ? 'Anonymous' : (fromName || 'Someone');
  const newBalance = addToWallet(celebrantId, amount, giftName, senderName);
  saveData();
  res.json({ success: true, newBalance, message: `₵${amount} added to wallet` });
});

// ============================================================
// ✅ POSTS ENDPOINTS
// ============================================================
app.get('/api/posts', (req, res) => {
  const allPosts = data.posts || [];
  const enrichedPosts = allPosts.map(post => {
    const author = data.users.find(u => u.id === post.userId);
    return { ...post, phone: author?.phone || '', network: author?.network || 'MTN' };
  });
  res.json(enrichedPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post('/api/posts', verifyToken, (req, res) => {
  const { content, image, video, location, celebrationType, celebrantName, isBirthday, music, hashtags } = req.body;
  const user = data.users.find(u => u.id === req.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const newPost = {
    id: Date.now().toString(),
    userId: user.id,
    content,
    image: image || null,
    video: video || null,
    location: location || null,
    celebrationType: celebrationType || 'general',
    celebrantName: celebrantName || '',
    isBirthday: isBirthday || celebrationType === 'birthday',
    music: music || null,
    hashtags: hashtags || [],
    authorName: user.name,
    authorHandle: user.username,
    authorImage: user.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
    phone: user.phone || '',
    network: user.network || 'MTN',
    likes: 0,
    comments: 0,
    reposts: 0,
    views: 0,
    createdAt: new Date().toISOString(),
    commentList: []
  };
  
  if (!data.posts) data.posts = [];
  data.posts.unshift(newPost);
  saveData();
  res.status(201).json(newPost);
});

app.delete('/api/posts/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const post = (data.posts || []).find(p => p.id === id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (post.userId !== req.userId) {
    return res.status(403).json({ error: 'Not authorized to delete this post' });
  }
  const index = (data.posts || []).findIndex(p => p.id === id);
  if (index !== -1) {
    data.posts.splice(index, 1);
    saveData();
  }
  res.json({ success: true });
});

app.post('/api/posts/:id/like', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.userId;
  const post = (data.posts || []).find(p => p.id === id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  
  if (!data.postLikes) data.postLikes = [];
  const existing = data.postLikes.find(l => l.postId === id && l.userId === userId);
  if (!existing) {
    data.postLikes.push({ postId: id, userId, createdAt: new Date().toISOString() });
    post.likes = (post.likes || 0) + 1;
    saveData();
    if (post.userId !== userId) {
      const user = data.users.find(u => u.id === userId);
      addNotification(post.userId, 'like', '❤️ Post Liked', `${user?.name || 'Someone'} liked your post`);
    }
  }
  res.json({ success: true, likes: post.likes });
});

app.delete('/api/posts/:id/like', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.userId;
  const post = (data.posts || []).find(p => p.id === id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  
  if (data.postLikes) {
    const index = data.postLikes.findIndex(l => l.postId === id && l.userId === userId);
    if (index !== -1) {
      data.postLikes.splice(index, 1);
      post.likes = Math.max(0, (post.likes || 0) - 1);
      saveData();
    }
  }
  res.json({ success: true, likes: post.likes });
});

app.post('/api/posts/:id/bookmark', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.userId;
  if (!data.bookmarks) data.bookmarks = [];
  const existing = data.bookmarks.find(b => b.postId === id && b.userId === userId);
  if (!existing) {
    data.bookmarks.push({ postId: id, userId, createdAt: new Date().toISOString() });
    saveData();
  }
  res.json({ success: true });
});

app.delete('/api/posts/:id/bookmark', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.userId;
  if (data.bookmarks) {
    const index = data.bookmarks.findIndex(b => b.postId === id && b.userId === userId);
    if (index !== -1) {
      data.bookmarks.splice(index, 1);
      saveData();
    }
  }
  res.json({ success: true });
});

app.post('/api/posts/:id/comments', verifyToken, (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  const userId = req.userId;
  const post = (data.posts || []).find(p => p.id === id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  
  const user = data.users.find(u => u.id === userId);
  const newComment = {
    id: Date.now().toString(),
    userId,
    userName: user?.name || 'Anonymous',
    userAvatar: user?.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
    text,
    createdAt: new Date().toISOString(),
    likes: 0
  };
  if (!post.commentList) post.commentList = [];
  post.commentList.push(newComment);
  post.comments = (post.comments || 0) + 1;
  saveData();
  
  if (post.userId !== userId) {
    addNotification(post.userId, 'comment', '💬 New Comment', `${user?.name || 'Someone'} commented on your post`);
  }
  res.status(201).json(newComment);
});

app.delete('/api/posts/:postId/comments/:commentId', verifyToken, (req, res) => {
  const { postId, commentId } = req.params;
  const userId = req.userId;
  const post = (data.posts || []).find(p => p.id === postId);
  if (!post) return res.status(404).json({ error: "Post not found" });
  
  const index = post.commentList?.findIndex(c => c.id === commentId);
  if (index === -1 || index === undefined) {
    return res.status(404).json({ error: "Comment not found" });
  }
  
  const comment = post.commentList[index];
  if (comment.userId !== userId && post.userId !== userId) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  post.commentList.splice(index, 1);
  post.comments = Math.max(0, (post.comments || 0) - 1);
  saveData();
  res.json({ success: true });
});

// ============================================================
// ✅ FRIENDS ENDPOINTS
// ============================================================
app.get('/api/friends/list/:userId', verifyToken, (req, res) => {
  const userId = parseInt(req.params.userId);
  const friendships = data.friendships.filter(f => f.userId === userId);
  const friends = friendships
    .map(f => {
      const friend = data.users.find(u => u.id === f.friendId);
      if (!friend) return null;
      return {
        id: friend.id,
        name: friend.name,
        username: friend.username,
        profileImage: friend.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
        birthDate: friend.birthDate || null,
        phone: friend.phone || '',
        network: friend.network || 'MTN'
      };
    })
    .filter(Boolean);
  res.json({ friends });
});

app.get('/api/friends/requests', verifyToken, (req, res) => {
  const userId = req.userId;
  const pending = data.friendRequests.filter(r => r.toUserId === userId && r.status === 'pending');
  const withDetails = pending.map(req => {
    const fromUser = data.users.find(u => u.id === req.fromUserId);
    return { ...req, fromUser: fromUser ? { id: fromUser.id, name: fromUser.name, username: fromUser.username, profileImage: fromUser.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg' } : null };
  });
  res.json({ requests: withDetails });
});

app.post('/api/friends/request', verifyToken, (req, res) => {
  const { toUserId } = req.body;
  const fromUserId = req.userId;
  
  if (fromUserId === toUserId) {
    return res.status(400).json({ error: 'Cannot send request to yourself' });
  }
  
  const existing = data.friendRequests.find(r => r.fromUserId === fromUserId && r.toUserId === toUserId && r.status === 'pending');
  if (existing) {
    return res.status(400).json({ error: 'Request already sent' });
  }
  
  const newRequest = { id: Date.now().toString(), fromUserId: parseInt(fromUserId), toUserId: parseInt(toUserId), status: 'pending', createdAt: new Date().toISOString() };
  data.friendRequests.push(newRequest);
  saveData();
  
  const fromUser = data.users.find(u => u.id === fromUserId);
  if (fromUser) {
    addNotification(toUserId, 'friend_request', '👋 Friend Request', `${fromUser.name} sent you a friend request!`, fromUser.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg', fromUserId, fromUser.name);
  }
  res.json({ success: true, request: newRequest });
});

app.post('/api/friends/accept', verifyToken, (req, res) => {
  const { requestId } = req.body;
  const userId = req.userId;
  const request = data.friendRequests.find(r => r.id === requestId);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.toUserId !== userId) return res.status(403).json({ error: 'Not authorized' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'Request already processed' });
  
  request.status = 'accepted';
  data.friendships.push({ id: Date.now().toString(), userId: request.fromUserId, friendId: request.toUserId, createdAt: new Date().toISOString() });
  data.friendships.push({ id: (Date.now() + 1).toString(), userId: request.toUserId, friendId: request.fromUserId, createdAt: new Date().toISOString() });
  saveData();
  
  const toUser = data.users.find(u => u.id === request.toUserId);
  if (toUser) {
    addNotification(request.fromUserId, 'friend_accept', '✅ Friend Request Accepted', `${toUser.name} accepted your friend request!`, toUser.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg', request.toUserId, toUser.name);
  }
  res.json({ success: true });
});

app.post('/api/friends/decline', verifyToken, (req, res) => {
  const { requestId } = req.body;
  const userId = req.userId;
  const request = data.friendRequests.find(r => r.id === requestId);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.toUserId !== userId) return res.status(403).json({ error: 'Not authorized' });
  request.status = 'declined';
  saveData();
  res.json({ success: true });
});

app.delete('/api/friends/:friendId', verifyToken, (req, res) => {
  const friendId = parseInt(req.params.friendId);
  const userId = req.userId;
  const index1 = data.friendships.findIndex(f => f.userId === userId && f.friendId === friendId);
  const index2 = data.friendships.findIndex(f => f.userId === friendId && f.friendId === userId);
  if (index1 !== -1) data.friendships.splice(index1, 1);
  if (index2 !== -1) data.friendships.splice(index2, 1);
  saveData();
  res.json({ success: true });
});

// ============================================================
// ✅ FOLLOW ENDPOINTS
// ============================================================
app.post('/api/users/follow/:userId', verifyToken, (req, res) => {
  const userId = parseInt(req.params.userId);
  const followerId = req.userId;
  if (followerId === userId) return res.status(400).json({ error: 'Cannot follow yourself' });
  if (!data.follows) data.follows = [];
  const existing = data.follows.find(f => f.followerId === followerId && f.followingId === userId);
  if (!existing) {
    data.follows.push({ id: Date.now().toString(), followerId, followingId: userId, createdAt: new Date().toISOString() });
    saveData();
    const follower = data.users.find(u => u.id === followerId);
    if (follower) addNotification(userId, 'follow', '👤 New Follower', `${follower.name} started following you!`, follower.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg', followerId, follower.name);
  }
  res.json({ success: true });
});

app.delete('/api/users/follow/:userId', verifyToken, (req, res) => {
  const userId = parseInt(req.params.userId);
  const followerId = req.userId;
  if (data.follows) {
    data.follows = data.follows.filter(f => !(f.followerId === followerId && f.followingId === userId));
    saveData();
  }
  res.json({ success: true });
});

// ============================================================
// ✅ BANNERS ENDPOINTS
// ============================================================
app.get('/api/banners', (req, res) => {
  const activeBanners = (data.banners || []).filter(b => b.active !== false);
  res.json({ success: true, banners: activeBanners });
});

app.post('/api/banners/:id/view', (req, res) => {
  const { id } = req.params;
  const banner = (data.banners || []).find(b => b.id === id);
  if (banner) { banner.views = (banner.views || 0) + 1; saveData(); }
  res.json({ success: true });
});

app.post('/api/banners/:id/click', (req, res) => {
  const { id } = req.params;
  const banner = (data.banners || []).find(b => b.id === id);
  if (banner) { banner.clicks = (banner.clicks || 0) + 1; saveData(); }
  res.json({ success: true });
});

// ============================================================
// ✅ NOTIFICATIONS ENDPOINTS
// ============================================================
app.get('/api/notifications/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const userNotifications = (data.notifications || []).filter(n => n.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const unreadCount = userNotifications.filter(n => !n.isRead).length;
  res.json({ notifications: userNotifications, unreadCount });
});

app.post('/api/notifications', (req, res) => {
  const { userId, type, title, message, imageUrl, targetId, targetName, extraData } = req.body;
  if (!userId || !type || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const newNotification = {
    id: Date.now().toString(),
    userId: parseInt(userId),
    type,
    title: title || type,
    message,
    imageUrl: imageUrl || null,
    targetId: targetId || null,
    targetName: targetName || null,
    extraData: extraData || {},
    isRead: false,
    createdAt: new Date().toISOString()
  };
  
  if (!data.notifications) data.notifications = [];
  data.notifications.unshift(newNotification);
  saveData();
  res.status(201).json(newNotification);
});

app.put('/api/notifications/:id/read', (req, res) => {
  const { id } = req.params;
  const notification = data.notifications.find(n => n.id === id);
  if (!notification) return res.status(404).json({ error: "Notification not found" });
  notification.isRead = true;
  saveData();
  res.json({ success: true });
});

app.put('/api/notifications/read-all/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  data.notifications.filter(n => n.userId === userId && !n.isRead).forEach(n => n.isRead = true);
  saveData();
  res.json({ success: true });
});

app.delete('/api/notifications/:id', (req, res) => {
  const { id } = req.params;
  const index = data.notifications.findIndex(n => n.id === id);
  if (index === -1) return res.status(404).json({ error: "Notification not found" });
  data.notifications.splice(index, 1);
  saveData();
  res.json({ success: true });
});

// ============================================================
// ✅ GIFTS ENDPOINTS
// ============================================================
app.get('/api/gifts', (req, res) => {
  res.json([
    { id: 1, name: "Gold Bar", price: 100, category: "Luxury", icon: "🥇" },
    { id: 2, name: "Diamond Ring", price: 150, category: "Luxury", icon: "💍" },
    { id: 3, name: "Celebration Cake", price: 50, category: "Food", icon: "🎂" },
    { id: 4, name: "Fresh Flowers", price: 40, category: "Flowers", icon: "🌹" },
    { id: 5, name: "Premium Drink", price: 20, category: "Drinks", icon: "🍾" }
  ]);
});

app.post('/api/gifts/purchase', verifyToken, (req, res) => {
  const { giftId, giftName, amount, network, phoneNumber, recipientId, recipientName, isPremium, senderName } = req.body;
  if (!giftId || !amount || !recipientId) return res.status(400).json({ error: "Missing required fields" });
  const user = data.users.find(u => u.id === req.userId);
  const newBalance = addToWallet(recipientId, parseFloat(amount), giftName, senderName || user?.name || 'Someone');
  const transaction = { 
    id: Date.now().toString(), 
    giftId, 
    giftName, 
    amount: parseFloat(amount), 
    buyerId: req.userId, 
    buyerName: user?.name || 'Someone', 
    recipientId, 
    recipientName, 
    network, 
    phoneNumber, 
    isPremium: isPremium || false,
    status: 'completed', 
    date: new Date().toISOString() 
  };
  data.giftTransactions.unshift(transaction);
  saveData();
  addNotification(recipientId, 'gift', '🎁 Gift Received', `${user?.name || 'Someone'} sent you ${giftName} worth ₵${amount}!`);
  res.json({ success: true, transaction, newBalance });
});

// ============================================================
// ✅ VIDEO UPLOAD ENDPOINT
// ============================================================
app.post('/api/upload/video', videoUpload.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }
    const videoUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    console.log('🎬 Video uploaded:', videoUrl);
    res.json({ success: true, videoUrl });
  } catch (error) {
    console.error('❌ Video upload error:', error);
    res.status(500).json({ error: 'Video upload failed' });
  }
});

// ============================================================
// ✅ IMAGE UPLOAD ENDPOINT
// ============================================================
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'image-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

app.post('/api/upload/image', imageUpload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    console.log('🖼️ Image uploaded:', imageUrl);
    res.json({ success: true, imageUrl });
  } catch (error) {
    console.error('❌ Image upload error:', error);
    res.status(500).json({ error: 'Image upload failed' });
  }
});

// ============================================================
// ✅ SUPPORT/FEEDBACK ENDPOINT
// ============================================================
app.post('/api/support/feedback', (req, res) => {
  const { userId, feedback, email, timestamp } = req.body;
  console.log(`📝 Feedback from user ${userId}: ${feedback}`);
  res.json({ success: true, message: 'Feedback received' });
});

// ============================================================
// ✅ START SERVER
// ============================================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`👥 Users: ${data.users.length}`);
  console.log(`📝 Posts: ${data.posts.length}`);
  console.log(`📢 Notifications: ${data.notifications.length}`);
  console.log(`💰 Company fees: ₵${data.companyAccount.totalFees}`);
  console.log(`📊 Banners: ${data.banners.length}`);
  console.log(`📡 Live Streams: ${data.liveStreams?.length || 0}`);
  console.log(`📅 Calendar events: ${Object.keys(data.calendarEvents || {}).length} users have events`);
  console.log('✅ All endpoints loaded successfully!');
});

// ============================================================
// ✅ STORIES ENDPOINTS
// ============================================================
app.get('/api/stories', (req, res) => {
  const stories = data.stories || [];
  res.json({ success: true, stories });
});

app.post('/api/stories', verifyToken, (req, res) => {
  const { contentUrl, isVideo, caption, privacy } = req.body;
  const user = data.users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const newStory = {
    id: Date.now().toString(),
    userId: user.id.toString(),
    userName: user.name,
    userAvatar: user.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
    contentUrl, 
    isVideo: isVideo || false, 
    caption: caption || '', 
    privacy: privacy || 'friends',
    likes: 0, 
    viewers: 0, 
    createdAt: new Date().toISOString(), 
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };
  
  if (!data.stories) data.stories = [];
  data.stories.unshift(newStory);
  saveData();
  res.status(201).json({ success: true, story: newStory });
});

app.post('/api/stories/seen', verifyToken, (req, res) => {
  const { storyId } = req.body;
  const userId = req.userId;
  if (!data.seenStories) data.seenStories = [];
  const existing = data.seenStories.find(s => s.storyId === storyId && s.userId === userId);
  if (!existing) {
    data.seenStories.push({ storyId, userId, seenAt: new Date().toISOString() });
    const story = (data.stories || []).find(s => s.id === storyId);
    if (story) story.viewers = (story.viewers || 0) + 1;
    saveData();
  }
  res.json({ success: true });
});

app.get('/api/stories/seen/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  if (!data.seenStories) data.seenStories = [];
  const seenStoryIds = data.seenStories.filter(s => s.userId === userId).map(s => s.storyId);
  res.json({ success: true, seenStoryIds });
});

app.post('/api/stories/:id/like', verifyToken, (req, res) => {
  const { id } = req.params;
  const story = (data.stories || []).find(s => s.id === id);
  if (!story) return res.status(404).json({ error: 'Story not found' });
  story.likes = (story.likes || 0) + 1;
  saveData();
  res.json({ success: true, likes: story.likes });
});

app.delete('/api/stories/:id/like', verifyToken, (req, res) => {
  const { id } = req.params;
  const story = (data.stories || []).find(s => s.id === id);
  if (!story) return res.status(404).json({ error: 'Story not found' });
  story.likes = Math.max(0, (story.likes || 0) - 1);
  saveData();
  res.json({ success: true, likes: story.likes });
});

app.delete('/api/stories/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.userId;
  const storyIndex = (data.stories || []).findIndex(s => s.id === id);
  if (storyIndex === -1) return res.status(404).json({ error: 'Story not found' });
  const story = data.stories[storyIndex];
  if (parseInt(story.userId) !== userId) return res.status(403).json({ error: 'Not your story' });
  data.stories.splice(storyIndex, 1);
  saveData();
  res.json({ success: true });
});

console.log('✅ Stories endpoints added');

// ============================================================
// ✅ CALENDAR EVENTS ENDPOINTS
// ============================================================
app.get('/api/calendar/events/me', verifyToken, (req, res) => {
  const userId = req.userId;
  if (!data.calendarEvents) data.calendarEvents = {};
  if (!data.calendarEvents[userId]) data.calendarEvents[userId] = [];
  res.json({ success: true, events: data.calendarEvents[userId] });
});

app.post('/api/calendar/events', verifyToken, (req, res) => {
  const userId = req.userId;
  const { title, date, type, celebrantName, celebrantId, reminderSet } = req.body;
  if (!title || !date) {
    return res.status(400).json({ error: 'Title and date are required' });
  }
  if (!data.calendarEvents) data.calendarEvents = {};
  if (!data.calendarEvents[userId]) data.calendarEvents[userId] = [];
  
  const newEvent = {
    id: Date.now().toString(),
    title,
    date,
    type: type || 'birthday',
    celebrantName: celebrantName || '',
    celebrantId: celebrantId || '',
    reminderSet: reminderSet || false,
    createdAt: new Date().toISOString()
  };
  
  data.calendarEvents[userId].push(newEvent);
  saveData();
  res.status(201).json({ success: true, events: data.calendarEvents[userId] });
});

app.put('/api/calendar/events/:id', verifyToken, (req, res) => {
  const userId = req.userId;
  const { id } = req.params;
  const { title, date, type, celebrantName, celebrantId, reminderSet } = req.body;
  
  if (!data.calendarEvents) data.calendarEvents = {};
  if (!data.calendarEvents[userId]) data.calendarEvents[userId] = [];
  
  const index = data.calendarEvents[userId].findIndex(e => e.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Event not found' });
  }
  
  data.calendarEvents[userId][index] = {
    ...data.calendarEvents[userId][index],
    title: title || data.calendarEvents[userId][index].title,
    date: date || data.calendarEvents[userId][index].date,
    type: type || data.calendarEvents[userId][index].type,
    celebrantName: celebrantName !== undefined ? celebrantName : data.calendarEvents[userId][index].celebrantName,
    celebrantId: celebrantId !== undefined ? celebrantId : data.calendarEvents[userId][index].celebrantId,
    reminderSet: reminderSet !== undefined ? reminderSet : data.calendarEvents[userId][index].reminderSet,
  };
  saveData();
  res.json({ success: true, events: data.calendarEvents[userId] });
});

app.delete('/api/calendar/events/:id', verifyToken, (req, res) => {
  const userId = req.userId;
  const { id } = req.params;
  
  if (!data.calendarEvents) data.calendarEvents = {};
  if (!data.calendarEvents[userId]) data.calendarEvents[userId] = [];
  
  const index = data.calendarEvents[userId].findIndex(e => e.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Event not found' });
  }
  
  data.calendarEvents[userId].splice(index, 1);
  saveData();
  res.json({ success: true, events: data.calendarEvents[userId] });
});

app.put('/api/calendar/events/:id/reminder', verifyToken, (req, res) => {
  const userId = req.userId;
  const { id } = req.params;
  
  if (!data.calendarEvents) data.calendarEvents = {};
  if (!data.calendarEvents[userId]) data.calendarEvents[userId] = [];
  
  const index = data.calendarEvents[userId].findIndex(e => e.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Event not found' });
  }
  
  data.calendarEvents[userId][index].reminderSet = !data.calendarEvents[userId][index].reminderSet;
  saveData();
  res.json({ success: true, events: data.calendarEvents[userId] });
});

// ============================================================
// ✅ BLOCKED USERS ENDPOINTS
// ============================================================
app.get('/api/user/blocked/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  if (!data.blockedUsers) data.blockedUsers = {};
  if (!data.blockedUsers[userId]) data.blockedUsers[userId] = [];
  const blockedUserIds = data.blockedUsers[userId] || [];
  const blockedUsers = data.users.filter(u => blockedUserIds.includes(u.id)).map(u => ({
    id: u.id, name: u.name, username: u.username, profileImage: u.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
    reason: 'Blocked by user', blockedAt: new Date().toISOString()
  }));
  res.json({ blockedUsers });
});

app.post('/api/user/block/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const { blockUserId } = req.body;
  if (!data.blockedUsers) data.blockedUsers = {};
  if (!data.blockedUsers[userId]) data.blockedUsers[userId] = [];
  if (!data.blockedUsers[userId].includes(blockUserId)) {
    data.blockedUsers[userId].push(blockUserId);
    saveData();
  }
  res.json({ success: true, blockedUsers: data.blockedUsers[userId] });
});

app.delete('/api/user/unblock/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const { blockUserId } = req.body;
  if (data.blockedUsers && data.blockedUsers[userId]) {
    data.blockedUsers[userId] = data.blockedUsers[userId].filter(id => id !== blockUserId);
    saveData();
  }
  res.json({ success: true, blockedUsers: data.blockedUsers[userId] || [] });
});

// ============================================================
// ✅ USER SETTINGS ENDPOINTS
// ============================================================
app.get('/api/user/settings/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  if (!data.userSettings) data.userSettings = {};
  if (!data.userSettings[userId]) {
    data.userSettings[userId] = {
      theme: { darkMode: false, primaryColor: '#6366f1' },
      privacy: { birthdayVisibility: 'friends', postVisibility: 'friends', allowWishes: 'everyone', allowTagging: 'friends' },
      notifications: { enabled: true, birthdayReminders: true, friendRequests: true, giftNotifications: true, commentNotifications: true }
    };
    saveData();
  }
  res.json(data.userSettings[userId]);
});

app.put('/api/user/settings/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const { theme, privacy, notifications } = req.body;
  if (!data.userSettings) data.userSettings = {};
  if (!data.userSettings[userId]) {
    data.userSettings[userId] = {
      theme: { darkMode: false, primaryColor: '#6366f1' },
      privacy: { birthdayVisibility: 'friends', postVisibility: 'friends', allowWishes: 'everyone', allowTagging: 'friends' },
      notifications: { enabled: true, birthdayReminders: true, friendRequests: true, giftNotifications: true, commentNotifications: true }
    };
  }
  if (theme) data.userSettings[userId].theme = { ...data.userSettings[userId].theme, ...theme };
  if (privacy) data.userSettings[userId].privacy = { ...data.userSettings[userId].privacy, ...privacy };
  if (notifications) data.userSettings[userId].notifications = { ...data.userSettings[userId].notifications, ...notifications };
  saveData();
  res.json({ success: true, settings: data.userSettings[userId] });
});

app.get('/api/user/settings/:userId/theme', (req, res) => {
  const userId = parseInt(req.params.userId);
  if (!data.userSettings || !data.userSettings[userId]) {
    return res.json({ darkMode: false, primaryColor: '#6366f1' });
  }
  res.json(data.userSettings[userId].theme || { darkMode: false, primaryColor: '#6366f1' });
});

app.put('/api/user/settings/:userId/theme', (req, res) => {
  const userId = parseInt(req.params.userId);
  const { darkMode, primaryColor } = req.body;
  if (!data.userSettings) data.userSettings = {};
  if (!data.userSettings[userId]) {
    data.userSettings[userId] = {
      theme: { darkMode: false, primaryColor: '#6366f1' },
      privacy: { birthdayVisibility: 'friends', postVisibility: 'friends', allowWishes: 'everyone', allowTagging: 'friends' },
      notifications: { enabled: true, birthdayReminders: true, friendRequests: true, giftNotifications: true, commentNotifications: true }
    };
  }
  if (darkMode !== undefined) data.userSettings[userId].theme.darkMode = darkMode;
  if (primaryColor) data.userSettings[userId].theme.primaryColor = primaryColor;
  saveData();
  res.json({ success: true, theme: data.userSettings[userId].theme });
});

// ============================================================
// ✅ GROUP GIFTS ENDPOINTS
// ============================================================
app.get('/api/group-gifts', (req, res) => {
  res.json(data.groupGifts || []);
});

app.post('/api/group-gifts', verifyToken, (req, res) => {
  const { giftName, celebrantName, targetAmount, deadline, imageUrl } = req.body;
  const newGroupGift = {
    id: Date.now().toString(),
    giftName,
    celebrantName,
    celebrantId: `celebrant_${Date.now()}`,
    targetAmount: parseFloat(targetAmount),
    currentAmount: 0,
    contributorsCount: 0,
    deadline: deadline || "No deadline",
    imageUrl: imageUrl || "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=300&h=300&fit=crop",
    status: 'active',
    contributors: [],
    createdAt: new Date().toISOString()
  };
  if (!data.groupGifts) data.groupGifts = [];
  data.groupGifts.unshift(newGroupGift);
  saveData();
  res.status(201).json(newGroupGift);
});

app.post('/api/group-gifts/:id/contribute', verifyToken, (req, res) => {
  const { id } = req.params;
  const { amount, userName } = req.body;
  const gift = data.groupGifts.find(g => g.id === id);
  if (!gift) return res.status(404).json({ error: "Group gift not found" });
  if (gift.status !== 'active') return res.status(400).json({ error: "Group gift not active" });
  
  const contributionAmount = parseFloat(amount);
  const newTotal = gift.currentAmount + contributionAmount;
  if (newTotal > gift.targetAmount) return res.status(400).json({ error: "Contribution exceeds target" });
  
  gift.contributors.push({ userId: req.userId, userName: userName || "Anonymous", amount: contributionAmount, date: new Date().toISOString() });
  gift.contributorsCount += 1;
  gift.currentAmount = newTotal;
  if (gift.currentAmount >= gift.targetAmount) {
    gift.status = 'completed';
    gift.completedAt = new Date().toISOString();
  }
  saveData();
  res.json({ success: true, isComplete: gift.status === 'completed', currentAmount: gift.currentAmount, targetAmount: gift.targetAmount });
});

// ============================================================
// ✅ LIVE STREAMS ENDPOINTS
// ============================================================
app.get('/api/live/streams', (req, res) => {
  const liveStreams = data.liveStreams || [];
  const activeStreams = liveStreams.filter(s => s.isLive === true);
  res.json({ success: true, streams: activeStreams });
});

app.post('/api/live/streams', verifyToken, (req, res) => {
  const { title, privacy } = req.body;
  const user = data.users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const newStream = {
    id: Date.now().toString(),
    userId: user.id,
    userName: user.name,
    userHandle: user.username,
    userAvatar: user.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
    title: title || `${user.name}'s Live Stream`,
    thumbnail: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&h=300&fit=crop',
    viewerCount: 0,
    startedAt: new Date().toISOString(),
    isLive: true,
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    category: 'General',
    privacy: privacy || 'everyone',
    isBirthday: false,
    celebrantName: user.name,
  };

  if (!data.liveStreams) data.liveStreams = [];
  data.liveStreams.push(newStream);
  saveData();
  res.status(201).json({ success: true, stream: newStream });
});

app.put('/api/live/streams/:id/end', verifyToken, (req, res) => {
  const { id } = req.params;
  const stream = (data.liveStreams || []).find(s => s.id === id);
  if (!stream) return res.status(404).json({ error: 'Stream not found' });
  if (stream.userId !== req.userId) return res.status(403).json({ error: 'Not your stream' });
  
  stream.isLive = false;
  stream.endedAt = new Date().toISOString();
  saveData();
  res.json({ success: true });
});

app.post('/api/live/streams/:id/view', (req, res) => {
  const { id } = req.params;
  const stream = (data.liveStreams || []).find(s => s.id === id);
  if (!stream) return res.status(404).json({ error: 'Stream not found' });
  
  stream.viewerCount = (stream.viewerCount || 0) + 1;
  saveData();
  res.json({ success: true, viewerCount: stream.viewerCount });
});

// ============================================================
// ✅ FRIENDS BIRTHDAYS ENDPOINT
// ============================================================
app.get('/api/friends/birthdays', verifyToken, (req, res) => {
  const userId = req.userId;
  const friendships = data.friendships.filter(f => f.userId === userId);
  const friends = friendships.map(f => {
    const friend = data.users.find(u => u.id === f.friendId);
    return friend;
  }).filter(Boolean);
  
  const friendsBirthdays = friends.map(f => ({
    id: f.id,
    name: f.name,
    username: f.username,
    avatar: f.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
    birthDate: f.birthDate,
    phone: f.phone || '',
    network: f.network || 'MTN'
  }));
  
  res.json({ friendsBirthdays });
});

console.log('✅ ALL endpoints added successfully!');

// ============================================================
// ✅ FRIENDS BIRTHDAYS ENDPOINT
// ============================================================
app.get('/api/friends/birthdays', verifyToken, (req, res) => {
  const userId = req.userId;
  console.log(`🎂 Getting friends birthdays for user: ${userId}`);
  
  // Get all friendships for this user
  const friendships = data.friendships.filter(f => f.userId === userId);
  console.log(`👥 Found ${friendships.length} friendships`);
  
  // Get friend details
  const friends = friendships
    .map(f => {
      const friend = data.users.find(u => u.id === f.friendId);
      return friend;
    })
    .filter(Boolean);
  
  console.log(`👤 Found ${friends.length} friends`);
  
  // Format friends with birthday info
  const friendsBirthdays = friends.map(f => ({
    id: f.id,
    name: f.name,
    username: f.username,
    avatar: f.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
    birthDate: f.birthDate,
    phone: f.phone || '',
    network: f.network || 'MTN'
  }));
  
  console.log(`✅ Returning ${friendsBirthdays.length} friends birthdays`);
  res.json({ friendsBirthdays });
});

// ============================================================
// ✅ ADMIN STATS ENDPOINT (for analytics)
// ============================================================
app.get('/api/admin/stats', (req, res) => {
  res.json({
    userCount: data.users.length,
    postCount: data.posts.length,
    giftCount: data.giftTransactions.length,
    wishCount: data.notifications.filter(n => n.type === 'wish').length,
    activeUsers: data.users.filter(u => {
      const recent = new Date();
      recent.setDate(recent.getDate() - 7);
      return new Date(u.created_at) > recent;
    }).length,
    newUsersToday: data.users.filter(u => {
      const today = new Date().toDateString();
      return new Date(u.created_at).toDateString() === today;
    }).length,
    totalRevenue: data.companyAccount.totalFees || 0,
    totalFees: data.companyFees.reduce((sum, f) => sum + f.amount, 0) || 0
  });
});

// ============================================================
// ✅ USER ACTIVITY ENDPOINT
// ============================================================
app.get('/api/user/activity/:userId', verifyToken, (req, res) => {
  const userId = parseInt(req.params.userId);
  const userPosts = data.posts.filter(p => p.userId === userId);
  const userGifts = data.giftTransactions.filter(g => g.recipientId === userId || g.buyerId === userId);
  const userNotifications = data.notifications.filter(n => n.userId === userId);
  
  res.json({
    userId,
    posts: userPosts.length,
    gifts: userGifts.length,
    notifications: userNotifications.length,
    lastActive: userNotifications[0]?.createdAt || new Date().toISOString()
  });
});

// ============================================================
// ✅ VIDEO POSITIONS ENDPOINTS
// ============================================================
app.post('/api/video/position', verifyToken, (req, res) => {
  const { postId, position } = req.body;
  const userId = req.userId;
  
  if (!data.videoPositions) data.videoPositions = [];
  const existing = data.videoPositions.find(v => v.userId === userId && v.postId === postId);
  if (existing) {
    existing.position = position;
    existing.updatedAt = new Date().toISOString();
  } else {
    data.videoPositions.push({ userId, postId, position, updatedAt: new Date().toISOString() });
  }
  saveData();
  res.json({ success: true });
});

app.get('/api/video/position/:postId', verifyToken, (req, res) => {
  const { postId } = req.params;
  const userId = req.userId;
  
  if (!data.videoPositions) data.videoPositions = [];
  const existing = data.videoPositions.find(v => v.userId === userId && v.postId === postId);
  res.json({ position: existing?.position || 0 });
});

// ============================================================
// ✅ REMINDERS ENDPOINTS
// ============================================================
app.get('/api/reminders', verifyToken, (req, res) => {
  const userId = req.userId;
  const reminders = data.reminders ? data.reminders.filter(r => r.userId === userId) : [];
  res.json({ reminders });
});

app.post('/api/reminders', verifyToken, (req, res) => {
  const userId = req.userId;
  const { title, date, type } = req.body;
  
  const newReminder = {
    id: Date.now().toString(),
    userId,
    title,
    date,
    type: type || 'birthday',
    createdAt: new Date().toISOString()
  };
  
  if (!data.reminders) data.reminders = [];
  data.reminders.push(newReminder);
  saveData();
  res.status(201).json({ success: true, reminder: newReminder });
});

app.delete('/api/reminders/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.userId;
  
  if (!data.reminders) data.reminders = [];
  data.reminders = data.reminders.filter(r => r.id !== id || r.userId !== userId);
  saveData();
  res.json({ success: true });
});

console.log('✅ ALL remaining endpoints added!');

// ============================================================
// ✅ PASSWORD RESET ENDPOINTS
// ============================================================

// ✅ Store reset tokens temporarily
const resetTokens = {};

// ✅ Generate reset token (simple for now - use crypto in production)
const generateResetToken = () => {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
};

// ✅ FORGOT PASSWORD - Send reset link
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  console.log(`🔑 Forgot password request for: ${email}`);
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  
  const normalizedEmail = email.toLowerCase().trim();
  const user = data.users.find(u => u.email === normalizedEmail);
  
  // ✅ For security, don't reveal if user exists or not
  if (!user) {
    console.log(`⚠️ User not found: ${normalizedEmail}`);
    // Still return success to prevent email enumeration
    return res.json({ 
      success: true, 
      message: 'If an account exists, a reset link has been sent.' 
    });
  }
  
  try {
    // ✅ Generate reset token
    const resetToken = generateResetToken();
    const expiresAt = Date.now() + 3600000; // 1 hour expiry
    
    // ✅ Store token
    resetTokens[resetToken] = {
      userId: user.id,
      email: normalizedEmail,
      expiresAt: expiresAt
    };
    
    console.log(`✅ Reset token generated for ${user.email}: ${resetToken}`);
    console.log(`📝 Token expires at: ${new Date(expiresAt).toISOString()}`);
    
    // ✅ In production, send email with reset link
    // For now, return the token in response (for testing)
    const resetLink = `https://birthdayapp.com/reset-password?token=${resetToken}`;
    
    // ✅ Log the reset link (for development)
    console.log(`🔗 Reset link: ${resetLink}`);
    
    // ✅ Store reset notification
    addNotification(
      user.id,
      'system',
      '🔑 Password Reset',
      'You requested a password reset. Click the link in your email.',
      null,
      null,
      null,
      { resetToken, expiresAt }
    );
    
    res.json({ 
      success: true, 
      message: 'Password reset link has been sent to your email.',
      // ✅ Only include token in development
      ...(process.env.NODE_ENV === 'development' && { resetToken, resetLink })
    });
    
  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// ✅ RESET PASSWORD - Verify token and update password
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  console.log(`🔑 Reset password request with token: ${token}`);
  
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }
  
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  
  // ✅ Find token
  const resetData = resetTokens[token];
  
  if (!resetData) {
    console.log(`❌ Invalid or expired token: ${token}`);
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }
  
  // ✅ Check if token is expired
  if (Date.now() > resetData.expiresAt) {
    console.log(`❌ Token expired: ${token}`);
    delete resetTokens[token];
    return res.status(400).json({ error: 'Reset token has expired' });
  }
  
  try {
    // ✅ Find user
    const userId = resetData.userId;
    const userIndex = data.users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      console.log(`❌ User not found for token: ${token}`);
      delete resetTokens[token];
      return res.status(404).json({ error: 'User not found' });
    }
    
    // ✅ Update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    data.users[userIndex].password_hash = hashedPassword;
    
    // ✅ Remove used token
    delete resetTokens[token];
    
    saveData();
    console.log(`✅ Password reset successful for user: ${data.users[userIndex].email}`);
    
    // ✅ Send notification
    addNotification(
      userId,
      'system',
      '✅ Password Reset Complete',
      'Your password has been successfully changed.',
      null,
      null,
      null,
      { timestamp: new Date().toISOString() }
    );
    
    res.json({ 
      success: true, 
      message: 'Password has been reset successfully. You can now login with your new password.' 
    });
    
  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ✅ VERIFY RESET TOKEN - Check if token is valid
app.post('/api/auth/verify-reset-token', (req, res) => {
  const { token } = req.body;
  console.log(`🔑 Verifying reset token: ${token}`);
  
  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }
  
  const resetData = resetTokens[token];
  
  if (!resetData) {
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }
  
  if (Date.now() > resetData.expiresAt) {
    delete resetTokens[token];
    return res.status(400).json({ error: 'Reset token has expired' });
  }
  
  res.json({ 
    valid: true, 
    email: resetData.email,
    userId: resetData.userId
  });
});

console.log('✅ Password reset endpoints added');

// ============================================================
// ✅ GET ALL USERS ENDPOINT
// ============================================================
app.get('/api/users', (req, res) => {
  console.log('👥 Getting all users...');
  
  // ✅ Return all users (excluding sensitive data)
  const allUsers = data.users.map(user => ({
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    profileImage: user.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
    bio: user.bio || '',
    location: user.location || '',
    phone: user.phone || '',
    network: user.network || 'MTN',
    birthDate: user.birthDate || null,
    createdAt: user.created_at
  }));
  
  console.log(`✅ Returning ${allUsers.length} users`);
  res.json(allUsers);
});
