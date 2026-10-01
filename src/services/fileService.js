const File = require('../models/File');
const db = require('../config/db');
const config = require('../config/env');

// In-memory fallback map if MongoDB Atlas is not yet connected during local dev
const memoryStore = new Map();

class FileService {
  /**
   * Save or find existing file
   */
  async saveFile(fileData) {
    if (db.isConnected()) {
      try {
        // Optional Deduplication: check if exact file hash already exists
        if (fileData.hash) {
          const existing = await File.findOne({ hash: fileData.hash, size: fileData.size });
          if (existing) {
            return existing;
          }
        }

        const newFile = await File.create(fileData);
        return newFile;
      } catch (err) {
        console.error('Error saving file in MongoDB Atlas, using fallback:', err.message);
      }
    }

    // Fallback in-memory store
    memoryStore.set(fileData.storedName, fileData);
    memoryStore.set(fileData.shortId, fileData);
    return fileData;
  }

  /**
   * Find file metadata by storedName or shortId (without binary data)
   */
  async findByStoredName(name) {
    const cleanName = name.replace(/^\/+/, '');
    const shortId = cleanName.split('.')[0];

    if (db.isConnected()) {
      try {
        const file = await File.findOne({
          $or: [
            { storedName: cleanName },
            { shortId: shortId }
          ]
        });

        if (file) {
          // If file is past its expiration time (e.g. 10 minutes auto-delete), purge and return null
          if (file.expiresAt && new Date(file.expiresAt) <= new Date()) {
            File.deleteOne({ _id: file._id }).exec();
            return null;
          }

          File.updateOne({ _id: file._id }, { $inc: { views: 1 } }).exec();
          return file;
        }
      } catch (err) {
        console.error('Error querying MongoDB Atlas:', err.message);
      }
    }

    // Fallback store
    if (memoryStore.has(cleanName)) {
      const f = memoryStore.get(cleanName);
      if (f.expiresAt && new Date(f.expiresAt) <= new Date()) {
        memoryStore.delete(cleanName);
        memoryStore.delete(f.shortId);
        return null;
      }
      f.views = (f.views || 0) + 1;
      return f;
    }
    if (memoryStore.has(shortId)) {
      const f = memoryStore.get(shortId);
      if (f.expiresAt && new Date(f.expiresAt) <= new Date()) {
        memoryStore.delete(f.storedName);
        memoryStore.delete(shortId);
        return null;
      }
      f.views = (f.views || 0) + 1;
      return f;
    }

    return null;
  }

  /**
   * Get file with binary data Buffer for direct serving
   */
  async getFileWithData(name) {
    const cleanName = name.replace(/^\/+/, '');
    const shortId = cleanName.split('.')[0];

    if (db.isConnected()) {
      try {
        const file = await File.findOne({
          $or: [
            { storedName: cleanName },
            { shortId: shortId }
          ]
        }).select('+data');

        if (file) {
          // If file is past its expiration time (e.g. 10 minutes auto-delete), purge and return null
          if (file.expiresAt && new Date(file.expiresAt) <= new Date()) {
            File.deleteOne({ _id: file._id }).exec();
            return null;
          }

          File.updateOne({ _id: file._id }, { $inc: { views: 1 } }).exec();
          return file;
        }
      } catch (err) {
        console.error('Error querying file with data from MongoDB Atlas:', err.message);
      }
    }

    // Fallback store
    if (memoryStore.has(cleanName)) {
      const f = memoryStore.get(cleanName);
      if (f.expiresAt && new Date(f.expiresAt) <= new Date()) {
        memoryStore.delete(cleanName);
        memoryStore.delete(f.shortId);
        return null;
      }
      f.views = (f.views || 0) + 1;
      return f;
    }
    if (memoryStore.has(shortId)) {
      const f = memoryStore.get(shortId);
      if (f.expiresAt && new Date(f.expiresAt) <= new Date()) {
        memoryStore.delete(f.storedName);
        memoryStore.delete(shortId);
        return null;
      }
      f.views = (f.views || 0) + 1;
      return f;
    }

    return null;
  }

  /**
   * Get server stats (total files, views, etc.)
   */
  async getStats() {
    if (db.isConnected()) {
      try {
        const totalFiles = await File.countDocuments();
        const totalSizeAgg = await File.aggregate([
          { $group: { _id: null, totalBytes: { $sum: '$size' }, totalViews: { $sum: '$views' } } }
        ]);
        return {
          connectedToAtlas: true,
          totalFiles,
          totalBytes: totalSizeAgg[0]?.totalBytes || 0,
          totalViews: totalSizeAgg[0]?.totalViews || 0
        };
      } catch (_) {}
    }

    return {
      connectedToAtlas: false,
      totalFiles: memoryStore.size,
      totalBytes: 0,
      totalViews: 0
    };
  }
}

module.exports = new FileService();
