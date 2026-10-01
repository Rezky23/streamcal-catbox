const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const uploadController = require('../controllers/uploadController');
const fileController = require('../controllers/fileController');
const downloaderController = require('../controllers/downloaderController');
const recognizerController = require('../controllers/recognizerController');
const multer = require('multer');

// Multer in-memory storage for audio recognition (up to 15MB)
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});

// Upload handlers for Streamcal
router.post('/upload', upload.array('files', 25), uploadController.uploadFiles);
router.post('/upload-url', uploadController.uploadFromUrl);
router.get('/info/:filename', fileController.getFileMetadata);
router.get('/stats', fileController.getStats);

// Media Downloader handlers (YouTube & TikTok)
router.post('/downloader/resolve', downloaderController.resolveMedia);
router.get('/downloader/download', downloaderController.streamDownload);
router.post('/downloader/save-streamcal', downloaderController.saveToStreamcal);

// Audio Recognizer / Shazam handler
router.post('/recognize', audioUpload.single('audio'), recognizerController.recognizeAudio);

module.exports = router;

