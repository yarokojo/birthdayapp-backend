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
console.log("📝 Loading routes...");

try {
  app.use("/api/auth", require("./src/routes/auth"));
  console.log("✅ /api/auth mounted");
} catch (err) {
  console.error("❌ Failed to load /api/auth:", err.message);
}

try {
  app.use("/api/users", require("./src/routes/users"));
  console.log("✅ /api/users mounted");
} catch (err) {
  console.error("❌ Failed to load /api/users:", err.message);
}

try {
  app.use("/api/posts", require("./src/routes/posts"));
  console.log("✅ /api/posts mounted");
} catch (err) {
  console.error("❌ Failed to load /api/posts:", err.message);
}

try {
  app.use("/api/wallet", require("./src/routes/wallet"));
  console.log("✅ /api/wallet mounted");
} catch (err) {
  console.error("❌ Failed to load /api/wallet:", err.message);
}

try {
  app.use("/api/friends", require("./src/routes/friends"));
  console.log("✅ /api/friends mounted");
} catch (err) {
  console.error("❌ Failed to load /api/friends:", err.message);
}

try {
  app.use("/api/gifts", require("./src/routes/gifts"));
  console.log("✅ /api/gifts mounted");
} catch (err) {
  console.error("❌ Failed to load /api/gifts:", err.message);
}

try {
  app.use("/api/notifications", require("./src/routes/notifications"));
  console.log("✅ /api/notifications mounted");
} catch (err) {
  console.error("❌ Failed to load /api/notifications:", err.message);
}

try {
  app.use("/api/calendar", require("./src/routes/calendar"));
  console.log("✅ /api/calendar mounted");
} catch (err) {
  console.error("❌ Failed to load /api/calendar:", err.message);
}

console.log("✅ All routes loaded");

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
