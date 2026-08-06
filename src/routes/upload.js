const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Ensure upload directories exist
const uploadDir = path.join(__dirname, '../../uploads');
const videoDir = path.join(uploadDir, 'videos');
const imageDir = path.join(uploadDir, 'images');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir, { recursive: true });

// Configure multer for video uploads
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, videoDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'video-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  }
});

// ============================================================
// POST /video - Upload video
// ============================================================
router.post('/video', requireAuth, videoUpload.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }
    const videoUrl = `${req.protocol}://${req.get('host')}/uploads/videos/${req.file.filename}`;
    console.log('🎬 Video uploaded:', videoUrl);
    res.json({ success: true, videoUrl });
  } catch (error) {
    console.error('❌ Video upload error:', error);
    res.status(500).json({ error: 'Video upload failed' });
  }
});

module.exports = router;
