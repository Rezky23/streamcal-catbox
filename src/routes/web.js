const express = require('express');
const router = express.Router();
const path = require('path');
const fileController = require('../controllers/fileController');

// Support / Donation page (e.g. streamcal.id/support)
router.get('/support', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'support.html'));
});

// Direct short link handler: e.g. /7k2m9x.png or /7k2m9x
router.get('/:filename([a-zA-Z0-9_-]+\\.[a-zA-Z0-9]+|[a-zA-Z0-9]{5,12})', fileController.serveDirectFile);

module.exports = router;
