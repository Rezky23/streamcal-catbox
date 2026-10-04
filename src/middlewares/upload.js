const multer = require('multer');
const mime = require('mime-types');
const config = require('../config/env');
const { generateShortId } = require('../utils/idGenerator');
const { getCleanExtension, isAllowedExtension } = require('../utils/helpers');

// Multer in-memory storage (100% serverless compatible, zero local disk writes)
const storage = multer.memoryStorage();

// Disallowed MIME types that could trigger script execution in browsers
const DANGEROUS_MIMES = [
  'text/html',
  'application/xhtml+xml',
  'text/xml',
  'application/xml',
  'text/javascript',
  'application/javascript',
  'application/x-javascript',
  'text/ecmascript',
  'application/x-sh',
  'application/x-php',
  'text/x-php'
];

// File filter: only safe images and audio are allowed
const fileFilter = (req, file, cb) => {
  const mimeType = (file.mimetype || '').toLowerCase().trim();
  const ext = getCleanExtension(file.originalname, file.mimetype);

  // 1. Block dangerous MIME types immediately
  if (DANGEROUS_MIMES.some(m => mimeType.startsWith(m))) {
    const error = new Error('Tipe berkas tidak diizinkan untuk alasan keamanan.');
    error.code = 'INVALID_FILE_TYPE';
    error.status = 400;
    return cb(error, false);
  }

  // 2. Strict extension check against allowlist
  if (!isAllowedExtension(ext)) {
    const error = new Error('Hanya file gambar (image) dan audio yang diperbolehkan!');
    error.code = 'INVALID_FILE_TYPE';
    error.status = 400;
    return cb(error, false);
  }

  // 3. MIME type must be image or audio or octet-stream
  const extMime = (mime.lookup(file.originalname) || '').toLowerCase();
  const isImageOrAudio = mimeType.startsWith('image/') ||
                         mimeType.startsWith('audio/') ||
                         extMime.startsWith('image/') ||
                         extMime.startsWith('audio/') ||
                         mimeType === 'application/octet-stream';

  if (!isImageOrAudio) {
    const error = new Error('Hanya file gambar (image) dan audio yang diperbolehkan!');
    error.code = 'INVALID_FILE_TYPE';
    error.status = 400;
    return cb(error, false);
  }

  const shortId = generateShortId(6);
  const filename = ext ? `${shortId}.${ext}` : shortId;

  file.streamcalShortId = shortId;
  file.streamcalExt = ext;
  file.streamcalFilename = filename;

  cb(null, true);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: config.maxFileSizeMb * 1024 * 1024
  }
});

module.exports = upload;
