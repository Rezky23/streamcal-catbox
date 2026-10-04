const fileService = require('../services/fileService');
const config = require('../config/env');

/**
 * Direct file delivery handler (serves binary buffer directly from MongoDB Atlas)
 * Examples: /abc123.png, /m8x2pq.mp3
 */
async function serveDirectFile(req, res, next) {
  const filename = req.params.filename;

  // Security check: prevent weird query parameters or path traversal
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).send('Invalid filename.');
  }

  try {
    const file = await fileService.getFileWithData(filename);

    if (!file || !file.data) {
      return next(); // Pass to next route or 404 handler
    }

    let contentType = file.mimeType || 'application/octet-stream';
    const lowerExt = (file.extension || '').toLowerCase();
    const fileData = file.data;
    const totalSize = fileData.length;

    // Security Hardening: Never allow HTML/JS/XML to execute in browser context
    const DANGEROUS_MIMES = [
      'text/html', 'application/xhtml+xml', 'text/xml', 'application/xml',
      'text/javascript', 'application/javascript', 'application/x-javascript',
      'text/ecmascript'
    ];

    if (DANGEROUS_MIMES.some(m => contentType.toLowerCase().startsWith(m)) ||
        ['html', 'htm', 'xhtml', 'js', 'mjs', 'cjs', 'php', 'xml'].includes(lowerExt)) {
      contentType = 'application/octet-stream';
      res.setHeader('Content-Disposition', `attachment; filename="${file.storedName || filename}"`);
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    } else if (contentType === 'image/svg+xml' || lowerExt === 'svg') {
      // Neutralize SVG script execution (Stored XSS)
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    }

    // Set aggressive caching headers for high performance CDN delivery
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Support HTTP Range requests (crucial for audio seeking and streaming on Discord/Web)
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

      if (start >= totalSize || end >= totalSize) {
        res.setHeader('Content-Range', `bytes */${totalSize}`);
        return res.status(416).send('Requested range not satisfiable');
      }

      const chunksize = (end - start) + 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
      res.setHeader('Content-Length', chunksize);

      return res.end(fileData.subarray(start, end + 1));
    } else {
      res.setHeader('Content-Length', totalSize);
      return res.end(fileData);
    }
  } catch (error) {
    console.error('Error serving direct file from MongoDB Atlas:', error);
    return res.status(500).send('Error retrieving file.');
  }
}

/**
 * Get metadata for a specific file (fast, excludes binary data)
 */
async function getFileMetadata(req, res) {
  const filename = req.params.filename;
  try {
    const file = await fileService.findByStoredName(filename);
    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File not found.'
      });
    }

    return res.status(200).json({
      success: true,
      file: {
        shortId: file.shortId,
        storedName: file.storedName,
        originalName: file.originalName,
        extension: file.extension,
        mimeType: file.mimeType,
        size: file.size,
        url: file.url,
        views: file.views,
        createdAt: file.createdAt
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve file metadata.'
    });
  }
}

/**
 * System stats
 */
async function getStats(req, res) {
  try {
    const stats = await fileService.getStats();
    return res.status(200).json({
      success: true,
      service: 'Streamcal',
      status: 'operational',
      storage: 'MongoDB Atlas',
      maxFileSizeMb: config.maxFileSizeMb,
      ...stats
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

module.exports = {
  serveDirectFile,
  getFileMetadata,
  getStats
};
