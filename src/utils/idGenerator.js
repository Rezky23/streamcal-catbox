const crypto = require('crypto');

const CHARSET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generate a random short alphanumeric ID similar to Catbox
 * @param {number} length Default is 6 characters
 * @returns {string}
 */
function generateShortId(length = 6) {
  let result = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += CHARSET[randomBytes[i] % CHARSET.length];
  }
  return result;
}

module.exports = {
  generateShortId
};
