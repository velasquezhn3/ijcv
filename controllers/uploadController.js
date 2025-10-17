const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { setExcelUrl } = require('../services/studentExcelService');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx files are allowed'));
    }
  }
});

const relacionesFilePath = path.join(__dirname, '../relaciones.xlsx');

router.post('/upload-relaciones', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  // Delete existing relaciones.xlsx if exists
  if (fs.existsSync(relacionesFilePath)) {
    try {
      fs.unlinkSync(relacionesFilePath);
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Failed to delete existing file' });
    }
  }

  // Save new file as relaciones.xlsx
  try {
    fs.writeFileSync(relacionesFilePath, req.file.buffer);
    return res.json({ success: true, message: 'File uploaded successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to save file' });
  }
});

// New endpoint to update the Excel URL dynamically
router.post('/update-excel-url', express.json(), (req, res) => {
  const { newUrl } = req.body;
  if (!newUrl || typeof newUrl !== 'string' || newUrl.trim() === '') {
    return res.status(400).json({ success: false, message: 'Invalid or missing newUrl in request body' });
  }
  try {
    setExcelUrl(newUrl);
    return res.json({ success: true, message: 'Excel URL updated successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
