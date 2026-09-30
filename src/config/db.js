const mongoose = require('mongoose');
const config = require('./env');

let cachedPromise = null;
let isDbConnected = false;

const connectDB = async () => {
  // If already connected, reuse existing connection
  if (mongoose.connection.readyState === 1) {
    isDbConnected = true;
    return true;
  }

  if (!config.mongoUri || config.mongoUri.trim() === '') {
    console.warn('\x1b[33m%s\x1b[0m', '⚠️  [MongoDB Atlas] MONGODB_URI is empty. Running with in-memory fallback.');
    console.warn('\x1b[36m%s\x1b[0m', '💡  To store files permanently, provide MONGODB_URI (e.g. in Vercel Environment Variables).');
    return false;
  }

  // Reuse existing pending connection promise in serverless environments
  if (!cachedPromise) {
    mongoose.set('strictQuery', false);
    cachedPromise = mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 8000,
      autoIndex: process.env.NODE_ENV !== 'production',
      maxPoolSize: 10
    }).then((conn) => {
      isDbConnected = true;
      console.log('\x1b[32m%s\x1b[0m', '✅  [MongoDB Atlas] Successfully connected to database cluster!');
      return conn;
    }).catch((error) => {
      cachedPromise = null;
      isDbConnected = false;
      console.error('\x1b[31m%s\x1b[0m', `❌  [MongoDB Atlas] Connection error: ${error.message}`);
      return false;
    });
  }

  await cachedPromise;
  return isDbConnected;
};

mongoose.connection.on('disconnected', () => {
  isDbConnected = false;
  cachedPromise = null;
  console.warn('⚠️  [MongoDB Atlas] Disconnected.');
});

mongoose.connection.on('reconnected', () => {
  isDbConnected = true;
  console.log('✅  [MongoDB Atlas] Reconnected.');
});

module.exports = {
  connectDB,
  isConnected: () => mongoose.connection.readyState === 1
};
