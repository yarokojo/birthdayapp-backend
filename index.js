const express = require("express");
const cors = require("cors");
const path = require("path");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

console.log(`🚀 Starting server on port ${PORT}`);

// ✅ Run migrations on startup
const { runMigrations } = require('./src/config/runMigrations');
runMigrations();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true
}));

app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.get("/", (req, res) => {
  res.json({ message: "BirthdayApp API is running!" });
});

// ✅ MOUNT API ROUTES
try {
  app.use("/api/calendar", require("./src/routes/calendar"));
  console.log("✅ /api/calendar mounted");
} catch (err) {
  console.error("❌ Failed to load /api/calendar:", err.message);
}

// ✅ BANNERS ROUTE
try {
  app.use("/api/banners", require("./src/routes/banners"));
  console.log("✅ /api/banners mounted");
} catch (err) {
  console.error("❌ Failed to load /api/banners:", err.message);
}

// ✅ STORIES ROUTE
try {
  app.use("/api/stories", require("./src/routes/stories"));
  console.log("✅ /api/stories mounted");
} catch (err) {
  console.error("❌ Failed to load /api/stories:", err.message);
}

try {
  app.use("/api/live", require("./src/routes/live"));
  console.log("✅ /api/live mounted");
} catch (err) {
  console.error("❌ Failed to load /api/live:", err.message);
}

try {
  app.use("/api/upload", require("./src/routes/upload"));
  console.log("✅ /api/upload mounted");
} catch (err) {
  console.error("❌ Failed to load /api/upload:", err.message);
}

try {
  app.use("/api/settings", require("./src/routes/settings"));
  console.log("✅ /api/settings mounted");
} catch (err) {
  console.error("❌ Failed to load /api/settings:", err.message);
}

try {
  app.use("/api/leaderboard", require("./src/routes/leaderboard"));
  console.log("✅ /api/leaderboard mounted");
} catch (err) {
  console.error("❌ Failed to load /api/leaderboard:", err.message);
}

try {
  app.use("/api/admin", require("./src/routes/admin"));
  console.log("✅ /api/admin mounted");
} catch (err) {
  console.error("❌ Failed to load /api/admin:", err.message);
}

try {
  app.use("/api/ads", require("./src/routes/ads"));
  console.log("✅ /api/ads mounted");
} catch (err) {
  console.error("❌ Failed to load /api/ads:", err.message);
}

console.log("✅ All routes loaded");

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

