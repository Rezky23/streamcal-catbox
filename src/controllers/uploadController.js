const path = require('path');
const axios = require('axios');
const mime = require('mime-types');
const config = require('../config/env');
const fileService = require('../services/fileService');
const { calculateBufferHash } = require('../utils/hash');
const { generateShortId } = require('../utils/idGenerator');
const { getCleanExtension, isValidHttpUrl, isSafePublicUrl, isAllowedExtension, sanitizeSvgBuffer } = require('../utils/helpers');

/**
 * Handle multipart file uploads (single or batch) in memory
 */
async function uploadFiles(req, res) {
  try {
    const rawFiles = req.files || (req.file ? [req.file] : []);

    if (!rawFiles || rawFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files were provided for upload.'
      });
    }

    const results = [];

    for (const file of rawFiles) {
      let buffer = file.buffer;
      const ext = file.streamcalExt || getCleanExtension(file.originalname, file.mimetype);

      // Security: Strip dangerous script and event handler tags from SVGs
      if (ext === 'svg' || (file.mimetype && file.mimetype.toLowerCase() === 'image/svg+xml')) {
        buffer = sanitizeSvgBuffer(buffer);
      }

      const hash = calculateBufferHash(buffer);
      const shortId = file.streamcalShortId || generateShortId(6);
      const storedName = file.streamcalFilename || (ext ? `${shortId}.${ext}` : shortId);
      const directUrl = `${config.baseUrl}/${storedName}`;

      const fileData = {
        shortId,
        storedName,
        originalName: file.originalname || storedName,
        extension: ext,
        mimeType: file.mimetype || 'application/octet-stream',
        size: buffer.length,
        hash,
        data: buffer, // Saved directly to MongoDB Atlas
        url: directUrl,
        uploaderIp: req.ip || req.headers['x-forwarded-for'] || null,
        source: 'web_upload'
      };

      const saved = await fileService.saveFile(fileData);

      results.push({
        shortId: saved.shortId,
        name: saved.originalName,
        storedName: saved.storedName,
        url: saved.url,
        size: saved.size,
        mimeType: saved.mimeType,
        extension: saved.extension
      });
    }

    return res.status(200).json({
      success: true,
      files: results,
      url: results[0].url
    });
  } catch (error) {
    console.error('Upload handler error:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while processing the upload.'
    });
  }
}

/**
 * Handle remote file upload from URL completely in memory
 */
async function uploadFromUrl(req, res) {
  const { url } = req.body;

  if (!url || !isSafePublicUrl(url)) {
    return res.status(400).json({
      success: false,
      error: 'URL tidak valid atau mengarah ke alamat yang tidak diizinkan.'
    });
  }

  const shortId = generateShortId(6);

  try {
    const maxSizeBytes = config.maxFileSizeMb * 1024 * 1024;

    // Optional quick HEAD pre-check
    const headResponse = await axios.head(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Streamcal/1.0'
      }
    }).catch(() => null);

    if (headResponse) {
      const contentLength = headResponse.headers['content-length'];
      if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) {
        return res.status(400).json({
          success: false,
          error: `File melebihi batas ukuran maksimal ${config.maxFileSizeMb}MB.`
        });
      }

      const headType = (headResponse.headers['content-type'] || '').toLowerCase();
      if (headType && !headType.startsWith('application/octet-stream')) {
        const cleanHeadType = headType.split(';')[0].trim();
        if (!cleanHeadType.startsWith('image/') && !cleanHeadType.startsWith('audio/')) {
          return res.status(400).json({
            success: false,
            error: 'Hanya file gambar (image) dan audio yang diperbolehkan!'
          });
        }
      }
    }

    // Download directly into memory buffer (serverless safe)
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'arraybuffer',
      maxContentLength: maxSizeBytes,
      maxBodyLength: maxSizeBytes,
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Streamcal/1.0'
      }
    });

    let buffer = Buffer.from(response.data);

    if (buffer.length > maxSizeBytes) {
      return res.status(400).json({
        success: false,
        error: `File melebihi batas ukuran maksimal ${config.maxFileSizeMb}MB.`
      });
    }

    const rawContentType = (response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    const parsedUrl = new URL(url);
    const urlFilename = path.basename(parsedUrl.pathname) || 'file';
    let ext = getCleanExtension(urlFilename, rawContentType);

    // Security check: Extension must be in strict media allowlist
    if (!isAllowedExtension(ext)) {
      return res.status(400).json({
        success: false,
        error: 'Hanya file gambar (image) dan audio yang diperbolehkan!'
      });
    }

    let finalMime = rawContentType || (ext ? mime.lookup(ext) : '') || 'application/octet-stream';
    if (finalMime === 'application/octet-stream' && ext) {
      const guessed = mime.lookup(ext);
      if (guessed) finalMime = guessed;
    }

    // Final security check: ensure file MIME is image or audio
    if (!finalMime.startsWith('image/') && !finalMime.startsWith('audio/')) {
      return res.status(400).json({
        success: false,
        error: 'Hanya file gambar (image) dan audio yang diperbolehkan!'
      });
    }

    // Security: Sanitize SVG files
    if (ext === 'svg' || finalMime === 'image/svg+xml') {
      buffer = sanitizeSvgBuffer(buffer);
    }

    const storedName = ext ? `${shortId}.${ext}` : shortId;
    const directUrl = `${config.baseUrl}/${storedName}`;
    const hash = calculateBufferHash(buffer);

    const fileData = {
      shortId,
      storedName,
      originalName: urlFilename,
      extension: ext,
      mimeType: finalMime,
      size: buffer.length,
      hash,
      data: buffer, // Saved directly to MongoDB Atlas
      url: directUrl,
      uploaderIp: req.ip || req.headers['x-forwarded-for'] || null,
      source: 'url_upload'
    };

    const saved = await fileService.saveFile(fileData);

    return res.status(200).json({
      success: true,
      files: [{
        shortId: saved.shortId,
        name: saved.originalName,
        storedName: saved.storedName,
        url: saved.url,
        size: saved.size,
        mimeType: saved.mimeType,
        extension: saved.extension
      }],
      url: saved.url
    });
  } catch (error) {
    console.error('URL upload error:', error.message);
    const isSizeError = error.message && error.message.includes('maxContentLength');
    return res.status(400).json({
      success: false,
      error: isSizeError
        ? `File melebihi batas ukuran maksimal ${config.maxFileSizeMb}MB.`
        : (error.message || 'Failed to download file from the provided URL.')
    });
  }
}

module.exports = {
  uploadFiles,
  uploadFromUrl
};
