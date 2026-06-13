const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ============ DATA STORAGE (In-memory with file persistence) ============
const fs = require('fs');
const DATA_FILE = '/tmp/birthdayapp_data.json';

// Load data from file
let data = {
  users: [],
  wallets: {},  // userId -> { balance, transactions }
  companyFees: [],  // { id, amount, fromUserId, withdrawalAmount, date }
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
    console.log(`📂 Loaded data: ${data.users.length} users, ${Object.keys(data.wallets).length} wallets`);
  }
} catch (err) {
  console.log("No existing data file, starting fresh");
}

// Save data to file
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log(`💾 Data saved: ${data.users.length} users, ${Object.keys(data.wallets).length} wallets`);
}

// Helper functions
const getWalletBalance = (userId) => {
  return data.wallets[userId]?.balance || 0;
};

const addToWallet = (userId, amount, giftName, fromName) => {
  if (!data.wallets[userId]) {
    data.wallets[userId] = { balance: 0, transactions: [] };
  }
  
  data.wallets[userId].balance += amount;
  data.wallets[userId].transactions.unshift({
    id: Date.now().toString(),
    type: 'credit',
    amount: amount,
    giftName: giftName,
    fromName: fromName,
    date: new Date().toISOString(),
    status: 'completed'
  });
  
  saveData();
  return data.wallets[userId].balance;
};

const withdrawFromWallet = (userId, amount, network, phoneNumber) => {
  const currentBalance = getWalletBalance(userId);
  
  if (currentBalance < amount) {
    return { success: false, error: 'Insufficient balance' };
  }
  
  const fee = amount * 0.01;
  const netReceived = amount - fee;
  const newBalance = currentBalance - amount;
  
  // Update wallet balance
  data.wallets[userId].balance = newBalance;
  data.wallets[userId].transactions.unshift({
    id: Date.now().toString(),
    type: 'debit',
    amount: amount,
    fee: fee,
    netReceived: netReceived,
    network: network,
    phoneNumber: phoneNumber,
    date: new Date().toISOString(),
    status: 'completed'
  });
  
  // Record company fee
  data.companyFees.unshift({
    id: Date.now().toString(),
    amount: fee,
    fromUserId: userId,
    withdrawalAmount: amount,
    date: new Date().toISOString(),
    companyAccount: data.companyAccount.accountNumber
  });
  
  // Update company total fees
  data.companyAccount.totalFees += fee;
  
  saveData();
  
  console.log(`🏦 Fee of ₵${fee} sent to ${data.companyAccount.name} (${data.companyAccount.accountNumber})`);
  console.log(`💰 User ${userId} withdrew ₵${amount} - Received ₵${netReceived} - New balance ₵${newBalance}`);
  
  return { success: true, fee: fee, received: netReceived, newBalance: newBalance };
};

// ============ HEALTH CHECK ============
app.get("/health", (req, res) => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// ============ USER ENDPOINTS ============

// Register user
app.post("/api/auth/register", (req, res) => {
    const { email, password, name, username } = req.body;
    const normalizedEmail = email.toLowerCase();
    
    const existingUser = data.users.find(u => u.email === normalizedEmail);
    if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
    }
    
    const newUser = {
        id: data.users.length + 1,
        email: normalizedEmail,
        name,
        username,
        created_at: new Date().toISOString()
    };
    data.users.push(newUser);
    
    // Initialize wallet for user
    if (!data.wallets[newUser.id]) {
      data.wallets[newUser.id] = { balance: 0, transactions: [] };
    }
    
    saveData();
    
    res.json({
        token: "test-token-" + Date.now(),
        user: { id: newUser.id, email: newUser.email, name, username }
    });
});

// Login user
app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase();
    
    const user = data.users.find(u => u.email === normalizedEmail);
    if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
    }
    
    res.json({
        token: "test-token-" + Date.now(),
        user: { id: user.id, email: user.email, name: user.name, username: user.username }
    });
});

// ============ WALLET ENDPOINTS ============

// Get wallet balance
app.get("/api/wallet/balance/:userId", (req, res) => {
    const { userId } = req.params;
    const balance = getWalletBalance(parseInt(userId));
    res.json({ balance: balance, currency: 'GHS' });
});

// Get wallet transactions
app.get("/api/wallet/transactions/:userId", (req, res) => {
    const { userId } = req.params;
    const wallet = data.wallets[parseInt(userId)];
    res.json({
        balance: wallet?.balance || 0,
        transactions: wallet?.transactions || []
    });
});

// Add gift to celebrant wallet (after payment)
app.post("/api/wallet/add-gift", (req, res) => {
    const { celebrantId, celebrantEmail, celebrantName, giftAmount, giftName, fromName, isAnonymous } = req.body;
    
    const amount = parseFloat(giftAmount);
    const senderName = isAnonymous ? 'Anonymous' : (fromName || 'Someone');
    
    const newBalance = addToWallet(celebrantId, amount, giftName, senderName);
    
    // Record gift transaction
    data.giftTransactions.unshift({
        id: Date.now().toString(),
        celebrantId: celebrantId,
        celebrantEmail: celebrantEmail,
        celebrantName: celebrantName,
        giftName: giftName,
        giftAmount: amount,
        fromName: senderName,
        date: new Date().toISOString()
    });
    
    saveData();
    
    res.json({
        success: true,
        newBalance: newBalance,
        message: `₵${amount} added to ${celebrantName}'s wallet`,
        transaction: {
            id: Date.now().toString(),
            type: 'credit',
            amount: amount,
            giftName: giftName,
            fromName: senderName
        }
    });
});

// Withdraw from wallet
app.post("/api/wallet/withdraw", (req, res) => {
    const { userId, amount, phoneNumber, provider } = req.body;
    
    const result = withdrawFromWallet(parseInt(userId), parseFloat(amount), provider, phoneNumber);
    
    if (result.success) {
        res.json({
            success: true,
            message: `Withdrawal successful! ₵${result.received} sent to ${phoneNumber}`,
            newBalance: result.newBalance,
            amount: amount,
            fee: result.fee,
            netAmount: result.received,
            companyAccount: data.companyAccount
        });
    } else {
        res.status(400).json({ error: result.error });
    }
});

// Get received gifts for a user
app.get("/api/gifts/received/:email", (req, res) => {
    const { email } = req.params;
    const normalizedEmail = email.toLowerCase();
    
    const user = data.users.find(u => u.email === normalizedEmail);
    if (!user) {
        return res.json({ gifts: [], count: 0 });
    }
    
    const gifts = data.giftTransactions.filter(g => g.celebrantId === user.id);
    res.json({ gifts: gifts, count: gifts.length });
});

// ============ COMPANY FEE ENDPOINTS ============

// Get company fee info
app.get("/api/company/fees", (req, res) => {
    res.json({
        companyAccount: data.companyAccount,
        totalFees: data.companyAccount.totalFees,
        transactions: data.companyFees
    });
});

// Get total company fees
app.get("/api/company/fees/total", (req, res) => {
    res.json({ totalFees: data.companyAccount.totalFees });
});

// Get company fee transactions
app.get("/api/company/fees/transactions", (req, res) => {
    res.json({ transactions: data.companyFees });
});

// ============ GIFT ENDPOINTS ============

// Get available gifts
app.get("/api/gifts", (req, res) => {
    res.json([
        { id: 1, name: "Gold Bar", price: 100, category: "Luxury", icon: "🥇" },
        { id: 2, name: "Diamond Ring", price: 150, category: "Luxury", icon: "💍" },
        { id: 3, name: "Celebration Cake", price: 50, category: "Food", icon: "🎂" },
        { id: 4, name: "Fresh Flowers", price: 40, category: "Flowers", icon: "🌹" },
        { id: 5, name: "Premium Drink", price: 20, category: "Drinks", icon: "🍾" }
    ]);
});

// ============ ROOT ENDPOINT ============
app.get("/", (req, res) => {
    res.json({ message: "BirthdayApp API is running!" });
});

// ============ START SERVER ============
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🏦 Company Account: ${data.companyAccount.name} (${data.companyAccount.accountNumber})`);
    console.log(`💰 Total fees collected: ₵${data.companyAccount.totalFees}`);
    console.log(`✅ Email normalization is ACTIVE`);
});

// ============ MOBILE MONEY PAYMENT ENDPOINTS ============
const paymentService = require('./services/payment');

// Initialize mobile money payment
app.post('/api/payment/initialize', async (req, res) => {
  const { amount, email, phone, name, giftName } = req.body;
  
  if (!amount || !email || !phone || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  console.log(`[API] Payment request: ₵${amount} for ${giftName} to ${phone}`);
  
  const result = await paymentService.initializeMobileMoneyPayment(
    amount, email, phone, name, giftName
  );
  
  if (result.success) {
    res.json({
      success: true,
      authorization_url: result.authorization_url,
      reference: result.reference,
      message: result.message
    });
  } else {
    res.status(400).json({ error: result.error });
  }
});

// Verify payment
app.get('/api/payment/verify', async (req, res) => {
  const { reference } = req.query;
  
  if (!reference) {
    return res.status(400).json({ error: 'Reference required' });
  }
  
  const result = await paymentService.verifyPayment(reference);
  
  if (result.success) {
    res.json({
      success: true,
      message: 'Payment verified successfully',
      transaction: result,
    });
  } else {
    res.status(400).json({ error: result.error });
  }
});

// Webhook for Paystack
app.post('/api/payment/webhook', async (req, res) => {
  const event = req.body;
  
  if (event.event === 'charge.success') {
    console.log(`[WEBHOOK] Payment successful: ${event.data.reference}`);
  }
  
  res.sendStatus(200);
});

// ============ GROUP GIFT ROUTES ============
const groupGiftRoutes = require('./routes/group-gifts');
app.use('/api/group-gifts', groupGiftRoutes);

// Group Gift Routes
