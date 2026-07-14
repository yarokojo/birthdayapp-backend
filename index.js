const express = require("express");
const cors = require("cors");
const fs = require("fs");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ============ DATA STORAGE ============
const DATA_FILE = path.join(__dirname, 'data.json');

let data = {
  users: [],
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
  stories: [],
  liveStreams: [],
  companyAccount: {
    name: 'MeolCompany',
    accountNumber: '0596270302',
    network: 'MTN',
    totalFees: 0

  if (fs.existsSync(DATA_FILE)) {
    const saved = fs.readFileSync(DATA_FILE, 'utf8');
    data = JSON.parse(saved);
  console.log("Starting fresh");

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// ============ VIDEO UPLOAD ============

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
    cb(null, uniqueSuffix + path.extname(file.originalname));

const upload = multer({ 
  storage: storage,

app.use('/uploads', express.static('uploads'));

app.post('/api/upload/video', upload.single('video'), (req, res) => {

// ============ HELPER FUNCTIONS ============
const getWalletBalance = (userId) => data.wallets[userId]?.balance || 0;

const addToWallet = (userId, amount, giftName, fromName) => {
  data.wallets[userId].balance += amount;
  data.wallets[userId].transactions.unshift({
    id: Date.now().toString(),
    type: 'credit',
    amount,
    giftName,
    fromName,
    date: new Date().toISOString()
  saveData();
  return data.wallets[userId].balance;

  
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
  
  if (!data.notifications) data.notifications = [];
  data.notifications.unshift(newNotification);
  saveData();
  
  return newNotification;

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
    req.userId = decoded.userId;
    next();
    console.error('❌ Invalid token:', err.message);

// ============ HEALTH CHECK ============
app.get("/health", (req, res) => {

app.get("/", (req, res) => {

// ============ AUTH ENDPOINTS ============
app.post("/api/auth/register", async (req, res) => {
  const normalizedEmail = email.toLowerCase();
  
  if (data.users.find(u => u.email === normalizedEmail)) {
  if (!birthDate) {
  
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
    data.users.push(newUser);
    
    data.userSettings[newUser.id] = {
    data.blockedUsers[newUser.id] = [];
    data.calendarEvents[newUser.id] = [];
    saveData();
    
    const token = jwt.sign(
      process.env.JWT_SECRET || 'your_jwt_secret_key',
    );
    
    console.error('Registration error:', error);

app.post("/api/auth/login", async (req, res) => {
  const normalizedEmail = email.toLowerCase();
  const user = data.users.find(u => u.email === normalizedEmail);
  
  if (!user) {
  
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
    
    const token = jwt.sign(
      process.env.JWT_SECRET || 'your_jwt_secret_key',
    );
    
    console.error('Login error:', error);

app.post('/api/auth/change-password', verifyToken, async (req, res) => {
    const userId = req.userId;
    
    if (!currentPassword || !newPassword) {
    if (newPassword.length < 6) {
    
    const user = data.users.find(u => u.id === userId);
    if (!user) {
    
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password_hash = hashedPassword;
    saveData();
    
    console.error('❌ Password change error:', error);

// ============ USER ENDPOINTS ============
app.get('/api/users/profile', verifyToken, (req, res) => {
  const user = data.users.find(u => u.id === req.userId);
  if (!user) {
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

app.put('/api/users/profile', verifyToken, (req, res) => {
  const userIndex = data.users.findIndex(u => u.id === req.userId);
  if (userIndex === -1) {
  
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

app.get('/api/users/search', (req, res) => {
  if (!q || q.length === 0) {
    return res.json([]);
  const searchTerm = q.toLowerCase().trim();
  const results = data.users.filter(user => {
    const nameMatch = user.name?.toLowerCase().includes(searchTerm);
    const usernameMatch = user.username?.toLowerCase().includes(searchTerm);
    const emailMatch = user.email?.toLowerCase().includes(searchTerm);
    return nameMatch || usernameMatch || emailMatch;
  res.json(results.map(user => ({
    id: user.id,
    name: user.name,
    username: user.username,
    profileImage: user.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
    birthDate: user.birthDate || null,
    phone: user.phone || '',
    network: user.network || ''

// ============ POST ENDPOINTS ============
app.get("/api/posts", (req, res) => {
  const allPosts = data.posts || [];
  const enrichedPosts = allPosts.map(post => {
    const author = data.users.find(u => u.id === post.userId);
  res.json(enrichedPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));

app.post("/api/posts", verifyToken, (req, res) => {
  const user = data.users.find(u => u.id === req.userId);
  if (!user) {
  
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
  
  if (!data.posts) data.posts = [];
  data.posts.unshift(newPost);
  saveData();
  res.status(201).json(newPost);

app.delete("/api/posts/:id", verifyToken, (req, res) => {
  const post = (data.posts || []).find(p => p.id === id);
  if (post.userId !== req.userId) {
  const index = (data.posts || []).findIndex(p => p.id === id);
  if (index !== -1) {
    data.posts.splice(index, 1);
    saveData();

app.post("/api/posts/:id/like", verifyToken, (req, res) => {
  const userId = req.userId;
  const post = (data.posts || []).find(p => p.id === id);
  
  if (!data.postLikes) data.postLikes = [];
  const existing = data.postLikes.find(l => l.postId === id && l.userId === userId);
  if (!existing) {
    post.likes = (post.likes || 0) + 1;
    saveData();
    if (post.userId !== userId) {
      const user = data.users.find(u => u.id === userId);

app.delete("/api/posts/:id/like", verifyToken, (req, res) => {
  const userId = req.userId;
  const post = (data.posts || []).find(p => p.id === id);
  
  if (data.postLikes) {
    const index = data.postLikes.findIndex(l => l.postId === id && l.userId === userId);
    if (index !== -1) {
      data.postLikes.splice(index, 1);
      post.likes = Math.max(0, (post.likes || 0) - 1);
      saveData();

// ============ COMMENT ENDPOINTS ============
app.post("/api/posts/:id/comments", verifyToken, (req, res) => {
  const userId = req.userId;
  const post = (data.posts || []).find(p => p.id === id);
  
  const user = data.users.find(u => u.id === userId);
  const newComment = {
    id: Date.now().toString(),
    userId,
    userName: user?.name || 'Anonymous',
    userAvatar: user?.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
    text,
    createdAt: new Date().toISOString(),
    likes: 0
  if (!post.commentList) post.commentList = [];
  post.commentList.push(newComment);
  post.comments = (post.comments || 0) + 1;
  saveData();
  
  if (post.userId !== userId) {
  res.status(201).json(newComment);

app.delete("/api/posts/:postId/comments/:commentId", verifyToken, (req, res) => {
  const userId = req.userId;
  const post = (data.posts || []).find(p => p.id === postId);
  
  const index = post.commentList?.findIndex(c => c.id === commentId);
  if (index === -1 || index === undefined) {
  
  const comment = post.commentList[index];
  if (comment.userId !== userId && post.userId !== userId) {
  
  post.commentList.splice(index, 1);
  post.comments = Math.max(0, (post.comments || 0) - 1);
  saveData();

// ============ BOOKMARK ENDPOINTS ============
app.post("/api/posts/:id/bookmark", verifyToken, (req, res) => {
  const userId = req.userId;
  if (!data.bookmarks) data.bookmarks = [];
  const existing = data.bookmarks.find(b => b.postId === id && b.userId === userId);
  if (!existing) {
    saveData();

app.delete("/api/posts/:id/bookmark", verifyToken, (req, res) => {
  const userId = req.userId;
  if (data.bookmarks) {
    const index = data.bookmarks.findIndex(b => b.postId === id && b.userId === userId);
    if (index !== -1) {
      data.bookmarks.splice(index, 1);
      saveData();

// ============ WALLET ENDPOINTS ============
app.get('/api/wallet/balance/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const balance = getWalletBalance(userId);

app.get('/api/wallet/transactions/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const wallet = data.wallets[userId];

app.post('/api/wallet/withdraw', verifyToken, (req, res) => {
  const userId = req.userId;
  
  if (!amount || !network || !phoneNumber) {
  
  const amountNum = parseFloat(amount);
  const fee = amountNum * 0.01;
  const totalDeduction = amountNum + fee;
  
  if (!data.wallets[userId]) {
  
  if (data.wallets[userId].balance < totalDeduction) {
  
  data.wallets[userId].balance -= totalDeduction;
  data.wallets[userId].transactions.unshift({
    id: Date.now().toString(),
    type: 'withdrawal',
    amount: amountNum,
    fee: fee,
    network,
    phoneNumber,
    date: new Date().toISOString()
  
  data.companyFees.unshift({
    id: Date.now().toString(),
    amount: fee,
    fromUserId: userId,
    withdrawalAmount: amountNum,
    date: new Date().toISOString()
  data.companyAccount.totalFees += fee;
  saveData();
  
    amount: amountNum,
    fee: fee,
    userReceives: amountNum - fee,
    newBalance: data.wallets[userId].balance

app.post('/api/wallet/add-gift', verifyToken, (req, res) => {
  const amount = parseFloat(giftAmount);
  const senderName = isAnonymous ? 'Anonymous' : (fromName || 'Someone');
  const newBalance = addToWallet(celebrantId, amount, giftName, senderName);
  saveData();

// ============ FRIENDS ENDPOINTS ============
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
    .filter(Boolean);

app.get('/api/friends/requests', verifyToken, (req, res) => {
  const userId = req.userId;
  const pending = data.friendRequests.filter(r => r.toUserId === userId && r.status === 'pending');
  const withDetails = pending.map(req => {
    const fromUser = data.users.find(u => u.id === req.fromUserId);

app.post('/api/friends/request', verifyToken, (req, res) => {
  const fromUserId = req.userId;
  
  if (fromUserId === toUserId) {
  
  const existing = data.friendRequests.find(r => r.fromUserId === fromUserId && r.toUserId === toUserId && r.status === 'pending');
  if (existing) {
  
  data.friendRequests.push(newRequest);
  saveData();
  
  const fromUser = data.users.find(u => u.id === fromUserId);
  if (fromUser) {

app.post('/api/friends/accept', verifyToken, (req, res) => {
  const userId = req.userId;
  const request = data.friendRequests.find(r => r.id === requestId);
  
  request.status = 'accepted';
  saveData();
  
  const toUser = data.users.find(u => u.id === request.toUserId);
  if (toUser) {

app.post('/api/friends/decline', verifyToken, (req, res) => {
  const userId = req.userId;
  const request = data.friendRequests.find(r => r.id === requestId);
  request.status = 'declined';
  saveData();

app.delete('/api/friends/:friendId', verifyToken, (req, res) => {
  const friendId = parseInt(req.params.friendId);
  const userId = req.userId;
  const index1 = data.friendships.findIndex(f => f.userId === userId && f.friendId === friendId);
  const index2 = data.friendships.findIndex(f => f.userId === friendId && f.friendId === userId);
  if (index1 !== -1) data.friendships.splice(index1, 1);
  if (index2 !== -1) data.friendships.splice(index2, 1);
  saveData();

// ============ NOTIFICATIONS ============
app.get("/api/notifications/:userId", (req, res) => {
  const userId = parseInt(req.params.userId);
  const userNotifications = (data.notifications || []).filter(n => n.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const unreadCount = userNotifications.filter(n => !n.isRead).length;

app.put("/api/notifications/:id/read", (req, res) => {
  const notification = data.notifications.find(n => n.id === id);
  notification.isRead = true;
  saveData();

app.put("/api/notifications/read-all/:userId", (req, res) => {
  const userId = parseInt(req.params.userId);
  data.notifications.filter(n => n.userId === userId && !n.isRead).forEach(n => n.isRead = true);
  saveData();

app.delete("/api/notifications/:id", (req, res) => {
  const index = data.notifications.findIndex(n => n.id === id);
  data.notifications.splice(index, 1);
  saveData();

// ============ GROUP GIFT ROUTES ============
app.get("/api/group-gifts", (req, res) => {
  res.json(data.groupGifts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));

app.post("/api/group-gifts", verifyToken, (req, res) => {
  const newGroupGift = {
    id: Date.now().toString(),
    giftName,
    celebrantName,
    targetAmount: parseFloat(targetAmount),
    currentAmount: 0,
    contributorsCount: 0,
    deadline: deadline || "No deadline",
    imageUrl: imageUrl || "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=300&h=300&fit=crop",
    status: 'active',
    contributors: [],
    createdAt: new Date().toISOString()
  data.groupGifts.unshift(newGroupGift);
  saveData();
  res.status(201).json(newGroupGift);

app.post("/api/group-gifts/:id/contribute", verifyToken, (req, res) => {
  const gift = data.groupGifts.find(g => g.id === id);
  
  const contributionAmount = parseFloat(amount);
  const newTotal = gift.currentAmount + contributionAmount;
  
  gift.contributorsCount += 1;
  gift.currentAmount = newTotal;
  if (gift.currentAmount >= gift.targetAmount) {
    gift.status = 'completed';
    gift.completedAt = new Date().toISOString();
  saveData();

// ============ GIFTS ============
app.get("/api/gifts", (req, res) => {
  res.json([
  ]);

app.post("/api/gifts/purchase", verifyToken, (req, res) => {
  const user = data.users.find(u => u.id === req.userId);
  const newBalance = addToWallet(recipientId, parseFloat(amount), giftName, user?.name || 'Someone');
  data.giftTransactions.unshift(transaction);
  saveData();

// ============ SETTINGS ============

app.get('/api/user/settings/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  if (!data.userSettings[userId]) {
    data.userSettings[userId] = {
    saveData();
  res.json(data.userSettings[userId]);

app.put('/api/user/settings/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  if (!data.userSettings[userId]) {
    data.userSettings[userId] = {
  saveData();

app.get('/api/user/settings/:userId/theme', (req, res) => {
  const userId = parseInt(req.params.userId);
  if (!data.userSettings[userId]) {

app.put('/api/user/settings/:userId/theme', (req, res) => {
  const userId = parseInt(req.params.userId);
  if (!data.userSettings[userId]) {
    data.userSettings[userId] = {
  if (darkMode !== undefined) data.userSettings[userId].theme.darkMode = darkMode;
  if (primaryColor) data.userSettings[userId].theme.primaryColor = primaryColor;
  saveData();

// ============ BLOCKED USERS ============
app.get('/api/user/blocked/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const blockedUserIds = data.blockedUsers[userId] || [];
  const blockedUsers = data.users.filter(u => blockedUserIds.includes(u.id)).map(u => ({
    id: u.id, name: u.name, username: u.username, profileImage: u.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
    reason: 'Blocked by user', blockedAt: new Date().toISOString()

app.post('/api/user/block/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  if (!data.blockedUsers[userId]) data.blockedUsers[userId] = [];
  if (!data.blockedUsers[userId].includes(blockUserId)) {
    data.blockedUsers[userId].push(blockUserId);
    saveData();

app.delete('/api/user/unblock/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  if (data.blockedUsers[userId]) {
    data.blockedUsers[userId] = data.blockedUsers[userId].filter(id => id !== blockUserId);
    saveData();

// ============ STORIES ============
app.get('/api/stories', (req, res) => {
  const stories = data.stories || [];

app.post('/api/stories', verifyToken, (req, res) => {
  const user = data.users.find(u => u.id === req.userId);
  const newStory = {
    id: Date.now().toString(),
    userId: user.id.toString(),
    userName: user.name,
    userAvatar: user.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
    contentUrl, isVideo: isVideo || false, caption: caption || '', privacy: privacy || 'friends',
    likes: 0, viewers: 0, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  if (!data.stories) data.stories = [];
  data.stories.unshift(newStory);
  saveData();

app.post('/api/stories/seen', verifyToken, (req, res) => {
  const userId = req.userId;
  if (!data.seenStories) data.seenStories = [];
  const existing = data.seenStories.find(s => s.storyId === storyId && s.userId === userId);
  if (!existing) {
    const story = (data.stories || []).find(s => s.id === storyId);
    if (story) story.viewers = (story.viewers || 0) + 1;
    saveData();

app.post('/api/stories/:id/like', verifyToken, (req, res) => {
  const story = (data.stories || []).find(s => s.id === id);
  story.likes = (story.likes || 0) + 1;
  saveData();

app.delete('/api/stories/:id/like', verifyToken, (req, res) => {
  const story = (data.stories || []).find(s => s.id === id);
  story.likes = Math.max(0, (story.likes || 0) - 1);
  saveData();

app.get('/api/stories/seen/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  if (!data.seenStories) data.seenStories = [];
  const seenStoryIds = data.seenStories.filter(s => s.userId === userId).map(s => s.storyId);

app.delete('/api/stories/:id', verifyToken, (req, res) => {
  const userId = req.userId;
  const storyIndex = (data.stories || []).findIndex(s => s.id === id);
  const story = data.stories[storyIndex];
  data.stories.splice(storyIndex, 1);
  saveData();

// ============ BANNERS ============
if (!data.banners) {
  data.banners = [
  ];
  saveData();

app.get('/api/banners', (req, res) => {
  const activeBanners = (data.banners || []).filter(b => b.active !== false);

app.post('/api/banners/:id/view', (req, res) => {
  const banner = (data.banners || []).find(b => b.id === id);

app.post('/api/banners/:id/click', (req, res) => {
  const banner = (data.banners || []).find(b => b.id === id);

// ============ DELETE ACCOUNT ============
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

// ============ FOLLOW/UNFOLLOW ============
app.post('/api/users/follow/:userId', verifyToken, (req, res) => {
  const userId = parseInt(req.params.userId);
  const followerId = req.userId;
  if (!data.follows) data.follows = [];
  const existing = data.follows.find(f => f.followerId === followerId && f.followingId === userId);
  if (!existing) {
    saveData();
    const follower = data.users.find(u => u.id === followerId);

app.delete('/api/users/follow/:userId', verifyToken, (req, res) => {
  const userId = parseInt(req.params.userId);
  const followerId = req.userId;
  if (data.follows) {
    data.follows = data.follows.filter(f => !(f.followerId === followerId && f.followingId === userId));
    saveData();

// ============================================================
// ✅ LIVE STREAMS ENDPOINTS
// ============================================================

// Initialize live streams array if not exists
if (!data.liveStreams) {
  data.liveStreams = [];
  saveData();
  console.log('📡 Live streams array initialized');

// GET /api/live/streams - Get all live streams
app.get('/api/live/streams', (req, res) => {
  console.log('📡 GET /api/live/streams');
    const liveStreams = data.liveStreams || [];
    const activeStreams = liveStreams.filter(s => s.isLive === true);
    console.error('  ❌ Error fetching streams:', error);

// GET /api/live/streams/:id - Get a specific live stream
app.get('/api/live/streams/:id', (req, res) => {
    const stream = (data.liveStreams || []).find(s => s.id === id);
    if (!stream) {
    console.error('  ❌ Error fetching stream:', error);

// POST /api/live/streams - Create a live stream (user goes live)
app.post('/api/live/streams', verifyToken, (req, res) => {
  console.log('📡 POST /api/live/streams');
  const user = data.users.find(u => u.id === req.userId);
  
  if (!user) {

    const newStream = {
      id: Date.now().toString(),
      userId: user.id,
      userName: user.name,
      userHandle: user.username,
      userAvatar: user.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
      thumbnail: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&h=300&fit=crop',
      viewerCount: 0,
      startedAt: new Date().toISOString(),
      isLive: true,
      streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      category: 'General',
      privacy: privacy || 'everyone',
      isBirthday: false,
      celebrantName: user.name,

    if (!data.liveStreams) data.liveStreams = [];
    data.liveStreams.push(newStream);
    saveData();

    console.error('  ❌ Error creating stream:', error);

// PUT /api/live/streams/:id/end - End a live stream
app.put('/api/live/streams/:id/end', verifyToken, (req, res) => {
  
    const stream = (data.liveStreams || []).find(s => s.id === id);
    if (!stream) {
    if (stream.userId !== req.userId) {

    stream.isLive = false;
    stream.endedAt = new Date().toISOString();
    saveData();

    console.error('  ❌ Error ending stream:', error);

// POST /api/live/streams/:id/view - Increment viewer count
app.post('/api/live/streams/:id/view', (req, res) => {
  
    const stream = (data.liveStreams || []).find(s => s.id === id);
    if (!stream) {
    
    stream.viewerCount = (stream.viewerCount || 0) + 1;
    saveData();
    console.error('  ❌ Error updating viewers:', error);

console.log('✅ Live Stream routes loaded successfully');

// ============ START SERVER ============
app.listen(PORT, "0.0.0.0", () => {
// ============ VIDEO UPLOAD ============
const multer = require('multer');
const path = require('path');


// Configure multer for video uploads

    if (file.mimetype.startsWith('video/')) {

app.use('/uploads', express.static('uploads'));

app.post('/api/upload/video', videoUpload.single('video'), (req, res) => {

    console.log('🎬 Video uploaded:', videoUrl);
    
    console.error('❌ Video upload error:', error);
