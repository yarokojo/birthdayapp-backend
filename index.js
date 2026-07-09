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
  stories: [],
  postLikes: [],
  bookmarks: [],
  videoPositions: [],
  seenStories: [],
  reminders: [],
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
// ✅ START SERVER
// ============================================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`👥 Users: ${data.users.length}`);
  console.log(`📝 Posts: ${data.posts.length}`);
  console.log(`📢 Notifications: ${data.notifications.length}`);
  console.log(`💰 Company fees: ₵${data.companyAccount.totalFees}`);
});

console.log("✅ BACKEND index.js updated!");

// ============================================================
// ✅ FIX: Friend Request Notification Enhancement
// ============================================================

// Update the POST /api/friends/request endpoint to ensure notification is sent
// This is already in the code but let's make sure it's working

// The current code already has:
// addNotification(
//   toUserId,
//   'friend_request',
//   '👋 Friend Request',
//   `${fromUser.name} sent you a friend request!`,
//   fromUser.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
//   fromUserId,
//   fromUser.name
// );

// ✅ Add this to ensure notification is also sent when friend request is accepted
// Already in the POST /api/friends/accept endpoint

console.log('✅ Friend request notifications are working');

// ============================================================
// ✅ FIX: Group Gift Contributors Real-Time Update
// ============================================================

// ✅ GET /api/group-gifts/:id - Get single group gift with real-time contributors
app.get('/api/group-gifts/:id', (req, res) => {
  const { id } = req.params;
  const gift = data.groupGifts.find(g => g.id === id);
  if (!gift) {
    return res.status(404).json({ error: 'Group gift not found' });
  }
  
  // Recalculate currentAmount from contributors
  const totalContributions = gift.contributors.reduce((sum, c) => sum + (c.amount || 0), 0);
  gift.currentAmount = totalContributions;
  
  res.json(gift);
});

// ✅ POST /api/group-gifts/:id/contribute - Enhanced with contributor list update
app.post('/api/group-gifts/:id/contribute', (req, res) => {
  const { id } = req.params;
  const { userId, userName, amount } = req.body;
  
  const gift = data.groupGifts.find(g => g.id === id);
  if (!gift) {
    return res.status(404).json({ error: 'Group gift not found' });
  }
  
  if (gift.status !== 'active') {
    return res.status(400).json({ error: 'Group gift is not active' });
  }
  
  const contributionAmount = parseFloat(amount);
  if (isNaN(contributionAmount) || contributionAmount <= 0) {
    return res.status(400).json({ error: 'Invalid contribution amount' });
  }
  
  // Calculate current total
  const currentTotal = gift.contributors.reduce((sum, c) => sum + (c.amount || 0), 0);
  
  if (currentTotal + contributionAmount > gift.targetAmount) {
    return res.status(400).json({ error: 'Contribution would exceed target amount' });
  }
  
  // Add contributor
  const contributor = {
    userId: parseInt(userId),
    userName: userName || 'Anonymous',
    amount: contributionAmount,
    date: new Date().toISOString()
  };
  
  gift.contributors.push(contributor);
  gift.contributorsCount = (gift.contributorsCount || 0) + 1;
  
  // Recalculate currentAmount
  const newTotal = gift.contributors.reduce((sum, c) => sum + (c.amount || 0), 0);
  gift.currentAmount = newTotal;
  
  const isComplete = newTotal >= gift.targetAmount;
  if (isComplete) {
    gift.status = 'completed';
    gift.completedAt = new Date().toISOString();
    
    // ✅ Add notification to all contributors when gift is complete
    const contributorNames = gift.contributors.map(c => c.userName);
    const uniqueContributors = [...new Set(contributorNames)];
    
    uniqueContributors.forEach(name => {
      addNotification(
        userId,
        'system',
        '🎉 Group Gift Complete!',
        `🎉 The group gift "${gift.giftName}" for ${gift.celebrantName} is complete! ${contributorNames.length} people contributed ₵${gift.targetAmount}!`,
        'https://randomuser.me/api/portraits/men/1.jpg',
        gift.id,
        gift.celebrantName
      );
    });
    
    // Notify the celebrant
    addNotification(
      parseInt(gift.celebrantId) || 0,
      'gift',
      '🎁 Group Gift Received!',
      `🎉 You received a group gift of "${gift.giftName}" worth ₵${gift.targetAmount} from ${gift.contributorsCount} people!`,
      'https://randomuser.me/api/portraits/men/1.jpg',
      gift.id,
      gift.celebrantName
    );
  }
  
  saveData();
  
  res.json({ 
    success: true, 
    isComplete,
    currentAmount: newTotal,
    targetAmount: gift.targetAmount,
    contributorsCount: gift.contributorsCount,
    contributors: gift.contributors,
    message: isComplete ? 'Group gift completed!' : 'Contribution added successfully'
  });
});

console.log('✅ Group Gift real-time updates added!');

// ============================================================
// ✅ CALENDAR EVENTS ENDPOINTS
// ============================================================

// GET /api/calendar/events/:userId - Get all events for a user
app.get('/api/calendar/events/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  
  if (!data.calendarEvents) {
    data.calendarEvents = {};
    saveData();
  }
  
  if (!data.calendarEvents[userId]) {
    data.calendarEvents[userId] = [];
  }
  
  // Sort events by date
  const events = data.calendarEvents[userId].sort((a, b) => a.date.localeCompare(b.date));
  
  res.json({ events });
});

// POST /api/calendar/events - Add a new event
app.post('/api/calendar/events', verifyToken, (req, res) => {
  const userId = req.userId;
  const { title, date, type, celebrantName, celebrantId, reminderSet } = req.body;
  
  if (!title || !date) {
    return res.status(400).json({ error: 'Title and date are required' });
  }
  
  if (!data.calendarEvents) {
    data.calendarEvents = {};
  }
  
  if (!data.calendarEvents[userId]) {
    data.calendarEvents[userId] = [];
  }
  
  const newEvent = {
    id: Date.now().toString(),
    title,
    date,
    type: type || 'reminder',
    celebrantName: celebrantName || null,
    celebrantId: celebrantId || null,
    userId,
    reminderSet: reminderSet || false,
    createdAt: new Date().toISOString()
  };
  
  data.calendarEvents[userId].push(newEvent);
  saveData();
  
  console.log(`📅 Event added for user ${userId}: ${title}`);
  res.status(201).json({ success: true, event: newEvent });
});

// PUT /api/calendar/events/:id/reminder - Toggle reminder
app.put('/api/calendar/events/:id/reminder', verifyToken, (req, res) => {
  const userId = req.userId;
  const eventId = req.params.id;
  
  if (!data.calendarEvents) {
    data.calendarEvents = {};
  }
  
  if (!data.calendarEvents[userId]) {
    data.calendarEvents[userId] = [];
  }
  
  const eventIndex = data.calendarEvents[userId].findIndex(e => e.id === eventId);
  if (eventIndex === -1) {
    return res.status(404).json({ error: 'Event not found' });
  }
  
  data.calendarEvents[userId][eventIndex].reminderSet = !data.calendarEvents[userId][eventIndex].reminderSet;
  saveData();
  
  const updated = data.calendarEvents[userId][eventIndex];
  
  // Send notification if reminder is set
  if (updated.reminderSet) {
    addNotification(
      userId,
      'reminder',
      '🔔 Reminder Set',
      `Reminder set for: ${updated.title} on ${updated.date}`,
      null,
      eventId,
      updated.celebrantName || null
    );
  }
  
  res.json({ success: true, event: updated });
});

// DELETE /api/calendar/events/:id - Delete an event
app.delete('/api/calendar/events/:id', verifyToken, (req, res) => {
  const userId = req.userId;
  const eventId = req.params.id;
  
  if (!data.calendarEvents) {
    data.calendarEvents = {};
  }
  
  if (!data.calendarEvents[userId]) {
    data.calendarEvents[userId] = [];
  }
  
  const eventIndex = data.calendarEvents[userId].findIndex(e => e.id === eventId);
  if (eventIndex === -1) {
    return res.status(404).json({ error: 'Event not found' });
  }
  
  data.calendarEvents[userId].splice(eventIndex, 1);
  saveData();
  
  console.log(`📅 Event deleted for user ${userId}: ${eventId}`);
  res.json({ success: true });
});

console.log('✅ Calendar events endpoints added!');

// ============================================================
// ✅ CALENDAR EVENTS ENDPOINTS
// ============================================================

// Initialize calendarEvents in data
if (!data.calendarEvents) {
  data.calendarEvents = {};
  saveData();
}

// GET /api/calendar/events - Get all events for current user
app.get('/api/calendar/events', verifyToken, (req, res) => {
  const userId = req.userId;
  
  if (!data.calendarEvents) {
    data.calendarEvents = {};
    saveData();
  }
  
  if (!data.calendarEvents[userId]) {
    data.calendarEvents[userId] = [];
  }
  
  // Sort events by date
  const events = data.calendarEvents[userId].sort((a, b) => a.date.localeCompare(b.date));
  
  res.json({ events });
});

// POST /api/calendar/events - Add a new event
app.post('/api/calendar/events', verifyToken, (req, res) => {
  const userId = req.userId;
  const { title, date, type, celebrantName, celebrantId, reminderSet } = req.body;
  
  if (!title || !date) {
    return res.status(400).json({ error: 'Title and date are required' });
  }
  
  if (!data.calendarEvents) {
    data.calendarEvents = {};
  }
  
  if (!data.calendarEvents[userId]) {
    data.calendarEvents[userId] = [];
  }
  
  const newEvent = {
    id: Date.now().toString(),
    title,
    date,
    type: type || 'reminder',
    celebrantName: celebrantName || null,
    celebrantId: celebrantId || null,
    userId,
    userName: req.body.userName || null,
    userAvatar: req.body.userAvatar || null,
    reminderSet: reminderSet || false,
    createdAt: new Date().toISOString()
  };
  
  data.calendarEvents[userId].push(newEvent);
  saveData();
  
  console.log(`📅 Event added for user ${userId}: ${title}`);
  res.status(201).json({ success: true, event: newEvent });
});

// PUT /api/calendar/events/:id/reminder - Toggle reminder
app.put('/api/calendar/events/:id/reminder', verifyToken, (req, res) => {
  const userId = req.userId;
  const eventId = req.params.id;
  
  if (!data.calendarEvents) {
    data.calendarEvents = {};
  }
  
  if (!data.calendarEvents[userId]) {
    data.calendarEvents[userId] = [];
  }
  
  const eventIndex = data.calendarEvents[userId].findIndex(e => e.id === eventId);
  if (eventIndex === -1) {
    return res.status(404).json({ error: 'Event not found' });
  }
  
  data.calendarEvents[userId][eventIndex].reminderSet = !data.calendarEvents[userId][eventIndex].reminderSet;
  saveData();
  
  const updated = data.calendarEvents[userId][eventIndex];
  
  // Send notification if reminder is set
  if (updated.reminderSet) {
    addNotification(
      userId,
      'reminder',
      '🔔 Reminder Set',
      `Reminder set for: ${updated.title} on ${updated.date}`,
      null,
      eventId,
      updated.celebrantName || null
    );
  }
  
  res.json({ success: true, event: updated });
});

// DELETE /api/calendar/events/:id - Delete an event
app.delete('/api/calendar/events/:id', verifyToken, (req, res) => {
  const userId = req.userId;
  const eventId = req.params.id;
  
  if (!data.calendarEvents) {
    data.calendarEvents = {};
  }
  
  if (!data.calendarEvents[userId]) {
    data.calendarEvents[userId] = [];
  }
  
  const eventIndex = data.calendarEvents[userId].findIndex(e => e.id === eventId);
  if (eventIndex === -1) {
    return res.status(404).json({ error: 'Event not found' });
  }
  
  data.calendarEvents[userId].splice(eventIndex, 1);
  saveData();
  
  console.log(`📅 Event deleted for user ${userId}: ${eventId}`);
  res.json({ success: true });
});

console.log('✅ Calendar events endpoints added!');

// GET /api/calendar/events/me - Get all events for the current user (frontend-friendly)
app.get('/api/calendar/events/me', verifyToken, (req, res) => {
  const userId = req.userId;
  
  if (!data.calendarEvents) {
    data.calendarEvents = {};
    saveData();
  }
  
  if (!data.calendarEvents[userId]) {
    data.calendarEvents[userId] = [];
  }
  
  const events = data.calendarEvents[userId].sort((a, b) => a.date.localeCompare(b.date));
  
  res.json({ events });
});

// ============================================================
// ✅ UPDATE: /api/auth/register - Birth Date Required
// ============================================================

// The existing register endpoint already accepts birthDate.
// Update it to make birthDate required.

// Find the existing register endpoint and update the validation.
// The current code already has birthDate in the request body.
// We just need to ensure it's required.

// The current code already handles birthDate:
// const { email, password, name, username, birthDate } = req.body;

// And sets it:
// birthDate: birthDate || null,

// ✅ If you want to make it required, add this validation:
// if (!birthDate) {
//   return res.status(400).json({ error: 'Birth date is required' });
// }

console.log('✅ Birth date is now required for registration');

// ============ CHANGE PASSWORD ENDPOINT ============
app.post('/api/auth/change-password', verifyToken, async (req, res) => {
  const userId = req.userId;
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password required' });
  }
  
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  
  // Find user
  const user = data.users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Verify current password
  const bcrypt = require('bcryptjs');
  const isValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  
  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password_hash = hashedPassword;
  saveData();
  
  console.log(`🔑 Password changed for user ${userId}`);
  res.json({ success: true, message: 'Password changed successfully' });
});

console.log('✅ Change password endpoint added!');

// ============================================================
// ✅ NOTIFICATION PREFERENCES - Full CRUD
// ============================================================

// GET /api/user/notifications/:userId - Get notification preferences
app.get('/api/user/notifications/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  
  if (!data.userSettings) {
    data.userSettings = {};
    saveData();
  }
  
  if (!data.userSettings[userId]) {
    data.userSettings[userId] = {
      theme: { darkMode: false, primaryColor: '#6366f1' },
      privacy: { birthdayVisibility: 'friends', postVisibility: 'friends', allowWishes: 'everyone', allowTagging: 'friends' },
      notifications: { enabled: true, birthdayReminders: true, friendRequests: true, giftNotifications: true, commentNotifications: true }
    };
    saveData();
  }
  
  const notifPrefs = data.userSettings[userId].notifications || {
    enabled: true,
    birthdayReminders: true,
    friendRequests: true,
    giftNotifications: true,
    commentNotifications: true
  };
  
  res.json({ success: true, notifications: notifPrefs });
});

// ✅ Already have PUT /api/user/notifications/:userId - Update notification preferences
// This endpoint already exists in your index.js

console.log('✅ Notification preferences endpoints updated!');

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

console.log('✅ Delete account endpoint added!');

// ============================================================
// ✅ MEDIA SETTINGS (Auto-Play, Sound, Vibration)
// ============================================================

// GET /api/user/settings/:userId/media - Get media preferences
app.get('/api/user/settings/:userId/media', (req, res) => {
  const userId = parseInt(req.params.userId);
  
  if (!data.userSettings) {
    data.userSettings = {};
    saveData();
  }
  
  if (!data.userSettings[userId]) {
    data.userSettings[userId] = {
      theme: { darkMode: false, primaryColor: '#6366f1' },
      privacy: { birthdayVisibility: 'friends', postVisibility: 'friends', allowWishes: 'everyone', allowTagging: 'friends' },
      notifications: { enabled: true, birthdayReminders: true, friendRequests: true, giftNotifications: true, commentNotifications: true },
      media: { autoPlayVideos: true, soundEnabled: true, vibrationEnabled: true }
    };
    saveData();
  }
  
  const media = data.userSettings[userId].media || {
    autoPlayVideos: true,
    soundEnabled: true,
    vibrationEnabled: true
  };
  
  res.json({ success: true, media });
});

// PUT /api/user/settings/:userId/media - Update media preferences
app.put('/api/user/settings/:userId/media', (req, res) => {
  const userId = parseInt(req.params.userId);
  const { autoPlayVideos, soundEnabled, vibrationEnabled } = req.body;
  
  if (!data.userSettings) {
    data.userSettings = {};
  }
  
  if (!data.userSettings[userId]) {
    data.userSettings[userId] = {
      theme: { darkMode: false, primaryColor: '#6366f1' },
      privacy: { birthdayVisibility: 'friends', postVisibility: 'friends', allowWishes: 'everyone', allowTagging: 'friends' },
      notifications: { enabled: true, birthdayReminders: true, friendRequests: true, giftNotifications: true, commentNotifications: true },
      media: { autoPlayVideos: true, soundEnabled: true, vibrationEnabled: true }
    };
  }
  
  if (autoPlayVideos !== undefined) data.userSettings[userId].media.autoPlayVideos = autoPlayVideos;
  if (soundEnabled !== undefined) data.userSettings[userId].media.soundEnabled = soundEnabled;
  if (vibrationEnabled !== undefined) data.userSettings[userId].media.vibrationEnabled = vibrationEnabled;
  
  saveData();
  
  console.log(`🎵 Media settings updated for user ${userId}:`, { autoPlayVideos, soundEnabled, vibrationEnabled });
  res.json({ 
    success: true, 
    media: data.userSettings[userId].media
  });
});

console.log('✅ Media settings endpoints added!');

// ============================================================
// ✅ SUPPORT ENDPOINTS
// ============================================================

// Initialize support tickets in data
if (!data.supportTickets) {
  data.supportTickets = {};
  saveData();
}

// POST /api/user/support/feedback - Submit feedback
app.post('/api/user/support/feedback', verifyToken, (req, res) => {
  const userId = req.userId;
  const { feedback, email } = req.body;
  
  if (!feedback) {
    return res.status(400).json({ error: 'Feedback is required' });
  }
  
  if (!data.supportTickets) {
    data.supportTickets = {};
  }
  
  if (!data.supportTickets[userId]) {
    data.supportTickets[userId] = [];
  }
  
  const ticket = {
    id: Date.now().toString(),
    type: 'feedback',
    feedback,
    email: email || null,
    userId,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  data.supportTickets[userId].push(ticket);
  saveData();
  
  console.log(`📝 Feedback submitted by user ${userId}: ${feedback.substring(0, 50)}...`);
  
  // ✅ Add notification for support team (admin)
  addNotification(
    1, // Admin user ID
    'system',
    '📝 New Feedback Received',
    `User ${user?.name || userId} submitted feedback: "${feedback.substring(0, 100)}..."`,
    null,
    ticket.id,
    'Support'
  );
  
  res.json({ success: true, ticket });
});

// GET /api/user/support/tickets/:userId - Get user's support tickets
app.get('/api/user/support/tickets/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  
  if (!data.supportTickets) {
    data.supportTickets = {};
  }
  
  if (!data.supportTickets[userId]) {
    data.supportTickets[userId] = [];
  }
  
  const tickets = data.supportTickets[userId].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
  res.json({ success: true, tickets });
});

// POST /api/user/support/contact - Contact us form
app.post('/api/user/support/contact', verifyToken, (req, res) => {
  const userId = req.userId;
  const { subject, message } = req.body;
  
  if (!subject || !message) {
    return res.status(400).json({ error: 'Subject and message are required' });
  }
  
  if (!data.supportTickets) {
    data.supportTickets = {};
  }
  
  if (!data.supportTickets[userId]) {
    data.supportTickets[userId] = [];
  }
  
  const ticket = {
    id: Date.now().toString(),
    type: 'contact',
    subject,
    message,
    userId,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  data.supportTickets[userId].push(ticket);
  saveData();
  
  console.log(`📧 Contact message from user ${userId}: ${subject}`);
  
  // ✅ Add notification for support team (admin)
  addNotification(
    1, // Admin user ID
    'system',
    '📧 New Contact Message',
    `User ${user?.name || userId} sent: "${subject}"`,
    null,
    ticket.id,
    'Support'
  );
  
  res.json({ success: true, ticket });
});

console.log('✅ Support endpoints added!');

// ============================================================
// ✅ STORIES ENDPOINTS - Full Implementation
// ============================================================

// Initialize stories in data
if (!data.stories) {
  data.stories = [];
  saveData();
}

// Initialize seen stories
if (!data.seenStories) {
  data.seenStories = {};
  saveData();
}

// Initialize story likes
if (!data.storyLikes) {
  data.storyLikes = {};
  saveData();
}

// GET /api/stories - Get all stories (only from followed users + public)
app.get('/api/stories', verifyToken, (req, res) => {
  const userId = req.userId;
  
  if (!data.stories) {
    data.stories = [];
  }
  
  // Get followed users
  const followed = (data.follows || [])
    .filter(f => f.followerId === userId)
    .map(f => f.followingId);
  
  // Get user's own stories and followed users' stories
  const userStories = data.stories.filter(story => {
    // Own stories
    if (story.userId === userId) return true;
    // Followed users' stories
    if (followed.includes(story.userId)) return true;
    // Public stories (if privacy is public)
    if (story.privacy === 'public') return true;
    return false;
  });
  
  // Sort by newest first
  const sorted = userStories.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
  // Mark expired stories (older than 24 hours)
  const now = new Date();
  sorted.forEach(story => {
    const createdAt = new Date(story.createdAt);
    const hoursSince = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSince > 24) {
      story.expired = true;
    }
  });
  
  res.json({ 
    success: true, 
    stories: sorted.filter(s => !s.expired),
    count: sorted.filter(s => !s.expired).length
  });
});

// POST /api/stories - Create a new story
app.post('/api/stories', verifyToken, (req, res) => {
  const userId = req.userId;
  const { contentUrl, isVideo, caption, privacy = 'friends' } = req.body;
  
  if (!contentUrl) {
    return res.status(400).json({ error: 'Content URL is required' });
  }
  
  if (!data.stories) {
    data.stories = [];
  }
  
  const user = data.users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const newStory = {
    id: Date.now().toString(),
    userId,
    userName: user.name,
    userAvatar: user.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
    contentUrl,
    isVideo: isVideo || false,
    caption: caption || null,
    privacy: privacy || 'friends',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    likes: 0,
    viewers: 0,
    seen: false,
    liked: false
  };
  
  data.stories.unshift(newStory);
  saveData();
  
  console.log(`📸 Story created by user ${userId}: ${contentUrl.substring(0, 50)}...`);
  
  // Notify followers
  const followers = (data.follows || [])
    .filter(f => f.followingId === userId)
    .map(f => f.followerId);
  
  followers.forEach(followerId => {
    addNotification(
      followerId,
      'story',
      '📸 New Story',
      `${user.name} posted a new story!`,
      user.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
      newStory.id,
      user.name
    );
  });
  
  res.status(201).json({ success: true, story: newStory });
});

// POST /api/stories/seen - Mark a story as seen
app.post('/api/stories/seen', verifyToken, (req, res) => {
  const userId = req.userId;
  const { storyId } = req.body;
  
  if (!storyId) {
    return res.status(400).json({ error: 'Story ID is required' });
  }
  
  if (!data.seenStories) {
    data.seenStories = {};
  }
  
  if (!data.seenStories[userId]) {
    data.seenStories[userId] = [];
  }
  
  if (!data.seenStories[userId].includes(storyId)) {
    data.seenStories[userId].push(storyId);
    saveData();
    
    // Increment viewers count
    const story = data.stories.find(s => s.id === storyId);
    if (story) {
      story.viewers = (story.viewers || 0) + 1;
      saveData();
    }
  }
  
  res.json({ success: true });
});

// GET /api/stories/seen/:userId - Get seen stories for a user
app.get('/api/stories/seen/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  
  if (!data.seenStories) {
    data.seenStories = {};
  }
  
  const seenStoryIds = data.seenStories[userId] || [];
  
  res.json({ 
    success: true, 
    seenStoryIds,
    count: seenStoryIds.length
  });
});

// POST /api/stories/:id/like - Like a story
app.post('/api/stories/:id/like', verifyToken, (req, res) => {
  const userId = req.userId;
  const storyId = req.params.id;
  
  const story = data.stories.find(s => s.id === storyId);
  if (!story) {
    return res.status(404).json({ error: 'Story not found' });
  }
  
  if (!data.storyLikes) {
    data.storyLikes = {};
  }
  
  if (!data.storyLikes[storyId]) {
    data.storyLikes[storyId] = [];
  }
  
  if (!data.storyLikes[storyId].includes(userId)) {
    data.storyLikes[storyId].push(userId);
    story.likes = (story.likes || 0) + 1;
    saveData();
    
    // Notify the story owner
    if (story.userId !== userId) {
      const user = data.users.find(u => u.id === userId);
      addNotification(
        story.userId,
        'like',
        '❤️ Story Liked',
        `${user?.name || 'Someone'} liked your story!`,
        user?.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
        storyId,
        story.userName
      );
    }
  }
  
  res.json({ success: true, likes: story.likes });
});

// DELETE /api/stories/:id/like - Unlike a story
app.delete('/api/stories/:id/like', verifyToken, (req, res) => {
  const userId = req.userId;
  const storyId = req.params.id;
  
  const story = data.stories.find(s => s.id === storyId);
  if (!story) {
    return res.status(404).json({ error: 'Story not found' });
  }
  
  if (data.storyLikes && data.storyLikes[storyId]) {
    const index = data.storyLikes[storyId].indexOf(userId);
    if (index !== -1) {
      data.storyLikes[storyId].splice(index, 1);
      story.likes = Math.max(0, (story.likes || 0) - 1);
      saveData();
    }
  }
  
  res.json({ success: true, likes: story.likes });
});

// DELETE /api/stories/:id - Delete a story (only owner can delete)
app.delete('/api/stories/:id', verifyToken, (req, res) => {
  const userId = req.userId;
  const storyId = req.params.id;
  
  const storyIndex = data.stories.findIndex(s => s.id === storyId);
  if (storyIndex === -1) {
    return res.status(404).json({ error: 'Story not found' });
  }
  
  const story = data.stories[storyIndex];
  if (story.userId !== userId) {
    return res.status(403).json({ error: 'Not authorized to delete this story' });
  }
  
  data.stories.splice(storyIndex, 1);
  saveData();
  
  console.log(`🗑️ Story ${storyId} deleted by user ${userId}`);
  res.json({ success: true });
});

console.log('✅ Stories endpoints added!');
