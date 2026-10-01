const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema(
  {
    shortId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },
    storedName: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    originalName: {
      type: String,
      required: true
    },
    extension: {
      type: String,
      default: ''
    },
    mimeType: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    hash: {
      type: String,
      index: true,
      default: null
    },
    url: {
      type: String,
      required: true
    },
    // Binary file data stored directly in MongoDB Atlas (max 2MB, within 16MB doc limit)
    data: {
      type: Buffer,
      required: true,
      select: false // Excluded from default queries for high performance metadata lookups
    },
    views: {
      type: Number,
      default: 0
    },
    uploaderIp: {
      type: String,
      default: null
    },
    source: {
      type: String,
      enum: ['web_upload', 'url_upload', 'api', 'downloader_import'],
      default: 'web_upload'
    },
    // Expiration timestamp for temporary files (e.g. 10 minutes auto-delete for downloader media)
    expiresAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// TTL index for automatic expiration in MongoDB Atlas (documents expire when expiresAt <= now)
fileSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for fast lookup
fileSchema.index({ hash: 1, size: 1 });
fileSchema.index({ createdAt: -1 });

const File = mongoose.model('File', fileSchema);

module.exports = File;
