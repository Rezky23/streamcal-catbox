const fs = require('fs');
const crypto = require('crypto');

/**
 * Calculate SHA-256 hash of an in-memory buffer
 * @param {Buffer} buffer
 * @returns {string}
 */
function calculateBufferHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Calculate SHA-256 hash of a file via streams (fallback)
 * @param {string} filePath 
 * @returns {Promise<string>}
 */
function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

module.exports = {
  calculateBufferHash,
  calculateFileHash
};
