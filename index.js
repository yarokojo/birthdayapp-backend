const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Test user
const users = [
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
];

const posts = [];
const banners = [
  {
    id: "banner_1",
    title: "🎉 Welcome to BirthdayApp!",
    subtitle: "Celebrate every moment",
    icon: "🎂",
    colors: ["#6366f1", "#8b5cf6", "#a855f7"],
    active: true
  }
];
const wallets = { "1": { balance: 100, transactions: [] } };
const notifications = [];
const stories = [];

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

  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email },
    "your_jwt_secret_key",
    { expiresIn: "7d" }
  );

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
  const { email, password, name, username } = req.body;

  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: "User already exists" });
  }

  const newUser = {
    id: users.length + 1,
    email,
    password: bcrypt.hashSync(password, 10),
    name,
    username,
    phone: "",
    network: "MTN",
    profileImage: "https://randomuser.me/api/portraits/men/1.jpg",
    birthDate: null
  };
  users.push(newUser);
  wallets[String(newUser.id)] = { balance: 0, transactions: [] };

  const token = jwt.sign(
    { userId: newUser.id, email: newUser.email },
    "your_jwt_secret_key",
    { expiresIn: "7d" }
  );

  res.status(201).json({
    token,
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      username: newUser.username
    }
  });
});

// ============ USERS ============
app.get("/api/users", (req, res) => {
  res.json(users.map(u => ({
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

app.get("/api/users/profile", (req, res) => {
  const user = users[0];
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

// ============ POSTS ============
app.get("/api/posts", (req, res) => {
  res.json(posts);
});

app.post("/api/posts", (req, res) => {
  const { content, image, video, location, celebrationType, celebrantName, isBirthday, music, hashtags } = req.body;

  const newPost = {
    id: Date.now().toString(),
    userId: 1,
    content: content || "",
    image: image || null,
    video: video || null,
    location: location || null,
    celebrationType: celebrationType || "general",
    celebrantName: celebrantName || "",
    isBirthday: isBirthday || celebrationType === "birthday",
    music: music || null,
    hashtags: hashtags || [],
    authorName: "Test User",
    authorHandle: "testuser",
    authorImage: "https://randomuser.me/api/portraits/men/1.jpg",
    likes: 0,
    comments: 0,
    commentList: [],
    createdAt: new Date().toISOString()
  };

  posts.unshift(newPost);
  res.status(201).json(newPost);
});

app.delete("/api/posts/:id", (req, res) => {
  const id = req.params.id;
  const index = posts.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ error: "Post not found" });
  posts.splice(index, 1);
  res.json({ success: true });
});

// ============ LIKES ============
app.post("/api/posts/:id/like", (req, res) => {
  const post = posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  post.likes = (post.likes || 0) + 1;
  res.json({ success: true, likes: post.likes });
});

app.delete("/api/posts/:id/like", (req, res) => {
  const post = posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  post.likes = Math.max(0, (post.likes || 0) - 1);
  res.json({ success: true, likes: post.likes });
});

// ============ COMMENTS ============
app.post("/api/posts/:id/comments", (req, res) => {
  const post = posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Comment text is required" });
  }
  const newComment = {
    id: Date.now().toString(),
    userId: 1,
    userName: "Test User",
    userAvatar: "https://randomuser.me/api/portraits/men/1.jpg",
    text: text.trim(),
    createdAt: new Date().toISOString(),
    likes: 0
  };
  post.commentList = post.commentList || [];
  post.commentList.push(newComment);
  post.comments = (post.comments || 0) + 1;
  res.status(201).json(newComment);
});

app.delete("/api/posts/:postId/comments/:commentId", (req, res) => {
  const post = posts.find(p => p.id === req.params.postId);
  if (!post) return res.status(404).json({ error: "Post not found" });
  const index = post.commentList.findIndex(c => c.id === req.params.commentId);
  if (index === -1) return res.status(404).json({ error: "Comment not found" });
  post.commentList.splice(index, 1);
  post.comments = Math.max(0, (post.comments || 0) - 1);
  res.json({ success: true });
});

// ============ BANNERS ============
app.get("/api/banners", (req, res) => {
  res.json({ success: true, banners });
});

app.post("/api/banners/:id/view", (req, res) => {
  const banner = banners.find(b => b.id === req.params.id);
  if (banner) banner.views = (banner.views || 0) + 1;
  res.json({ success: true });
});

app.post("/api/banners/:id/click", (req, res) => {
  const banner = banners.find(b => b.id === req.params.id);
  if (banner) banner.clicks = (banner.clicks || 0) + 1;
  res.json({ success: true });
});

// ============ STORIES ============
app.get("/api/stories", (req, res) => {
  res.json({ success: true, stories: [] });
});

// ============ WALLET ============
app.get("/api/wallet/balance/:userId", (req, res) => {
  const userId = String(req.params.userId);
  const wallet = wallets[userId] || { balance: 0, transactions: [] };
  res.json({ balance: wallet.balance || 0, currency: "GHS" });
});

app.get("/api/wallet/transactions/:userId", (req, res) => {
  const userId = String(req.params.userId);
  const wallet = wallets[userId] || { balance: 0, transactions: [] };
  res.json({ transactions: wallet.transactions || [] });
});

// ============ NOTIFICATIONS ============
app.get("/api/notifications/:userId", (req, res) => {
  res.json({ notifications: [], unreadCount: 0 });
});

// ============ FRIENDS ============
app.get("/api/friends/list/:userId", (req, res) => {
  res.json({ friends: [] });
});

app.get("/api/friends/requests", (req, res) => {
  res.json({ requests: [] });
});

// ============ SETTINGS ============
app.get("/api/user/settings/:userId/theme", (req, res) => {
  res.json({ darkMode: false, primaryColor: "#6366f1" });
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

// ============ START ============
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server running on port " + PORT);
  console.log("👥 Users: " + users.length);
  console.log("📝 Posts: " + posts.length);
  console.log("✅ All routes loaded");
});
