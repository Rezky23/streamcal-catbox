const axios = require('axios');
const path = require('path');
const mime = require('mime-types');
const config = require('../config/env');
const downloaderService = require('../services/downloaderService');
const fileService = require('../services/fileService');
const { calculateBufferHash } = require('../utils/hash');
const { generateShortId } = require('../utils/idGenerator');
const { getCleanExtension, isValidHttpUrl, isSafePublicUrl } = require('../utils/helpers');

/**
 * Resolve YouTube or TikTok video/audio details and download links
 */
async function resolveMedia(req, res) {
  try {
    const { url } = req.body;
    if (!url || !isSafePublicUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'Silakan masukkan tautan (URL) publik yang valid.'
      });
    }

    const media = await downloaderService.resolveMedia(url);
    return res.status(200).json({
      success: true,
      data: media
    });
  } catch (error) {
    console.error('Downloader resolve error:', error.message);
    return res.status(400).json({
      success: false,
      error: error.message || 'Gagal memproses tautan media.'
    });
  }
}

/**
 * Proxy stream media so browser triggers direct file download
 */
async function streamDownload(req, res) {
  try {
    const { url, filename } = req.query;
    if (!url || !isSafePublicUrl(url)) {
      return res.status(400).send('Invalid or restricted URL');
    }

    const safeFilename = (filename || 'media')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_');

    const ext = path.extname(safeFilename).replace('.', '').toLowerCase();
    const contentType = mime.lookup(ext) || 'application/octet-stream';

    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': url.includes('tikwm.com') ? 'https://www.tikwm.com/' : undefined
      }
    });

    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Type', response.headers['content-type'] || contentType);
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }

    response.data.pipe(res);
  } catch (error) {
    console.error('Stream download error:', error.message);
    if (!res.headersSent) {
      res.status(500).send('Gagal mengunduh berkas media.');
    }
  }
}

/**
 * Save resolved media (e.g. TikTok/YouTube audio) directly to Streamcal MongoDB Atlas
 * (Only if size <= 2MB limit)
 */
async function saveToStreamcal(req, res) {
  try {
    const { url, title, format = 'mp3' } = req.body;
    if (!url || !isValidHttpUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'Tautan media tidak valid.'
      });
    }

    const maxSizeBytes = config.maxFileSizeMb * 1024 * 1024; // 2MB

    // Download media into memory buffer
    const response = await axios({
      method: 'GET',
      url,
      responseType: 'arraybuffer',
      maxContentLength: maxSizeBytes,
      maxBodyLength: maxSizeBytes,
      timeout: 25000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Streamcal/1.0',
        'Referer': url.includes('tikwm.com') ? 'https://www.tikwm.com/' : undefined
      }
    });

    const buffer = Buffer.from(response.data);

    if (buffer.length > maxSizeBytes) {
      return res.status(400).json({
        success: false,
        error: `Ukuran media (${(buffer.length / (1024 * 1024)).toFixed(2)}MB) melebihi batas 2MB Streamcal. Gunakan tombol 'Download' untuk menyimpannya ke perangkat.`
      });
    }

    const shortId = generateShortId(6);
    const cleanExt = (format || 'mp3').replace('.', '').toLowerCase();
    const storedName = `${shortId}.${cleanExt}`;
    const directUrl = `${config.baseUrl}/${storedName}`;
    const hash = calculateBufferHash(buffer);
    const mimeType = mime.lookup(cleanExt) || 'audio/mpeg';

    const safeTitle = (title || 'media_audio')
      .replace(/[^a-zA-Z0-9\s._-]/g, '')
      .trim();

    const originalName = `${safeTitle || shortId}.${cleanExt}`;

    // Otomatis terhapus setelah 10 menit (600.000 ms)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const fileData = {
      shortId,
      storedName,
      originalName,
      extension: cleanExt,
      mimeType,
      size: buffer.length,
      hash,
      data: buffer,
      url: directUrl,
      uploaderIp: req.ip || req.headers['x-forwarded-for'] || null,
      source: 'downloader_import',
      expiresAt: expiresAt
    };

    const saved = await fileService.saveFile(fileData);

    return res.status(200).json({
      success: true,
      file: {
        shortId: saved.shortId,
        name: saved.originalName,
        storedName: saved.storedName,
        url: saved.url,
        size: saved.size,
        mimeType: saved.mimeType,
        extension: saved.extension,
        expiresAt: expiresAt,
        expiresIn: '10 menit'
      }
    });
  } catch (error) {
    console.error('Save to Streamcal error:', error.message);
    const isSizeError = error.message && error.message.includes('maxContentLength');
    return res.status(400).json({
      success: false,
      error: isSizeError
        ? `Ukuran media melebihi batas ${config.maxFileSizeMb}MB Streamcal.`
        : (error.message || 'Gagal menyimpan media ke Streamcal.')
    });
  }
}

module.exports = {
  resolveMedia,
  streamDownload,
  saveToStreamcal
};
