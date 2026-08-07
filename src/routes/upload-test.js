const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const uploadDir = path.join(__dirname, '../../uploads');
const imageDir = path.join(uploadDir, 'images');

if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, imageDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'image-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// ✅ TEST ROUTE - NO AUTH REQUIRED
router.post('/image-test', upload.single('image'), (req, res) => {
  console.log('📸 TEST UPLOAD RECEIVED!');
  console.log('📸 File:', req.file);
  
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded' });
  }
  
  const imageUrl = `${req.protocol}://${req.get('host')}/uploads/images/${req.file.filename}`;
  res.json({ success: true, imageUrl });
});

module.exports = router;
