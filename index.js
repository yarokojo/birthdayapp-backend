const express = require("express");
const cors = require("cors");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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
  console.log("Starting fresh");
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ============ VIDEO UPLOAD ============
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }
});

app.use('/uploads', express.static('uploads'));

app.post('/api/upload/video', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file' });
  }
  const videoUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ success: true, videoUrl });
});

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

const recordTransaction = (userId, type, amount, description, referenceId = null) => {
  if (!data.wallets[userId]) data.wallets[userId] = { balance: 0, transactions: [] };
  data.wallets[userId].transactions.unshift({
    id: Date.now().toString(),
    type,
    amount,
    description,
    referenceId,
    date: new Date().toISOString()
  });
  saveData();
};

// ✅ NOTIFICATION HELPER
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

// ============================================================
// ✅ JWT VERIFICATION MIDDLEWARE
// ============================================================
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

// ============================================================
// ✅ ROOT ENDPOINT
// ============================================================
app.get("/", (req, res) => {
  res.json({ message: "BirthdayApp API is running!" });
});

// ============ AUTH ENDPOINTS ============
app.post("/api/auth/register", (req, res) => {
  const { email, password, name, username, birthDate } = req.body;
  const normalizedEmail = email.toLowerCase();
  if (data.users.find(u => u.email === normalizedEmail)) {
    return res.status(400).json({ error: "User already exists" });
  }
  if (!birthDate) {
    return res.status(400).json({ error: 'Birth date is required' });
  }
  const newUser = { 
    id: data.users.length + 1, 
    email: normalizedEmail, 
    name, 
    username,
    birthDate: birthDate || null,
    phone: req.body.phone || '',
    network: req.body.network || '',
    created_at: new Date().toISOString() 
  };
  data.users.push(newUser);
  
  data.wallets[newUser.id] = { balance: 0, transactions: [] };
  saveData();
  
  const token = jwt.sign(
    { userId: newUser.id, email: newUser.email },
    process.env.JWT_SECRET || 'your_jwt_secret_key',
    { expiresIn: '7d' }
  );
  
  res.json({ token, user: { id: newUser.id, email: newUser.email, name, username, birthDate: newUser.birthDate } });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = email.toLowerCase();
  const user = data.users.find(u => u.email === normalizedEmail);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET || 'your_jwt_secret_key',
    { expiresIn: '7d' }
  );
  
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, username: user.username, birthDate: user.birthDate } });
});

// ============ CHANGE PASSWORD ============
app.post('/api/auth/change-password', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { currentPassword, newPassword } = req.body;
    
    console.log(`🔑 Password change request for user ${userId}`);
    
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
    
    const bcrypt = require('bcryptjs');
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    console.log(`🔍 Password comparison result: ${isValid}`);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password_hash = hashedPassword;
    saveData();
    
    console.log(`✅ Password changed for user ${userId}`);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('❌ Password change error:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
});

// ============================================================
// ✅ GET /api/users/profile
// ============================================================
app.get('/api/users/profile', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
    const user = data.users.find(u => u.id === decoded.userId);
    
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
      createdAt: user.created_at
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ============================================================
// ✅ PUT /api/users/profile - UPDATE PROFILE
// ============================================================
app.put('/api/users/profile', (req, res) => {
  console.log('📝 PUT /api/users/profile');
  console.log('📝 Request body:', req.body);
  
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    console.log('❌ No token provided');
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
    console.log('👤 User ID from token:', decoded.userId);
    
    const userIndex = data.users.findIndex(u => u.id === decoded.userId);
    
    if (userIndex === -1) {
      console.log('❌ User not found:', decoded.userId);
      return res.status(404).json({ error: 'User not found' });
    }
    
    const { name, bio, location, username, profileImage, phone, network, birthDate } = req.body;
    
    console.log('📝 Updating user:', { id: decoded.userId, name, phone, network });
    
    if (name !== undefined) data.users[userIndex].name = name;
    if (bio !== undefined) data.users[userIndex].bio = bio;
    if (location !== undefined) data.users[userIndex].location = location;
    if (username !== undefined) data.users[userIndex].username = username;
    if (profileImage !== undefined) data.users[userIndex].profileImage = profileImage;
    if (phone !== undefined) data.users[userIndex].phone = phone;
    if (network !== undefined) data.users[userIndex].network = network;
    if (birthDate !== undefined) data.users[userIndex].birthDate = birthDate;
    
    saveData();
    
    console.log('✅ Profile updated for user:', data.users[userIndex].id);
    
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
  } catch (err) {
    console.error('❌ Profile update error:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ============ FRIENDS LIST - WITH PHONE NUMBER ============
app.get('/api/friends/list/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  console.log(`👥 GET /api/friends/list/${userId}`);
  
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
  
  console.log(`  ✅ Found ${friends.length} friends with phone numbers`);
  res.json({ friends });
});

// ============ WALLET ENDPOINTS ============
app.get('/api/wallet/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const wallet = data.wallets[userId];
  
  if (!wallet) {
    data.wallets[userId] = { balance: 0, transactions: [] };
    saveData();
    return res.json({ balance: 0, transactions: [] });
  }
  
  res.json({
    balance: wallet.balance || 0,
    transactions: wallet.transactions || []
  });
});

app.get('/api/wallet/balance/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const balance = getWalletBalance(userId);
  res.json({ balance, currency: 'GHS' });
});

app.post('/api/wallet/add-funds', (req, res) => {
  const { userId, amount, description, referenceId } = req.body;
  const userIdNum = parseInt(userId);
  
  if (!userId || !amount) {
    return res.status(400).json({ error: 'userId and amount required' });
  }
  
  if (!data.wallets[userIdNum]) {
    data.wallets[userIdNum] = { balance: 0, transactions: [] };
  }
  
  const newBalance = data.wallets[userIdNum].balance + parseFloat(amount);
  data.wallets[userIdNum].balance = newBalance;
  data.wallets[userIdNum].transactions.unshift({
    id: Date.now().toString(),
    type: 'credit',
    amount: parseFloat(amount),
    description: description || 'Funds added',
    referenceId: referenceId || null,
    date: new Date().toISOString()
  });
  saveData();
  
  console.log(`💰 Added ₵${amount} to wallet for user ${userId}`);
  res.json({ success: true, newBalance });
});

app.post('/api/wallet/deduct-funds', (req, res) => {
  const { userId, amount, description } = req.body;
  const userIdNum = parseInt(userId);
  
  if (!userId || !amount) {
    return res.status(400).json({ error: 'userId and amount required' });
  }
  
  if (!data.wallets[userIdNum]) {
    data.wallets[userIdNum] = { balance: 0, transactions: [] };
  }
  
  if (data.wallets[userIdNum].balance < parseFloat(amount)) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }
  
  const newBalance = data.wallets[userIdNum].balance - parseFloat(amount);
  data.wallets[userIdNum].balance = newBalance;
  data.wallets[userIdNum].transactions.unshift({
    id: Date.now().toString(),
    type: 'debit',
    amount: parseFloat(amount),
    description: description || 'Funds deducted',
    date: new Date().toISOString()
  });
  saveData();
  
  console.log(`💰 Deducted ₵${amount} from wallet for user ${userId}`);
  res.json({ success: true, newBalance });
});

app.post('/api/wallet/withdraw', (req, res) => {
  const { userId, amount, network, phoneNumber } = req.body;
  const userIdNum = parseInt(userId);
  
  if (!userId || !amount || !network || !phoneNumber) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const amountNum = parseFloat(amount);
  const fee = amountNum * 0.01;
  const totalDeduction = amountNum + fee;
  
  if (!data.wallets[userIdNum]) {
    return res.status(400).json({ error: 'Wallet not found' });
  }
  
  if (data.wallets[userIdNum].balance < totalDeduction) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }
  
  data.wallets[userIdNum].balance -= totalDeduction;
  data.wallets[userIdNum].transactions.unshift({
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
    fromUserId: userIdNum,
    withdrawalAmount: amountNum,
    date: new Date().toISOString()
  });
  data.companyAccount.totalFees += fee;
  saveData();
  
  console.log(`💰 Withdrawal: ₵${amount} to ${network} • ${phoneNumber}, Fee: ₵${fee}`);
  res.json({
    success: true,
    amount: amountNum,
    fee: fee,
    userReceives: amountNum - fee,
    newBalance: data.wallets[userIdNum].balance
  });
});

app.get('/api/wallet/transactions/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const wallet = data.wallets[userId];
  
  if (!wallet) {
    return res.json({ transactions: [] });
  }
  
  res.json({ transactions: wallet.transactions || [] });
});

// ============ POST ENDPOINTS ============
app.get("/api/posts", (req, res) => {
  const allPosts = data.posts || [];
  
  const enrichedPosts = allPosts.map(post => {
    const author = data.users.find(u => u.id === post.userId);
    return {
      ...post,
      phone: author?.phone || '',
      network: author?.network || 'MTN',
    };
  });
  
  res.json(enrichedPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post("/api/posts", (req, res) => {
  const { content, image, video, location, celebrationType, celebrantName, isBirthday, music, hashtags } = req.body;
  
  console.log('📝 POST /api/posts');
  console.log('  Location received:', location || 'None');
  console.log('  Celebration Type:', celebrationType || 'None');
  console.log('  Celebrant Name:', celebrantName || 'None');
  
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
    const user = data.users.find(u => u.id === decoded.userId);
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
    
    console.log(`  ✅ Post created by ${user.name}: ${newPost.id}`);
    console.log(`  📍 Location saved: ${newPost.location || 'None'}`);
    res.status(201).json(newPost);
  } catch (err) {
    console.error('  ❌ JWT verification error:', err.message);
    return res.status(401).json({ error: 'Invalid token: ' + err.message });
  }
});

app.delete("/api/posts/:id", (req, res) => {
  const { id } = req.params;
  const index = (data.posts || []).findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ error: "Post not found" });
  data.posts.splice(index, 1);
  saveData();
  res.json({ success: true });
});

// ============ LIKE ENDPOINTS ============
app.post("/api/posts/:id/like", (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
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

app.delete("/api/posts/:id/like", (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
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

// ============ COMMENT ENDPOINTS ============
app.post("/api/posts/:id/comments", (req, res) => {
  const { id } = req.params;
  const { userId, text, userName, userAvatar } = req.body;
  const post = (data.posts || []).find(p => p.id === id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  
  const newComment = {
    id: Date.now().toString(),
    userId,
    userName: userName || 'Anonymous',
    userAvatar: userAvatar || 'https://randomuser.me/api/portraits/men/1.jpg',
    text,
    createdAt: new Date().toISOString(),
    likes: 0
  };
  if (!post.commentList) post.commentList = [];
  post.commentList.push(newComment);
  post.comments = (post.comments || 0) + 1;
  saveData();
  
  if (post.userId !== userId) {
    const user = data.users.find(u => u.id === userId);
    addNotification(post.userId, 'comment', '💬 New Comment', `${user?.name || 'Someone'} commented on your post`);
  }
  res.status(201).json(newComment);
});

app.delete("/api/posts/:postId/comments/:commentId", (req, res) => {
  const { postId, commentId } = req.params;
  const post = (data.posts || []).find(p => p.id === postId);
  if (!post) return res.status(404).json({ error: "Post not found" });
  
  const index = post.commentList?.findIndex(c => c.id === commentId);
  if (index === -1) return res.status(404).json({ error: "Comment not found" });
  post.commentList.splice(index, 1);
  post.comments = Math.max(0, (post.comments || 0) - 1);
  saveData();
  res.json({ success: true });
});

// ============ BOOKMARK ENDPOINTS ============
app.post("/api/posts/:id/bookmark", (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  if (!data.bookmarks) data.bookmarks = [];
  const existing = data.bookmarks.find(b => b.postId === id && b.userId === userId);
  if (!existing) {
    data.bookmarks.push({ postId: id, userId, createdAt: new Date().toISOString() });
    saveData();
  }
  res.json({ success: true });
});

app.delete("/api/posts/:id/bookmark", (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  if (data.bookmarks) {
    const index = data.bookmarks.findIndex(b => b.postId === id && b.userId === userId);
    if (index !== -1) {
      data.bookmarks.splice(index, 1);
      saveData();
    }
  }
  res.json({ success: true });
});

// ============ NOTIFICATION ENDPOINTS ============
app.get("/api/notifications/:userId", (req, res) => {
  const userId = parseInt(req.params.userId);
  const userNotifications = data.notifications.filter(n => n.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const unreadCount = userNotifications.filter(n => !n.isRead).length;
  res.json({ notifications: userNotifications, unreadCount });
});

app.post("/api/notifications", (req, res) => {
  const { userId, type, title, message, imageUrl, targetId, targetName, extraData } = req.body;
  if (!userId || !type || !message) return res.status(400).json({ error: "Missing required fields" });
  const newNotification = addNotification(userId, type, title, message, imageUrl, targetId, targetName, extraData);
  res.status(201).json(newNotification);
});

app.put("/api/notifications/:id/read", (req, res) => {
  const { id } = req.params;
  const notification = data.notifications.find(n => n.id === id);
  if (!notification) return res.status(404).json({ error: "Notification not found" });
  notification.isRead = true;
  saveData();
  res.json({ success: true });
});

app.put("/api/notifications/read-all/:userId", (req, res) => {
  const userId = parseInt(req.params.userId);
  data.notifications.filter(n => n.userId === userId && !n.isRead).forEach(n => n.isRead = true);
  saveData();
  res.json({ success: true });
});

app.delete("/api/notifications/:id", (req, res) => {
  const { id } = req.params;
  const index = data.notifications.findIndex(n => n.id === id);
  if (index === -1) return res.status(404).json({ error: "Notification not found" });
  data.notifications.splice(index, 1);
  saveData();
  res.json({ success: true });
});

// ============ FRIENDS ENDPOINTS ============
app.get('/api/friends/requests', (req, res) => {
  console.log('📨 GET /api/friends/requests');
  
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
    const userId = decoded.userId;
    
    const pending = data.friendRequests.filter(r => r.toUserId === userId && r.status === 'pending');
    const withDetails = pending.map(req => {
      const fromUser = data.users.find(u => u.id === req.fromUserId);
      return { 
        ...req, 
        fromUser: fromUser ? { 
          id: fromUser.id, 
          name: fromUser.name, 
          username: fromUser.username,
          profileImage: fromUser.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg'
        } : null
      };
    });
    
    console.log(`  ✅ Found ${withDetails.length} pending requests`);
    res.json({ requests: withDetails });
  } catch (err) {
    console.error('  ❌ Auth error:', err.message);
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.post('/api/friends/request', (req, res) => {
  const { toUserId } = req.body;
  console.log(`📨 POST /api/friends/request to ${toUserId}`);
  
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
    const fromUserId = decoded.userId;
    
    if (fromUserId === toUserId) {
      return res.status(400).json({ error: 'Cannot send request to yourself' });
    }
    
    const existing = data.friendRequests.find(
      r => r.fromUserId === fromUserId && r.toUserId === toUserId && r.status === 'pending'
    );
    if (existing) {
      return res.status(400).json({ error: 'Request already sent' });
    }
    
    const newRequest = { 
      id: Date.now().toString(), 
      fromUserId: parseInt(fromUserId), 
      toUserId: parseInt(toUserId), 
      status: 'pending', 
      createdAt: new Date().toISOString() 
    };
    data.friendRequests.push(newRequest);
    saveData();
    
    const fromUser = data.users.find(u => u.id === fromUserId);
    if (fromUser) {
      addNotification(
        toUserId,
        'friend_request',
        '👋 Friend Request',
        `${fromUser.name} sent you a friend request!`,
        fromUser.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
        fromUserId,
        fromUser.name
      );
      console.log(`📨 Notification sent to user ${toUserId}: Friend request from ${fromUser.name}`);
    }
    
    console.log(`  ✅ Request sent from ${fromUserId} to ${toUserId}`);
    res.json({ success: true, request: newRequest });
  } catch (err) {
    console.error('  ❌ Auth error:', err.message);
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.post('/api/friends/accept', (req, res) => {
  const { requestId } = req.body;
  console.log(`✅ POST /api/friends/accept ${requestId}`);
  
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
    const userId = decoded.userId;
    
    const request = data.friendRequests.find(r => r.id === requestId);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    if (request.toUserId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request already processed' });
    }
    
    request.status = 'accepted';
    data.friendships.push({ 
      id: Date.now().toString(), 
      userId: request.fromUserId, 
      friendId: request.toUserId, 
      createdAt: new Date().toISOString() 
    });
    data.friendships.push({ 
      id: (Date.now() + 1).toString(), 
      userId: request.toUserId, 
      friendId: request.fromUserId, 
      createdAt: new Date().toISOString() 
    });
    saveData();
    
    const toUser = data.users.find(u => u.id === request.toUserId);
    if (toUser) {
      addNotification(
        request.fromUserId,
        'friend_accept',
        '✅ Friend Request Accepted',
        `${toUser.name} accepted your friend request!`,
        toUser.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
        request.toUserId,
        toUser.name
      );
      console.log(`📨 Notification sent to user ${request.fromUserId}: Request accepted by ${toUser.name}`);
    }
    
    console.log(`  ✅ Request ${requestId} accepted`);
    res.json({ success: true });
  } catch (err) {
    console.error('  ❌ Auth error:', err.message);
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.post('/api/friends/decline', (req, res) => {
  const { requestId } = req.body;
  console.log(`❌ POST /api/friends/decline ${requestId}`);
  
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
    const userId = decoded.userId;
    
    const request = data.friendRequests.find(r => r.id === requestId);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    if (request.toUserId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    request.status = 'declined';
    saveData();
    
    console.log(`  ✅ Request ${requestId} declined`);
    res.json({ success: true });
  } catch (err) {
    console.error('  ❌ Auth error:', err.message);
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.delete('/api/friends/:friendId', (req, res) => {
  const friendId = parseInt(req.params.friendId);
  console.log(`🗑️ DELETE /api/friends/${friendId}`);
  
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
    const userId = decoded.userId;
    
    const index1 = data.friendships.findIndex(f => f.userId === userId && f.friendId === friendId);
    const index2 = data.friendships.findIndex(f => f.userId === friendId && f.friendId === userId);
    
    if (index1 !== -1) data.friendships.splice(index1, 1);
    if (index2 !== -1) data.friendships.splice(index2, 1);
    
    saveData();
    
    console.log(`  ✅ Unfriended ${friendId}`);
    res.json({ success: true });
  } catch (err) {
    console.error('  ❌ Auth error:', err.message);
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.get('/api/friends/birthdays', (req, res) => {
  console.log('🎂 GET /api/friends/birthdays');
  
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
    const userId = decoded.userId;
    
    const friendships = data.friendships.filter(f => f.userId === userId);
    const friendIds = friendships.map(f => f.friendId);
    const friendsWithBirthdays = data.users
      .filter(u => friendIds.includes(u.id) && u.birthDate)
      .map(friend => ({
        id: friend.id,
        name: friend.name,
        username: friend.username,
        birthDate: friend.birthDate,
        avatar: friend.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg'
      }));
    
    console.log(`  ✅ Found ${friendsWithBirthdays.length} friends with birthdays`);
    res.json({ friendsBirthdays: friendsWithBirthdays });
  } catch (err) {
    console.error('  ❌ Auth error:', err.message);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ============ BIRTHDAY ENDPOINTS ============
app.get("/api/users/birthdays", (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "userId required" });
  const userIdNum = parseInt(userId);
  const user = data.users.find(u => u.id === userIdNum);
  if (!user) return res.status(404).json({ error: "User not found" });
  
  const friendships = data.friendships.filter(f => f.userId === userIdNum);
  const friendIds = friendships.map(f => f.friendId);
  const friendsWithBirthdays = data.users.filter(u => friendIds.includes(u.id) && u.birthDate).map(friend => ({
    id: friend.id, name: friend.name, username: friend.username, birthDate: friend.birthDate, avatar: friend.profileImage
  }));
  res.json({ userBirthday: user.birthDate || null, friendsBirthdays: friendsWithBirthdays });
});

app.put("/api/users/birthday", (req, res) => {
  const { userId, birthDate } = req.body;
  const user = data.users.find(u => u.id === parseInt(userId));
  if (!user) return res.status(404).json({ error: "User not found" });
  user.birthDate = birthDate || null;
  saveData();
  res.json({ success: true, birthDate: user.birthDate });
});

// ============ GROUP GIFT ENDPOINTS ============
app.get("/api/group-gifts", (req, res) => {
  res.json(data.groupGifts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post("/api/group-gifts", (req, res) => {
  const { giftName, celebrantName, targetAmount, deadline, imageUrl, createdBy } = req.body;
  const newGroupGift = {
    id: Date.now().toString(),
    giftName, celebrantName, targetAmount: parseFloat(targetAmount), currentAmount: 0, contributorsCount: 0,
    deadline: deadline || "No deadline", imageUrl: imageUrl || "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=300&h=300&fit=crop",
    status: 'active', contributors: [], createdBy: createdBy ? parseInt(createdBy) : null, createdAt: new Date().toISOString()
  };
  data.groupGifts.unshift(newGroupGift);
  saveData();
  res.status(201).json(newGroupGift);
});

app.post("/api/group-gifts/:id/contribute", (req, res) => {
  const { id } = req.params;
  const { userId, userName, amount } = req.body;
  const gift = data.groupGifts.find(g => g.id === id);
  if (!gift) return res.status(404).json({ error: "Group gift not found" });
  if (gift.status !== 'active') return res.status(400).json({ error: "Group gift not active" });
  
  const contributionAmount = parseFloat(amount);
  const newTotal = gift.currentAmount + contributionAmount;
  if (newTotal > gift.targetAmount) return res.status(400).json({ error: "Contribution exceeds target" });
  
  gift.contributors.push({ userId: parseInt(userId), userName: userName || "Anonymous", amount: contributionAmount, date: new Date().toISOString() });
  gift.contributorsCount += 1;
  gift.currentAmount = newTotal;
  if (gift.currentAmount >= gift.targetAmount) {
    gift.status = 'completed';
    gift.completedAt = new Date().toISOString();
  }
  saveData();
  res.json({ success: true, isComplete: gift.status === 'completed', currentAmount: gift.currentAmount, targetAmount: gift.targetAmount });
});

// ============ GIFTS ENDPOINTS ============
app.get("/api/gifts", (req, res) => {
  res.json([
    { id: 1, name: "Gold Bar", price: 100, category: "Luxury", icon: "🥇" },
    { id: 2, name: "Diamond Ring", price: 150, category: "Luxury", icon: "💍" },
    { id: 3, name: "Celebration Cake", price: 50, category: "Food", icon: "🎂" },
    { id: 4, name: "Fresh Flowers", price: 40, category: "Flowers", icon: "🌹" },
    { id: 5, name: "Premium Drink", price: 20, category: "Drinks", icon: "🍾" }
  ]);
});

app.post("/api/gifts/purchase", (req, res) => {
  const { giftId, giftName, amount, network, phoneNumber, buyerId, buyerName, recipientId, recipientName } = req.body;
  if (!giftId || !amount || !recipientId) return res.status(400).json({ error: "Missing required fields" });
  
  const newBalance = addToWallet(recipientId, parseFloat(amount), giftName, buyerName || 'Someone');
  const transaction = { id: Date.now().toString(), giftId, giftName, amount: parseFloat(amount), buyerId, buyerName, recipientId, recipientName, network, phoneNumber, status: 'completed', date: new Date().toISOString() };
  data.giftTransactions.unshift(transaction);
  saveData();
  addNotification(recipientId, 'gift', '🎁 Gift Received', `${buyerName || 'Someone'} sent you ${giftName} worth ₵${amount}!`);
  res.json({ success: true, transaction, newBalance });
});

// ============ SEARCH ENDPOINT ============
app.get('/api/users/search', (req, res) => {
  const { q } = req.query;
  console.log(`🔍 Search query: "${q}"`);
  console.log(`👥 Total users in database: ${data.users.length}`);
  
  if (!q || q.length === 0) {
    console.log(`📋 Returning all ${data.users.length} users`);
    const allUsers = data.users.map(user => ({
      id: user.id,
      name: user.name,
      username: user.username,
      profileImage: user.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
      birthDate: user.birthDate || null,
      phone: user.phone || '',
      network: user.network || ''
    }));
    return res.json(allUsers);
  }
  
  const searchTerm = q.toLowerCase().trim();
  const results = data.users.filter(user => {
    const nameMatch = user.name?.toLowerCase().includes(searchTerm);
    const usernameMatch = user.username?.toLowerCase().includes(searchTerm);
    const emailMatch = user.email?.toLowerCase().includes(searchTerm);
    return nameMatch || usernameMatch || emailMatch;
  });
  
  console.log(`✅ Found ${results.length} users matching "${q}"`);
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

// ============ USER SETTINGS ENDPOINTS ============

if (!data.userSettings) {
  data.userSettings = {};
  saveData();
}

if (!data.blockedUsers) {
  data.blockedUsers = {};
  saveData();
}

app.get('/api/user/settings/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  
  if (!data.userSettings[userId]) {
    data.userSettings[userId] = {
      theme: {
        darkMode: false,
        primaryColor: '#6366f1'
      },
      privacy: {
        birthdayVisibility: 'friends',
        postVisibility: 'friends',
        allowWishes: 'everyone',
        allowTagging: 'friends'
      },
      notifications: {
        enabled: true,
        birthdayReminders: true,
        friendRequests: true,
        giftNotifications: true,
        commentNotifications: true
      }
    };
    saveData();
  }
  
  res.json(data.userSettings[userId]);
});

app.put('/api/user/settings/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const { theme, privacy, notifications } = req.body;
  
  if (!data.userSettings[userId]) {
    data.userSettings[userId] = {
      theme: { darkMode: false, primaryColor: '#6366f1' },
      privacy: { birthdayVisibility: 'friends', postVisibility: 'friends', allowWishes: 'everyone', allowTagging: 'friends' },
      notifications: { enabled: true, birthdayReminders: true, friendRequests: true, giftNotifications: true, commentNotifications: true }
    };
  }
  
  if (theme) {
    data.userSettings[userId].theme = { ...data.userSettings[userId].theme, ...theme };
  }
  if (privacy) {
    data.userSettings[userId].privacy = { ...data.userSettings[userId].privacy, ...privacy };
  }
  if (notifications) {
    data.userSettings[userId].notifications = { ...data.userSettings[userId].notifications, ...notifications };
  }
  
  saveData();
  console.log(`✅ Settings updated for user ${userId}`);
  res.json({ success: true, settings: data.userSettings[userId] });
});

app.get('/api/user/settings/:userId/theme', (req, res) => {
  const userId = parseInt(req.params.userId);
  
  if (!data.userSettings[userId]) {
    return res.json({ darkMode: false, primaryColor: '#6366f1' });
  }
  
  res.json(data.userSettings[userId].theme || { darkMode: false, primaryColor: '#6366f1' });
});

app.put('/api/user/settings/:userId/theme', (req, res) => {
  const userId = parseInt(req.params.userId);
  const { darkMode, primaryColor } = req.body;
  
  if (!data.userSettings[userId]) {
    data.userSettings[userId] = {
      theme: { darkMode: false, primaryColor: '#6366f1' },
      privacy: { birthdayVisibility: 'friends', postVisibility: 'friends', allowWishes: 'everyone', allowTagging: 'friends' },
      notifications: { enabled: true, birthdayReminders: true, friendRequests: true, giftNotifications: true, commentNotifications: true }
    };
  }
  
  if (darkMode !== undefined) {
    data.userSettings[userId].theme.darkMode = darkMode;
  }
  if (primaryColor) {
    data.userSettings[userId].theme.primaryColor = primaryColor;
  }
  
  saveData();
  console.log(`🎨 Theme updated for user ${userId}: darkMode=${darkMode}`);
  res.json({ success: true, theme: data.userSettings[userId].theme });
});

// ============ BLOCKED USERS ENDPOINTS ============

app.get('/api/user/blocked/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  
  if (!data.blockedUsers[userId]) {
    data.blockedUsers[userId] = [];
    saveData();
  }
  
  const blockedUserIds = data.blockedUsers[userId] || [];
  const blockedUsers = data.users
    .filter(u => blockedUserIds.includes(u.id))
    .map(u => ({
      id: u.id,
      name: u.name,
      username: u.username,
      profileImage: u.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
      reason: 'Blocked by user',
      blockedAt: new Date().toISOString()
    }));
  
  res.json({ blockedUsers });
});

app.post('/api/user/block/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const { blockUserId } = req.body;
  
  if (!data.blockedUsers[userId]) {
    data.blockedUsers[userId] = [];
  }
  
  if (!data.blockedUsers[userId].includes(blockUserId)) {
    data.blockedUsers[userId].push(blockUserId);
    saveData();
    console.log(`🚫 User ${userId} blocked user ${blockUserId}`);
  }
  
  res.json({ success: true, blockedUsers: data.blockedUsers[userId] });
});

app.delete('/api/user/unblock/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const { blockUserId } = req.body;
  
  if (data.blockedUsers[userId]) {
    data.blockedUsers[userId] = data.blockedUsers[userId].filter(id => id !== blockUserId);
    saveData();
    console.log(`✅ User ${userId} unblocked user ${blockUserId}`);
  }
  
  res.json({ success: true, blockedUsers: data.blockedUsers[userId] || [] });
});

// ============ NOTIFICATION PREFERENCES ENDPOINTS ============

app.put('/api/user/notifications/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const { enabled, birthdayReminders, friendRequests, giftNotifications, commentNotifications } = req.body;
  
  if (!data.userSettings[userId]) {
    data.userSettings[userId] = {
      theme: { darkMode: false, primaryColor: '#6366f1' },
      privacy: { birthdayVisibility: 'friends', postVisibility: 'friends', allowWishes: 'everyone', allowTagging: 'friends' },
      notifications: { enabled: true, birthdayReminders: true, friendRequests: true, giftNotifications: true, commentNotifications: true }
    };
  }
  
  if (enabled !== undefined) data.userSettings[userId].notifications.enabled = enabled;
  if (birthdayReminders !== undefined) data.userSettings[userId].notifications.birthdayReminders = birthdayReminders;
  if (friendRequests !== undefined) data.userSettings[userId].notifications.friendRequests = friendRequests;
  if (giftNotifications !== undefined) data.userSettings[userId].notifications.giftNotifications = giftNotifications;
  if (commentNotifications !== undefined) data.userSettings[userId].notifications.commentNotifications = commentNotifications;
  
  saveData();
  console.log(`🔔 Notification preferences updated for user ${userId}`);
  res.json({ success: true, notifications: data.userSettings[userId].notifications });
});

// ============================================================
// ✅ DELETE ACCOUNT - Real Backend Operation
// ============================================================

app.delete('/api/user/delete', verifyToken, (req, res) => {
  const userId = req.userId;
  
  console.log(`🗑️ Deleting user account: ${userId}`);
  
  // Remove user
  const userIndex = data.users.findIndex(u => u.id === userId);
  if (userIndex !== -1) {
    data.users.splice(userIndex, 1);
  }
  
  // Remove wallet
  delete data.wallets[userId];
  
  // Remove friendships
  data.friendships = data.friendships.filter(f => 
    f.userId !== userId && f.friendId !== userId
  );
  
  // Remove friend requests
  data.friendRequests = data.friendRequests.filter(r => 
    r.fromUserId !== userId && r.toUserId !== userId
  );
  
  // Remove posts
  data.posts = data.posts.filter(p => p.userId !== userId);
  
  // Remove notifications
  data.notifications = data.notifications.filter(n => n.userId !== userId);
  
  // Remove user settings
  delete data.userSettings[userId];
  
  // Remove blocked users
  delete data.blockedUsers[userId];
  
  // Remove follows
  data.follows = data.follows.filter(f => 
    f.followerId !== userId && f.followingId !== userId
  );
  
  // Remove calendar events
  delete data.calendarEvents[userId];
  
  saveData();
  
  console.log(`✅ User ${userId} deleted successfully`);
  res.json({ success: true, message: 'Account deleted successfully' });
});

// ============================================================
// ✅ FOLLOW/UNFOLLOW - REAL IMPLEMENTATION
// ============================================================

app.post('/api/users/follow/:userId', verifyToken, (req, res) => {
  const userId = parseInt(req.params.userId);
  const followerId = req.userId;
  
  console.log(`👤 User ${followerId} following user ${userId}`);
  
  if (followerId === userId) {
    return res.status(400).json({ error: 'Cannot follow yourself' });
  }
  
  if (!data.follows) {
    data.follows = [];
  }
  
  const existing = data.follows.find(
    f => f.followerId === followerId && f.followingId === userId
  );
  
  if (!existing) {
    data.follows.push({
      id: Date.now().toString(),
      followerId: followerId,
      followingId: userId,
      createdAt: new Date().toISOString()
    });
    saveData();
    
    const follower = data.users.find(u => u.id === followerId);
    if (follower) {
      addNotification(
        userId,
        'follow',
        '👤 New Follower',
        `${follower.name} started following you!`,
        follower.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
        followerId,
        follower.name
      );
    }
    
    console.log(`✅ User ${followerId} now following ${userId}`);
    res.json({ success: true, message: `Now following user ${userId}` });
  } else {
    res.json({ success: true, message: 'Already following' });
  }
});

app.delete('/api/users/follow/:userId', verifyToken, (req, res) => {
  const userId = parseInt(req.params.userId);
  const followerId = req.userId;
  
  console.log(`👤 User ${followerId} unfollowing user ${userId}`);
  
  if (data.follows) {
    const initialLength = data.follows.length;
    data.follows = data.follows.filter(
      f => !(f.followerId === followerId && f.followingId === userId)
    );
    
    if (data.follows.length < initialLength) {
      saveData();
      console.log(`✅ User ${followerId} unfollowed ${userId}`);
      res.json({ success: true, message: `Unfollowed user ${userId}` });
    } else {
      res.json({ success: true, message: 'Not following this user' });
    }
  } else {
    res.json({ success: true, message: 'Not following this user' });
  }
});

// ============================================================
// ✅ FOLLOWERS/FOLLOWING COUNTS
// ============================================================

app.get('/api/users/:userId/followers', (req, res) => {
  const userId = parseInt(req.params.userId);
  
  if (!data.follows) {
    data.follows = [];
  }
  
  const followers = data.follows.filter(f => f.followingId === userId);
  
  const followerDetails = followers.map(f => {
    const user = data.users.find(u => u.id === f.followerId);
    return user ? {
      id: user.id,
      name: user.name,
      username: user.username,
      profileImage: user.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg'
    } : null;
  }).filter(Boolean);
  
  res.json({ 
    count: followerDetails.length, 
    followers: followerDetails 
  });
});

app.get('/api/users/:userId/following', (req, res) => {
  const userId = parseInt(req.params.userId);
  
  if (!data.follows) {
    data.follows = [];
  }
  
  const following = data.follows.filter(f => f.followerId === userId);
  
  const followingDetails = following.map(f => {
    const user = data.users.find(u => u.id === f.followingId);
    return user ? {
      id: user.id,
      name: user.name,
      username: user.username,
      profileImage: user.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg'
    } : null;
  }).filter(Boolean);
  
  res.json({ 
    count: followingDetails.length, 
    following: followingDetails 
  });
});

app.get('/api/users/:userId/is-following/:targetId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const targetId = parseInt(req.params.targetId);
  
  if (!data.follows) {
    data.follows = [];
  }
  
  const isFollowing = data.follows.some(
    f => f.followerId === userId && f.followingId === targetId
  );
  
  res.json({ isFollowing });
});

// ============================================================
// ✅ GIFT HISTORY
// ============================================================

app.get('/api/gifts/received/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  
  if (!data.giftTransactions) {
    data.giftTransactions = [];
  }
  
  const receivedGifts = data.giftTransactions.filter(
    g => g.celebrantId === userId
  );
  
  const formattedGifts = receivedGifts.map(g => ({
    id: g.id,
    giftName: g.giftName,
    amount: g.giftAmount || g.amount || 0,
    fromName: g.fromName || g.senderName || 'Someone',
    date: g.date || g.createdAt || new Date().toISOString(),
    status: 'completed',
    icon: '🎁'
  }));
  
  res.json({ 
    gifts: formattedGifts, 
    count: formattedGifts.length,
    totalAmount: formattedGifts.reduce((sum, g) => sum + g.amount, 0)
  });
});

app.get('/api/gifts/sent/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  
  if (!data.giftTransactions) {
    data.giftTransactions = [];
  }
  
  const sentGifts = data.giftTransactions.filter(
    g => g.senderId === userId || g.fromUserId === userId
  );
  
  const formattedGifts = sentGifts.map(g => ({
    id: g.id,
    giftName: g.giftName,
    amount: g.giftAmount || g.amount || 0,
    toName: g.celebrantName || g.recipientName || 'Someone',
    date: g.date || g.createdAt || new Date().toISOString(),
    status: 'completed',
    icon: '🎁'
  }));
  
  res.json({ 
    gifts: formattedGifts, 
    count: formattedGifts.length,
    totalAmount: formattedGifts.reduce((sum, g) => sum + g.amount, 0)
  });
});

// ============================================================
// ✅ PROFILE STATS (Posts, Followers, Following)
// ============================================================

app.get('/api/users/:userId/stats', (req, res) => {
  const userId = parseInt(req.params.userId);
  
  if (!data.follows) {
    data.follows = [];
  }
  
  if (!data.posts) {
    data.posts = [];
  }

  const followers = data.follows.filter(f => f.followingId === userId).length;
  const following = data.follows.filter(f => f.followerId === userId).length;
  const posts = data.posts.filter(p => p.userId === userId).length;

  const giftTransactions = data.giftTransactions || [];
  const giftsReceived = giftTransactions.filter(g => g.celebrantId === userId).length;
  const totalGiftAmount = giftTransactions
    .filter(g => g.celebrantId === userId)
    .reduce((sum, g) => sum + (g.giftAmount || g.amount || 0), 0);

  res.json({
    userId,
    posts,
    followers,
    following,
    giftsReceived,
    totalGiftAmount
  });
});

console.log('✅ Follow, Gift History, and Stats endpoints added!');

// ============================================================
// ✅ BANNER SYSTEM
// ============================================================

// Initialize banners
if (!data.banners) {
  data.banners = [
    {
      id: 'banner_fallback_1',
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
      id: 'banner_fallback_2',
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
  console.log('📊 Banners initialized');
}

// GET /api/banners
app.get('/api/banners', (req, res) => {
  const activeBanners = (data.banners || []).filter(b => b.active !== false);
  console.log(`📊 Returning ${activeBanners.length} active banners`);
  res.json({ success: true, banners: activeBanners });
});

// POST /api/banners/:id/view
app.post('/api/banners/:id/view', (req, res) => {
  const { id } = req.params;
  console.log(`👁️ Banner view: ${id}`);
  const banner = (data.banners || []).find(b => b.id === id);
  if (banner) {
    banner.views = (banner.views || 0) + 1;
    saveData();
  }
  res.json({ success: true });
});

// POST /api/banners/:id/click
app.post('/api/banners/:id/click', (req, res) => {
  const { id } = req.params;
  console.log(`👆 Banner click: ${id}`);
  const banner = (data.banners || []).find(b => b.id === id);
  if (banner) {
    banner.clicks = (banner.clicks || 0) + 1;
    saveData();
  }
  res.json({ success: true });
});

console.log('✅ Banner routes loaded');

// ============================================================
// ✅ STORIES ENDPOINTS
// ============================================================

// Get all stories
app.get('/api/stories', (req, res) => {
  const stories = data.stories || [];
  console.log(`📸 Returning ${stories.length} stories`);
  res.json({ success: true, stories });
});

// Create a story (requires auth)
app.post('/api/stories', verifyToken, (req, res) => {
  const { contentUrl, isVideo, caption, privacy } = req.body;
  const userId = req.userId;
  
  const user = data.users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const newStory = {
    id: Date.now().toString(),
    userId: userId.toString(),
    userName: user.name,
    userAvatar: user.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
    contentUrl: contentUrl,
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
  
  console.log(`📸 Story created by ${user.name}`);
  res.status(201).json({ success: true, story: newStory });
});

// Mark story as seen
app.post('/api/stories/seen', verifyToken, (req, res) => {
  const { storyId } = req.body;
  const userId = req.userId;
  
  if (!data.seenStories) data.seenStories = [];
  
  const existing = data.seenStories.find(
    s => s.storyId === storyId && s.userId === userId
  );
  
  if (!existing) {
    data.seenStories.push({ storyId, userId, seenAt: new Date().toISOString() });
    const story = (data.stories || []).find(s => s.id === storyId);
    if (story) {
      story.viewers = (story.viewers || 0) + 1;
    }
    saveData();
  }
  
  res.json({ success: true });
});

// Like a story
app.post('/api/stories/:id/like', verifyToken, (req, res) => {
  const { id } = req.params;
  const story = (data.stories || []).find(s => s.id === id);
  if (!story) {
    return res.status(404).json({ error: 'Story not found' });
  }
  story.likes = (story.likes || 0) + 1;
  saveData();
  res.json({ success: true, likes: story.likes });
});

// Unlike a story
app.delete('/api/stories/:id/like', verifyToken, (req, res) => {
  const { id } = req.params;
  const story = (data.stories || []).find(s => s.id === id);
  if (!story) {
    return res.status(404).json({ error: 'Story not found' });
  }
  story.likes = Math.max(0, (story.likes || 0) - 1);
  saveData();
  res.json({ success: true, likes: story.likes });
});

// Get seen stories for a user
app.get('/api/stories/seen/:userId', verifyToken, (req, res) => {
  const userId = parseInt(req.params.userId);
  if (!data.seenStories) data.seenStories = [];
  const seenStoryIds = data.seenStories
    .filter(s => s.userId === userId)
    .map(s => s.storyId);
  res.json({ success: true, seenStoryIds });
});

// Delete a story
app.delete('/api/stories/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.userId;
  const storyIndex = (data.stories || []).findIndex(s => s.id === id);
  if (storyIndex === -1) {
    return res.status(404).json({ error: 'Story not found' });
  }
  const story = data.stories[storyIndex];
  if (parseInt(story.userId) !== userId) {
    return res.status(403).json({ error: 'Not your story' });
  }
  data.stories.splice(storyIndex, 1);
  saveData();
  res.json({ success: true });
});

console.log('✅ Stories routes loaded');

// ============================================================
// ✅ PAYMENT ENDPOINTS - TEST MODE (No paymentService needed)
// ============================================================

// Initialize payment (TEST MODE)
app.post('/api/payment/initialize', async (req, res) => {
  try {
    const { amount, email, phone, name, giftName } = req.body;
    
    if (!amount || !email || !phone || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // For testing - simulate payment
    const reference = 'MOMO_' + Date.now();
    
    res.json({
      success: true,
      authorization_url: 'https://checkout.paystack.com/' + reference,
      reference: reference,
      message: 'Test payment initialized successfully'
    });
  } catch (error) {
    console.error('Payment init error:', error);
    res.status(500).json({ error: 'Payment initialization failed' });
  }
});

// Verify payment (TEST MODE)
app.get('/api/payment/verify', async (req, res) => {
  try {
    const { reference } = req.query;
    
    if (!reference) {
      return res.status(400).json({ error: 'Reference required' });
    }
    
    // For testing - simulate verification
    res.json({
      success: true,
      transaction: {
        amount: 100,
        gift_name: 'Gold Bar',
        customer_name: 'Test User',
        transaction_id: Date.now(),
        reference: reference,
        status: 'success'
      }
    });
  } catch (error) {
    console.error('Payment verify error:', error);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

console.log('✅ Payment routes loaded (TEST MODE)');

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
});

console.log("✅ BACKEND index.js updated with all endpoints!");
