const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const uploadController = require('../controllers/uploadController');
const fileController = require('../controllers/fileController');

// Upload handlers for Streamcal
router.post('/upload', upload.array('files', 25), uploadController.uploadFiles);
router.post('/upload-url', uploadController.uploadFromUrl);
router.get('/info/:filename', fileController.getFileMetadata);
router.get('/stats', fileController.getStats);

module.exports = router;
