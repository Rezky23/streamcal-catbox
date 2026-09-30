const mime = require('mime-types');
const path = require('path');

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function getCleanExtension(filename, mimeType) {
  let ext = path.extname(filename || '').toLowerCase().replace(/^\./, '');
  if (!ext && mimeType) {
    const extFromMime = mime.extension(mimeType);
    if (extFromMime) ext = extFromMime;
  }
  // Standardize common types
  if (ext === 'jpeg') ext = 'jpg';
  return ext;
}

function isValidHttpUrl(string) {
  let url;
  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }
  return url.protocol === 'http:' || url.protocol === 'https:';
}

module.exports = {
  formatBytes,
  getCleanExtension,
  isValidHttpUrl
};
