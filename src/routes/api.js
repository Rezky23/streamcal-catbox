const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const uploadController = require('../controllers/uploadController');
const fileController = require('../controllers/fileController');
const downloaderController = require('../controllers/downloaderController');

// Upload handlers for Streamcal
router.post('/upload', upload.array('files', 25), uploadController.uploadFiles);
router.post('/upload-url', uploadController.uploadFromUrl);
router.get('/info/:filename', fileController.getFileMetadata);
router.get('/stats', fileController.getStats);

// Media Downloader handlers (YouTube & TikTok)
router.post('/downloader/resolve', downloaderController.resolveMedia);
router.get('/downloader/download', downloaderController.streamDownload);
router.post('/downloader/save-streamcal', downloaderController.saveToStreamcal);

module.exports = router;
