const express = require('express');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config/env');
const { connectDB } = require('./config/db');
const apiRoutes = require('./routes/api');
const webRoutes = require('./routes/web');
const errorHandler = require('./middlewares/errorHandler');

// Streamcal High-Speed Server (MongoDB Atlas + Serverless Vercel ready)
const app = express();

// Trust reverse proxies (e.g. Cloudflare, Nginx)
app.set('trust proxy', 1);

// HTTP Compression (drastically reduces network transfer for ultra-fast browser loading)
app.use(compression());

// CORS configuration (allow embedding images anywhere e.g. forums, Discord, websites)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// Helmet security headers (with cross-origin resource policy set to cross-origin so images load anywhere)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
  xContentTypeOptions: true,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      mediaSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      connectSrc: ["'self'", "https:", "http:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: config.nodeEnv === 'production' ? [] : null
    }
  }
}));

// Logging in development mode
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// Request parsers for JSON and URL-encoded data
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure database connection is ready for requests
app.use(async (req, res, next) => {
  if (config.mongoUri && !require('./config/db').isConnected()) {
    try {
      await connectDB();
    } catch (_) {}
  }
  next();
});

// Serve static frontend assets (clean, vanilla, ultra-lightweight)
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  etag: true
}));

// Mount API routes
app.use('/api', apiRoutes);

// Direct file serving routes (e.g. /a1b2c3.png)
app.use('/', webRoutes);

// Centralized Error Handling
app.use(errorHandler);

// 404 Handler
app.use((req, res) => {
  if (req.accepts('html')) {
    return res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  return res.status(404).json({ success: false, error: 'Resource not found' });
});

// Start Server locally if not running on Vercel
if (process.env.VERCEL !== '1') {
  async function startServer() {
    await connectDB();
    app.listen(config.port, () => {
      console.log('====================================================');
      console.log(`🚀 Streamcal Server running at: ${config.baseUrl}`);
      console.log(`⚡ Max file size: ${config.maxFileSizeMb} MB`);
      console.log(`☁️  Storage: MongoDB Atlas (Direct Binary Storage)`);
      console.log('====================================================');
    });
  }
  startServer();
} else {
  connectDB().catch(err => console.error('MongoDB Atlas connection error:', err.message));
}

module.exports = app;
