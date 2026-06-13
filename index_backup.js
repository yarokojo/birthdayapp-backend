const express = require("express");
const cors = require("cors");
const fs = require("fs");
const multer = require("multer");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ============ DATA STORAGE ============
const DATA_FILE = '/tmp/birthdayapp_data.json';

let data = {
  users: [],
  wallets: {},
  companyFees: [],
  giftTransactions: [],
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
    console.log(`📂 Loaded data: ${data.users.length} users`);
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

const withdrawFromWallet = (userId, amount, network, phoneNumber) => {
  const currentBalance = getWalletBalance(userId);
  if (currentBalance < amount) return { success: false, error: 'Insufficient balance' };
  
  const fee = amount * 0.01;
  const netReceived = amount - fee;
  const newBalance = currentBalance - amount;
  
  data.wallets[userId].balance = newBalance;
  data.wallets[userId].transactions.unshift({
    id: Date.now().toString(),
    type: 'debit',
    amount,
    fee,
    netReceived,
    network,
    phoneNumber,
    date: new Date().toISOString()
  });
  
  data.companyFees.unshift({
    id: Date.now().toString(),
    amount: fee,
    fromUserId: userId,
    withdrawalAmount: amount,
    date: new Date().toISOString(),
    companyAccount: data.companyAccount.accountNumber
  });
  
  data.companyAccount.totalFees += fee;
  saveData();
  
  return { success: true, fee, received: netReceived, newBalance };
};

// ============ HEALTH CHECK ============
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// ============ AUTH ENDPOINTS ============
app.post("/api/auth/register", (req, res) => {
  const { email, password, name, username } = req.body;
  const normalizedEmail = email.toLowerCase();
  if (data.users.find(u => u.email === normalizedEmail)) {
    return res.status(400).json({ error: "User already exists" });
  }
  const newUser = { id: data.users.length + 1, email: normalizedEmail, name, username, created_at: new Date().toISOString() };
  data.users.push(newUser);
  if (!data.wallets[newUser.id]) data.wallets[newUser.id] = { balance: 0, transactions: [] };
  saveData();
  res.json({ token: "test-token-" + Date.now(), user: { id: newUser.id, email: newUser.email, name, username } });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = email.toLowerCase();
  const user = data.users.find(u => u.email === normalizedEmail);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  res.json({ token: "test-token-" + Date.now(), user: { id: user.id, email: user.email, name: user.name, username: user.username } });
});

// ============ WALLET ENDPOINTS ============
app.get("/api/wallet/balance/:userId", (req, res) => {
  const balance = getWalletBalance(parseInt(req.params.userId));
  res.json({ balance, currency: 'GHS' });
});

app.get("/api/wallet/transactions/:userId", (req, res) => {
  const wallet = data.wallets[parseInt(req.params.userId)];
  res.json({ balance: wallet?.balance || 0, transactions: wallet?.transactions || [] });
});

app.post("/api/wallet/add-gift", (req, res) => {
  const { celebrantId, celebrantName, giftAmount, giftName, fromName, isAnonymous } = req.body;
  const amount = parseFloat(giftAmount);
  const senderName = isAnonymous ? 'Anonymous' : (fromName || 'Someone');
  const newBalance = addToWallet(celebrantId, amount, giftName, senderName);
  data.giftTransactions.unshift({ id: Date.now().toString(), celebrantId, celebrantName, giftName, giftAmount: amount, fromName: senderName, date: new Date().toISOString() });
  saveData();
  res.json({ success: true, newBalance, message: `₵${amount} added to wallet` });
});

app.post("/api/wallet/withdraw", (req, res) => {
  const { userId, amount, phoneNumber, provider } = req.body;
  const result = withdrawFromWallet(parseInt(userId), parseFloat(amount), provider, phoneNumber);
  if (result.success) {
    res.json({ success: true, message: `Withdrawal successful! ₵${result.received} sent`, newBalance: result.newBalance, fee: result.fee, companyAccount: data.companyAccount });
  } else {
    res.status(400).json({ error: result.error });
  }
});

app.get("/api/gifts/received/:email", (req, res) => {
  const user = data.users.find(u => u.email === req.params.email.toLowerCase());
  const gifts = data.giftTransactions.filter(g => g.celebrantId === user?.id);
  res.json({ gifts, count: gifts.length });
});

// ============ COMPANY FEE ENDPOINTS ============
app.get("/api/company/fees", (req, res) => {
  res.json({ companyAccount: data.companyAccount, totalFees: data.companyAccount.totalFees, transactions: data.companyFees });
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

// ============ PAYMENT ENDPOINTS ============
const paymentService = require('./services/payment');

app.post('/api/payment/initialize', async (req, res) => {
  const { amount, email, phone, name, giftName } = req.body;
  if (!amount || !email || !phone || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const result = await paymentService.initializeMobileMoneyPayment(amount, email, phone, name, giftName);
  if (result.success) {
    res.json({ success: true, authorization_url: result.authorization_url, reference: result.reference });
  } else {
    res.status(400).json({ error: result.error });
  }
});

app.get('/api/payment/verify', async (req, res) => {
  const { reference } = req.query;
  if (!reference) return res.status(400).json({ error: 'Reference required' });
  const result = await paymentService.verifyPayment(reference);
  if (result.success) {
    res.json({ success: true, transaction: result });
  } else {
    res.status(400).json({ error: result.error });
  }
});

// ============ GROUP GIFT ROUTES ============
const groupGiftRoutes = require('./routes/group-gifts');
app.use('/api/group-gifts', groupGiftRoutes);

// ============ ROOT ENDPOINT ============
app.get("/", (req, res) => {
  res.json({ message: "BirthdayApp API is running!" });
});

// ============ START SERVER ============
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🏦 Company: ${data.companyAccount.name} (${data.companyAccount.accountNumber})`);
  console.log(`💰 Total fees collected: ₵${data.companyAccount.totalFees}`);
  console.log(`🎬 Video upload endpoint: /api/upload/video`);
});
