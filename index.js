const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ============ DATA ============
const DATA_FILE = path.join(__dirname, "data.json");

const defaultData = {
  users: [
    {
      id: 1,
      email: "test@example.com",
      password: bcrypt.hashSync("password123", 10),
      name: "Test User",
      username: "testuser",
      phone: "0244123456",
      network: "MTN",
      profileImage: "https://randomuser.me/api/portraits/men/1.jpg",
      birthDate: "1990-06-15"
    }
  ],
  posts: [],
  postLikes: [],
  bookmarks: [],
  notifications: [],
  wallets: { "1": { balance: 100, transactions: [] } },
  banners: [
    {
      id: "banner_1",
      title: "🎉 Welcome to BirthdayApp!",
      subtitle: "Celebrate every moment",
      icon: "🎂",
      colors: ["#6366f1", "#8b5cf6", "#a855f7"],
      active: true
    }
  ],
  stories: [],
  seenStories: [],
  friendships: [],
  friendRequests: [],
  follows: [],
  userSettings: {
    "1": { theme: { darkMode: false, primaryColor: "#6366f1" } }
  },
  giftTransactions: [],
  companyFees: [],
  companyAccount: {
    name: "MeolCompany",
    accountNumber: "0596270302",
    network: "MTN",
    totalFees: 0
  }
};

let data = { ...defaultData };

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const saved = fs.readFileSync(DATA_FILE, "utf8");
      const parsed = JSON.parse(saved);
      data = { ...defaultData, ...parsed };
      console.log("✅ Data loaded");
    } else {
      saveData();
    }
  } catch (error) {
    console.error("❌ Error loading data:", error);
    saveData();
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log("💾 Data saved");
  } catch (error) {
    console.error("❌ Error saving data:", error);
  }
}

function verifyToken(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const decoded = jwt.verify(token, "your_jwt_secret_key");
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function addNotification(userId, type, title, message, imageUrl, targetId, targetName) {
  const notification = {
    id: Date.now().toString(),
    userId: parseInt(userId),
    type,
    title: title || type,
    message,
    imageUrl: imageUrl || null,
    targetId: targetId || null,
    targetName: targetName || null,
    isRead: false,
    createdAt: new Date().toISOString()
  };
  data.notifications.unshift(notification);
  saveData();
  return notification;
}

// ============ HEALTH ============
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.get("/", (req, res) => {
  res.json({ message: "BirthdayApp API", version: "3.0" });
});

// ============ AUTH ============
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  console.log("🔑 Login:", email);

  const user = data.users.find(u => u.email === email);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, "your_jwt_secret_key", { expiresIn: "7d" });
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      phone: user.phone || "",
      network: user.network || "MTN",
      profileImage: user.profileImage || "https://randomuser.me/api/portraits/men/1.jpg",
      birthDate: user.birthDate || null
    }
  });
});

app.post("/api/auth/register", (req, res) => {
  const { email, password, name, username, birthDate } = req.body;
  if (data.users.find(u => u.email === email)) {
    return res.status(400).json({ error: "User already exists" });
  }
  const newUser = {
    id: data.users.length + 1,
    email,
    password: bcrypt.hashSync(password, 10),
    name,
    username,
    phone: "",
    network: "MTN",
    profileImage: "https://randomuser.me/api/portraits/men/1.jpg",
    birthDate: birthDate || null
  };
  data.users.push(newUser);
  data.wallets[String(newUser.id)] = { balance: 0, transactions: [] };
  data.userSettings[String(newUser.id)] = { theme: { darkMode: false, primaryColor: "#6366f1" } };
  saveData();

  const token = jwt.sign({ userId: newUser.id, email: newUser.email }, "your_jwt_secret_key", { expiresIn: "7d" });
  res.status(201).json({ token, user: { id: newUser.id, email, name, username, birthDate: birthDate || null } });
});

// ============ USERS ============
app.get("/api/users", (req, res) => {
  res.json(data.users.map(u => ({
    id: u.id,
    name: u.name,
    username: u.username,
    profileImage: u.profileImage || "https://randomuser.me/api/portraits/men/1.jpg",
    bio: u.bio || "",
    location: u.location || "",
    phone: u.phone || "",
    network: u.network || "MTN",
    birthDate: u.birthDate || null
  })));
});

app.get("/api/users/profile", verifyToken, (req, res) => {
  const user = data.users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    phone: user.phone || "",
    network: user.network || "MTN",
    profileImage: user.profileImage || "https://randomuser.me/api/portraits/men/1.jpg",
    bio: user.bio || "",
    location: user.location || "",
    birthDate: user.birthDate || null
  });
});

app.put("/api/users/profile", verifyToken, (req, res) => {
  const user = data.users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  const { name, bio, location, profileImage, phone, network, birthDate } = req.body;
  if (name !== undefined) user.name = name;
  if (bio !== undefined) user.bio = bio;
  if (location !== undefined) user.location = location;
  if (profileImage !== undefined) user.profileImage = profileImage;
  if (phone !== undefined) user.phone = phone;
  if (network !== undefined) user.network = network;
  if (birthDate !== undefined) user.birthDate = birthDate;
  saveData();
  res.json({ success: true, user });
});

app.post("/api/users/follow/:userId", verifyToken, (req, res) => {
  const userId = parseInt(req.params.userId);
  const followerId = req.userId;
  if (followerId === userId) return res.status(400).json({ error: "Cannot follow yourself" });
  const existing = data.follows.find(f => f.followerId === followerId && f.followingId === userId);
  if (!existing) {
    data.follows.push({ id: Date.now().toString(), followerId, followingId: userId, createdAt: new Date().toISOString() });
    saveData();
    const follower = data.users.find(u => u.id === followerId);
    if (follower) {
      addNotification(userId, "follow", "👤 New Follower", `${follower.name} started following you!`);
    }
  }
  res.json({ success: true });
});

app.delete("/api/users/follow/:userId", verifyToken, (req, res) => {
  const userId = parseInt(req.params.userId);
  const followerId = req.userId;
  data.follows = data.follows.filter(f => !(f.followerId === followerId && f.followingId === userId));
  saveData();
  res.json({ success: true });
});

// ============ POSTS ============
app.get("/api/posts", (req, res) => {
  const posts = data.posts.map(p => ({
    ...p,
    commentList: p.commentList || [],
    comments: p.commentList?.length || p.comments || 0
  }));
  res.json(posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post("/api/posts", verifyToken, (req, res) => {
  const userId = req.userId;
  const { content, image, video, location, celebrationType, celebrantName, isBirthday, music, hashtags } = req.body;
  const user = data.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  if (!content && !image && !video) {
    return res.status(400).json({ error: "Post must have content or media" });
  }
  const newPost = {
    id: Date.now().toString(),
    userId: user.id,
    content: content || "",
    image: image || null,
    video: video || null,
    location: location || null,
    celebrationType: celebrationType || "general",
    celebrantName: celebrantName || "",
    isBirthday: isBirthday || celebrationType === "birthday",
    music: music || null,
    hashtags: hashtags || [],
    authorName: user.name,
    authorHandle: user.username,
    authorImage: user.profileImage || "https://randomuser.me/api/portraits/men/1.jpg",
    likes: 0,
    comments: 0,
    commentList: [],
    createdAt: new Date().toISOString()
  };
  data.posts.unshift(newPost);
  saveData();
  res.status(201).json(newPost);
});

app.delete("/api/posts/:id", verifyToken, (req, res) => {
  const id = req.params.id;
  const userId = req.userId;
  const index = data.posts.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ error: "Post not found" });
  if (data.posts[index].userId !== userId) {
    return res.status(403).json({ error: "Not authorized" });
  }
  data.posts.splice(index, 1);
  saveData();
  res.json({ success: true });
});

// ============ LIKES ============
app.post("/api/posts/:id/like", verifyToken, (req, res) => {
  const id = req.params.id;
  const userId = req.userId;
  const post = data.posts.find(p => p.id === id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  const existing = data.postLikes.find(l => l.postId === id && l.userId === userId);
  if (!existing) {
    data.postLikes.push({ postId: id, userId, createdAt: new Date().toISOString() });
    post.likes = (post.likes || 0) + 1;
    saveData();
    if (post.userId !== userId) {
      const user = data.users.find(u => u.id === userId);
      addNotification(post.userId, "like", "❤️ Post Liked", `${user?.name || "Someone"} liked your post`);
    }
  }
  res.json({ success: true, likes: post.likes });
});

app.delete("/api/posts/:id/like", verifyToken, (req, res) => {
  const id = req.params.id;
  const userId = req.userId;
  const post = data.posts.find(p => p.id === id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  const index = data.postLikes.findIndex(l => l.postId === id && l.userId === userId);
  if (index !== -1) {
    data.postLikes.splice(index, 1);
    post.likes = Math.max(0, (post.likes || 0) - 1);
    saveData();
  }
  res.json({ success: true, likes: post.likes });
});

// ============ COMMENTS ============
app.post("/api/posts/:id/comments", verifyToken, (req, res) => {
  const id = req.params.id;
  const { text } = req.body;
  const userId = req.userId;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Comment text is required" });
  }
  const post = data.posts.find(p => p.id === id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  const user = data.users.find(u => u.id === userId);
  const newComment = {
    id: Date.now().toString(),
    userId,
    userName: user?.name || "Anonymous",
    userAvatar: user?.profileImage || "https://randomuser.me/api/portraits/men/1.jpg",
    text: text.trim(),
    createdAt: new Date().toISOString(),
    likes: 0
  };
  post.commentList.push(newComment);
  post.comments = (post.comments || 0) + 1;
  saveData();
  if (post.userId !== userId) {
    addNotification(post.userId, "comment", "💬 New Comment", `${user?.name || "Someone"} commented on your post`);
  }
  res.status(201).json(newComment);
});

app.delete("/api/posts/:postId/comments/:commentId", verifyToken, (req, res) => {
  const postId = req.params.postId;
  const commentId = req.params.commentId;
  const userId = req.userId;
  const post = data.posts.find(p => p.id === postId);
  if (!post) return res.status(404).json({ error: "Post not found" });
  const index = post.commentList.findIndex(c => c.id === commentId);
  if (index === -1) return res.status(404).json({ error: "Comment not found" });
  const comment = post.commentList[index];
  if (comment.userId !== userId && post.userId !== userId) {
    return res.status(403).json({ error: "Not authorized" });
  }
  post.commentList.splice(index, 1);
  post.comments = Math.max(0, (post.comments || 0) - 1);
  saveData();
  res.json({ success: true });
});

// ============ BOOKMARKS ============
app.post("/api/posts/:id/bookmark", verifyToken, (req, res) => {
  const id = req.params.id;
  const userId = req.userId;
  const existing = data.bookmarks.find(b => b.postId === id && b.userId === userId);
  if (!existing) {
    data.bookmarks.push({ postId: id, userId, createdAt: new Date().toISOString() });
    saveData();
  }
  res.json({ success: true });
});

app.delete("/api/posts/:id/bookmark", verifyToken, (req, res) => {
  const id = req.params.id;
  const userId = req.userId;
  const index = data.bookmarks.findIndex(b => b.postId === id && b.userId === userId);
  if (index !== -1) {
    data.bookmarks.splice(index, 1);
    saveData();
  }
  res.json({ success: true });
});

// ============ BANNERS ============
app.get("/api/banners", (req, res) => {
  res.json({ success: true, banners: data.banners.filter(b => b.active !== false) });
});

app.post("/api/banners/:id/view", (req, res) => {
  const banner = data.banners.find(b => b.id === req.params.id);
  if (banner) { banner.views = (banner.views || 0) + 1; saveData(); }
  res.json({ success: true });
});

app.post("/api/banners/:id/click", (req, res) => {
  const banner = data.banners.find(b => b.id === req.params.id);
  if (banner) { banner.clicks = (banner.clicks || 0) + 1; saveData(); }
  res.json({ success: true });
});

// ============ STORIES ============
app.get("/api/stories", (req, res) => {
  res.json({ success: true, stories: data.stories.filter(s => new Date(s.expiresAt) > new Date()) });
});

app.post("/api/stories", verifyToken, (req, res) => {
  const { contentUrl, isVideo, caption, privacy } = req.body;
  const user = data.users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  const story = {
    id: Date.now().toString(),
    userId: user.id.toString(),
    userName: user.name,
    userAvatar: user.profileImage || "https://randomuser.me/api/portraits/men/1.jpg",
    contentUrl,
    isVideo: isVideo || false,
    caption: caption || "",
    privacy: privacy || "friends",
    likes: 0,
    viewers: 0,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };
  data.stories.unshift(story);
  saveData();
  res.status(201).json({ success: true, story });
});

app.post("/api/stories/seen", verifyToken, (req, res) => {
  const { storyId } = req.body;
  if (!storyId) return res.status(400).json({ error: "Story ID required" });
  const existing = data.seenStories.find(s => s.storyId === storyId && s.userId === req.userId);
  if (!existing) {
    data.seenStories.push({ storyId, userId: req.userId, seenAt: new Date().toISOString() });
    const story = data.stories.find(s => s.id === storyId);
    if (story) story.viewers = (story.viewers || 0) + 1;
    saveData();
  }
  res.json({ success: true });
});

// ============ SETTINGS ============
app.get("/api/user/settings/:userId/theme", (req, res) => {
  const userId = parseInt(req.params.userId);
  if (!data.userSettings[userId]) {
    data.userSettings[userId] = { theme: { darkMode: false, primaryColor: "#6366f1" } };
    saveData();
  }
  res.json(data.userSettings[userId].theme);
});

app.put("/api/user/settings/:userId/theme", verifyToken, (req, res) => {
  const userId = parseInt(req.params.userId);
  const { darkMode, primaryColor } = req.body;
  if (!data.userSettings[userId]) {
    data.userSettings[userId] = { theme: { darkMode: false, primaryColor: "#6366f1" } };
  }
  if (darkMode !== undefined) data.userSettings[userId].theme.darkMode = darkMode;
  if (primaryColor) data.userSettings[userId].theme.primaryColor = primaryColor;
  saveData();
  res.json({ success: true });
});

// ============ WALLET ============
app.get("/api/wallet/balance/:userId", (req, res) => {
  const userId = String(req.params.userId);
  const wallet = data.wallets[userId] || { balance: 0, transactions: [] };
  res.json({ balance: wallet.balance || 0, currency: "GHS" });
});

app.get("/api/wallet/transactions/:userId", (req, res) => {
  const userId = String(req.params.userId);
  const wallet = data.wallets[userId] || { balance: 0, transactions: [] };
  res.json({ transactions: wallet.transactions || [] });
});

app.post("/api/wallet/withdraw", verifyToken, (req, res) => {
  const { amount, network, phoneNumber } = req.body;
  const userId = String(req.userId);
  if (!amount || !network || !phoneNumber) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum < 10) {
    return res.status(400).json({ error: "Minimum withdrawal is ₵10" });
  }
  const currentBalance = data.wallets[userId]?.balance || 0;
  if (currentBalance < amountNum) {
    return res.status(400).json({ error: "Insufficient balance", balance: currentBalance });
  }
  const fee = amountNum * 0.01;
  const userReceives = amountNum - fee;
  const newBalance = currentBalance - amountNum;
  data.wallets[userId].balance = newBalance;
  data.wallets[userId].transactions.unshift({
    id: "wd_" + Date.now(),
    type: "withdrawal",
    amount: amountNum,
    fee,
    network,
    phoneNumber,
    description: "Withdrawal to " + network,
    date: new Date().toISOString(),
    status: "completed",
    balanceAfter: newBalance
  });
  data.companyFees.push({ id: "fee_" + Date.now(), amount: fee, fromUserId: userId, withdrawalAmount: amountNum, date: new Date().toISOString() });
  data.companyAccount.totalFees = (data.companyAccount.totalFees || 0) + fee;
  saveData();
  res.json({ success: true, amount: amountNum, fee, userReceives, newBalance, balanceBefore: currentBalance });
});

// ============ GIFTS ============
app.get("/api/gifts", (req, res) => {
  res.json([
    { id: 1, name: "Gold Bar", price: 100, category: "Luxury", icon: "🥇", description: "24K pure gold bar" },
    { id: 2, name: "Diamond Ring", price: 150, category: "Luxury", icon: "💍", description: "Exclusive diamond ring" },
    { id: 3, name: "Celebration Cake", price: 50, category: "Food", icon: "🎂", description: "Delicious birthday cake" },
    { id: 4, name: "Fresh Flowers", price: 40, category: "Flowers", icon: "🌹", description: "Beautiful flower bouquet" },
    { id: 5, name: "Premium Drink", price: 20, category: "Drinks", icon: "🍾", description: "Premium champagne" }
  ]);
});

app.post("/api/gifts/purchase", verifyToken, (req, res) => {
  const { giftId, giftName, amount, network, phoneNumber, recipientId, recipientName } = req.body;
  if (!giftId || !amount || !recipientId) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return res.status(400).json({ error: "Invalid amount" });
  }
  if (!data.wallets[recipientId]) {
    data.wallets[recipientId] = { balance: 0, transactions: [] };
  }
  data.wallets[recipientId].balance += amountNum;
  data.wallets[recipientId].transactions.unshift({
    id: "gift_" + Date.now(),
    type: "gift_received",
    amount: amountNum,
    giftName: giftName || "a gift",
    fromName: "Someone",
    description: "Gift received: " + giftName,
    date: new Date().toISOString()
  });
  data.giftTransactions.unshift({
    id: "txn_" + Date.now(),
    giftId,
    giftName,
    amount: amountNum,
    recipientId,
    recipientName: recipientName || "User",
    network: network || "MTN",
    phoneNumber: phoneNumber || "",
    status: "completed",
    date: new Date().toISOString()
  });
  saveData();
  addNotification(recipientId, "gift", "🎁 Gift Received", `You received ${giftName} worth ₵${amountNum}!`);
  res.json({ success: true, newBalance: data.wallets[recipientId].balance });
});

// ============ NOTIFICATIONS ============
app.get("/api/notifications/:userId", (req, res) => {
  const userId = parseInt(req.params.userId);
  const notifications = data.notifications.filter(n => n.userId === userId);
  const unreadCount = notifications.filter(n => !n.isRead).length;
  res.json({ notifications, unreadCount });
});

app.post("/api/notifications", (req, res) => {
  const { userId, type, title, message, imageUrl, targetId, targetName } = req.body;
  if (!userId || !type || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  const notification = addNotification(userId, type, title, message, imageUrl, targetId, targetName);
  res.status(201).json(notification);
});

app.put("/api/notifications/:id/read", (req, res) => {
  const notification = data.notifications.find(n => n.id === req.params.id);
  if (!notification) return res.status(404).json({ error: "Notification not found" });
  notification.isRead = true;
  saveData();
  res.json({ success: true });
});

app.delete("/api/notifications/:id", (req, res) => {
  const index = data.notifications.findIndex(n => n.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Notification not found" });
  data.notifications.splice(index, 1);
  saveData();
  res.json({ success: true });
});

// ============ FRIENDS ============
app.get("/api/friends/requests", verifyToken, (req, res) => {
  const pending = data.friendRequests.filter(r => r.toUserId === req.userId && r.status === "pending");
  res.json({ requests: pending });
});

app.get("/api/friends/list/:userId", verifyToken, (req, res) => {
  const userId = parseInt(req.params.userId);
  const friendships = data.friendships.filter(f => f.userId === userId);
  const friends = friendships.map(f => {
    const friend = data.users.find(u => u.id === f.friendId);
    return friend ? {
      id: friend.id,
      name: friend.name,
      username: friend.username,
      profileImage: friend.profileImage || "https://randomuser.me/api/portraits/men/1.jpg",
      phone: friend.phone || "",
      network: friend.network || "MTN"
    } : null;
  }).filter(Boolean);
  res.json({ friends });
});

app.post("/api/friends/request", verifyToken, (req, res) => {
  const fromUserId = req.userId;
  const { toUserId } = req.body;
  if (fromUserId === toUserId) {
    return res.status(400).json({ error: "Cannot send request to yourself" });
  }
  const existing = data.friendRequests.find(r => r.fromUserId === fromUserId && r.toUserId === toUserId && r.status === "pending");
  if (existing) {
    return res.status(400).json({ error: "Request already sent" });
  }
  const newRequest = {
    id: Date.now().toString(),
    fromUserId: parseInt(fromUserId),
    toUserId: parseInt(toUserId),
    status: "pending",
    createdAt: new Date().toISOString()
  };
  data.friendRequests.push(newRequest);
  saveData();
  res.json({ success: true, request: newRequest });
});

app.post("/api/friends/accept", verifyToken, (req, res) => {
  const userId = req.userId;
  const { requestId } = req.body;
  const request = data.friendRequests.find(r => r.id === requestId);
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (request.toUserId !== userId) return res.status(403).json({ error: "Not authorized" });
  if (request.status !== "pending") return res.status(400).json({ error: "Request already processed" });
  request.status = "accepted";
  data.friendships.push({ id: Date.now().toString(), userId: request.fromUserId, friendId: request.toUserId, createdAt: new Date().toISOString() });
  data.friendships.push({ id: (Date.now() + 1).toString(), userId: request.toUserId, friendId: request.fromUserId, createdAt: new Date().toISOString() });
  saveData();
  res.json({ success: true });
});

app.post("/api/friends/decline", verifyToken, (req, res) => {
  const userId = req.userId;
  const { requestId } = req.body;
  const request = data.friendRequests.find(r => r.id === requestId);
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (request.toUserId !== userId) return res.status(403).json({ error: "Not authorized" });
  request.status = "declined";
  saveData();
  res.json({ success: true });
});

app.delete("/api/friends/:friendId", verifyToken, (req, res) => {
  const userId = req.userId;
  const friendId = parseInt(req.params.friendId);
  data.friendships = data.friendships.filter(f => !(f.userId === userId && f.friendId === friendId) && !(f.userId === friendId && f.friendId === userId));
  saveData();
  res.json({ success: true });
});

// ============ START ============
loadData();
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server running on port " + PORT);
  console.log("👥 Users: " + data.users.length);
  console.log("📝 Posts: " + data.posts.length);
  console.log("✅ All routes loaded");
});
