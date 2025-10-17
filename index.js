global.crypto = require('crypto');
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { iniciarBot } = require('./controllers/botController');
const uploadController = require('./controllers/uploadController');
const adminStatsRouter = require('./routes/adminStats');
const adminUsersRouter = require('./routes/adminUsers');
const financialDashboardRouter = require('./routes/financialDashboard');

const app = express();
const port = process.env.PORT || 3000;

let botInstance = null;
let restarting = false;

const dataDir = path.join(__dirname, 'data');
const qrPngPath = path.join(dataDir, 'qr_code.png');

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', uploadController);
app.use('/admin/stats', adminStatsRouter);
app.use('/admin', adminUsersRouter);
app.use('/admin/dashboard', financialDashboardRouter);

// Endpoint to get QR code image
app.get('/qr', (req, res) => {
  // Try to find the latest qr_code_*.png file in dataDir. If none, fallback to qr_code.png
  fs.readdir(dataDir, (err, files) => {
    if (err) return res.status(500).send('Could not read data directory');
    const qrs = files
      .filter(f => f.startsWith('qr_code_') && f.endsWith('.png'))
      .sort()
      .reverse();
    if (qrs.length > 0) {
      return res.sendFile(path.join(dataDir, qrs[0]));
    }
    fs.access(qrPngPath, fs.constants.F_OK, (err2) => {
      if (err2) return res.status(404).send('QR code not found');
      res.sendFile(qrPngPath);
    });
  });
});

// Endpoint to clear data folder and restart bot
app.post('/restart', (req, res) => {
  if (restarting) {
    return res.status(429).send('Restart already in progress');
  }
  restarting = true;

  // Delete data folder if exists
  fs.rm(dataDir, { recursive: true, force: true }, (err) => {
    if (err) {
      console.error('Error deleting data folder:', err);
      restarting = false;
      return res.status(500).send('Failed to delete data folder');
    }
    console.log('Data folder deleted successfully');

    // Restart the bot by calling iniciarBot again
    iniciarBot()
      .then((bot) => {
        botInstance = bot;
        restarting = false;
        res.send('Bot restarted successfully');
      })
      .catch((error) => {
        console.error('Error restarting bot:', error);
        restarting = false;
        res.status(500).send('Failed to restart bot');
      });
  });
});

// Start Express server
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

// Start the bot initially
(async () => {
  try {
    botInstance = await iniciarBot();
  } catch (error) {
    console.error('Error starting bot:', error);
  }
})();
