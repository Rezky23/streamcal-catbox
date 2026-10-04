const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const uploadController = require('../controllers/uploadController');
const fileController = require('../controllers/fileController');
const downloaderController = require('../controllers/downloaderController');
const recognizerController = require('../controllers/recognizerController');
const supportController = require('../controllers/supportController');
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

// Support Me (Tako.id Integration: https://tako.id/api-docs)
router.get('/support/config', (req, res) => supportController.getConfig(req, res));
router.post('/support/create', (req, res) => supportController.createSupport(req, res));
router.get('/support/status/:giftId', (req, res) => supportController.checkStatus(req, res));
router.get('/support/recent', (req, res) => supportController.getRecentSupporters(req, res));
router.post('/support/webhook', (req, res) => supportController.handleWebhook(req, res));

module.exports = router;

