const multer = require('multer');
const mime = require('mime-types');
const config = require('../config/env');
const { generateShortId } = require('../utils/idGenerator');
const { getCleanExtension } = require('../utils/helpers');

// Multer in-memory storage (100% serverless compatible, zero local disk writes)
const storage = multer.memoryStorage();

// File filter: only images and audio are allowed
const fileFilter = (req, file, cb) => {
  const mimeType = (file.mimetype || '').toLowerCase();
  const extMime = (mime.lookup(file.originalname) || '').toLowerCase();

  const isImageOrAudio = mimeType.startsWith('image/') ||
                         mimeType.startsWith('audio/') ||
                         extMime.startsWith('image/') ||
                         extMime.startsWith('audio/');

  if (isImageOrAudio) {
    const ext = getCleanExtension(file.originalname, file.mimetype);
    const shortId = generateShortId(6);
    const filename = ext ? `${shortId}.${ext}` : shortId;

    file.streamcalShortId = shortId;
    file.streamcalExt = ext;
    file.streamcalFilename = filename;

    cb(null, true);
  } else {
    const error = new Error('Hanya file gambar (image) dan audio yang diperbolehkan!');
    error.code = 'INVALID_FILE_TYPE';
    error.status = 400;
    cb(error, false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: config.maxFileSizeMb * 1024 * 1024
  }
});

module.exports = upload;
