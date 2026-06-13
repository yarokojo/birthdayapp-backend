const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000; // Use Render's port

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Test root endpoint
app.get("/", (req, res) => {
    res.json({ message: "BirthdayApp API is running!" });
});

// Gifts endpoint
app.get("/api/gifts", (req, res) => {
    res.json([
        { id: 1, name: "Gold Bar", price: 100, category: "Luxury", icon: "🥇" },
        {
            id: 2,
            name: "Diamond Ring",
            price: 150,
            category: "Luxury",
            icon: "💍"
        },
        {
            id: 3,
            name: "Celebration Cake",
            price: 50,
            category: "Food",
            icon: "🎂"
        }
    ]);
});

// Auth endpoints
app.post("/api/auth/register", (req, res) => {
    const { email, password, name, username } = req.body;
    res.json({
        token: "test-token-" + Date.now(),
        user: { id: 1, email, name, username }
    });
});

app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    res.json({
        token: "test-token-" + Date.now(),
        user: { id: 1, email, name: "Test User", username: "@testuser" }
    });
});

// Start server (Important: Listen on all interfaces)
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
