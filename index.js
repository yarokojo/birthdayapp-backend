const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health check (required for Render)
app.get("/health", (req, res) => {
    res.json({ status: "OK", message: "Backend is running!" });
});

// Test route
app.get("/api/test", (req, res) => {
    res.json({ success: true, data: "API is working!" });
});

// Gifts route
app.get("/api/gifts", (req, res) => {
    res.json([
        { id: 1, name: "Gold Bar", price: 100, category: "Luxury", icon: "🥇" },
        {
            id: 2,
            name: "Diamond Ring",
            price: 150,
            category: "Luxury",
            icon: "💍"
        }
    ]);
});

// Root route
app.get("/", (req, res) => {
    res.json({ message: "BirthdayApp API is running!" });
});

// Start server (Critical: Must listen on 0.0.0.0)
app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on port ${PORT}`);
});
