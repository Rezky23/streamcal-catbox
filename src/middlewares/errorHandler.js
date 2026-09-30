const multer = require('multer');
const config = require('../config/env');

function errorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: `File terlalu besar! Ukuran maksimum adalah ${config.maxFileSizeMb}MB.`
      });
    }
    return res.status(400).json({
      success: false,
      error: `Multer upload error: ${err.message}`
    });
  }

  if (err) {
    console.error('Upload / Server error:', err.message || err);
    const statusCode = err.status || (err.code === 'INVALID_FILE_TYPE' ? 400 : 500);
    return res.status(statusCode).json({
      success: false,
      error: err.message || 'An unexpected error occurred on the server.'
    });
  }

  next();
}

module.exports = errorHandler;
