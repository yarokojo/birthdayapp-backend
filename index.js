const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require("multer");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ============================================================
// STATIC FILES
// ============================================================
app.use('/uploads', express.static('uploads'));

// ============================================================
// ✅ MOUNT API ROUTES
// ============================================================
app.use("/api/auth", require("./src/routes/auth"));
app.use("/api/users", require("./src/routes/users"));
app.use("/api/posts", require("./src/routes/posts"));
app.use("/api/wallet", require("./src/routes/wallet"));
app.use("/api/friends", require("./src/routes/friends"));
app.use("/api/gifts", require("./src/routes/gifts"));
app.use("/api/notifications", require("./src/routes/notifications"));
app.use("/api/calendar", require("./src/routes/calendar"));
app.use("/api/stories", require("./src/routes/stories"));
app.use("/api/banners", require("./src/routes/banners"));
app.use("/api/live", require("./src/routes/live"));
app.use("/api/upload", require("./src/routes/upload"));
app.use("/api/settings", require("./src/routes/settings"));
app.use("/api/leaderboard", require("./src/routes/leaderboard"));
app.use("/api/admin", require("./src/routes/admin"));
app.use("/api/ads", require("./src/routes/ads"));

console.log("✅ All API routes mounted");

// ============================================================
// HEALTH CHECK
// ============================================================
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.get("/", (req, res) => {
  res.json({ message: "BirthdayApp API is running!" });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`✅ All routes mounted`);
});
