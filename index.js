const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// In-memory user storage
let users = [];

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Gifts endpoint
app.get("/api/gifts", (req, res) => {
    res.json([
        { id: 1, name: "Gold Bar", price: 100, category: "Luxury", icon: "🥇" },
        { id: 2, name: "Diamond Ring", price: 150, category: "Luxury", icon: "💍" },
        { id: 3, name: "Celebration Cake", price: 50, category: "Food", icon: "🎂" }
    ]);
});

// Register endpoint - WITH email normalization
app.post("/api/auth/register", (req, res) => {
    const { email, password, name, username } = req.body;
    const normalizedEmail = email.toLowerCase(); // ← FORCE LOWERCASE
    
    // Check if user exists
    const existingUser = users.find(u => u.email === normalizedEmail);
    if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
    }
    
    const newUser = {
        id: users.length + 1,
        email: normalizedEmail,
        name,
        username,
        created_at: new Date().toISOString()
    };
    users.push(newUser);
    
    res.json({
        token: "test-token-" + Date.now(),
        user: { id: newUser.id, email: newUser.email, name, username }
    });
});

// Login endpoint - WITH email normalization
app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase(); // ← FORCE LOWERCASE
    
    const user = users.find(u => u.email === normalizedEmail);
    if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
    }
    
    res.json({
        token: "test-token-" + Date.now(),
        user: { id: user.id, email: user.email, name: user.name, username: user.username }
    });
});

// Root endpoint
app.get("/", (req, res) => {
    res.json({ message: "BirthdayApp API is running!" });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`✅ Email normalization is now ACTIVE - all emails stored as lowercase`);
});
