const path = require('path');
require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  baseUrl: process.env.BASE_URL ? process.env.BASE_URL.replace(/\/+$/, '') : 'http://localhost:3000',
  mongoUri: process.env.MONGODB_URI || '',
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 2,
  uploadDir: path.resolve(process.env.UPLOAD_DIR || './uploads'),
  nodeEnv: process.env.NODE_ENV || 'development',
  // Tako.id Donation Integration (https://tako.id/api-docs)
  takoApiKey: process.env.TAKO_API_KEY || '',
  takoUsername: process.env.TAKO_USERNAME || '',
  takoWebhookSecret: process.env.TAKO_WEBHOOK_SECRET || ''
};

module.exports = config;
