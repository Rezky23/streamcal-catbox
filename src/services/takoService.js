const axios = require('axios');
const crypto = require('crypto');
const config = require('../config/env');
const db = require('../config/db');
const Support = require('../models/Support');

// In-memory fallback if MongoDB Atlas is offline or not configured
const memorySupports = [];

class TakoService {
  constructor() {
    this.baseUrl = 'https://tako.id';
  }

  /**
   * Check if Tako integration has required API credentials
   */
  isConfigured() {
    return Boolean(config.takoApiKey && config.takoUsername);
  }

  getUsername() {
    return config.takoUsername || 'streamcal';
  }

  /**
   * Send Gift / Donation via Tako API (POST /api/v1/gift/{username})
   */
  async createGift({ name, email, amount, paymentMethod = 'qris', message = '' }) {
    if (!this.isConfigured()) {
      throw new Error('Tako API is not configured yet. Please set TAKO_API_KEY and TAKO_USERNAME in .env');
    }

    const targetUsername = config.takoUsername.trim();
    const endpoint = `${this.baseUrl}/api/v1/gift/${encodeURIComponent(targetUsername)}`;

    const payload = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      amount: Number(amount),
      paymentMethod: paymentMethod.toLowerCase(),
      message: (message || '').trim().slice(0, 200)
    };

    try {
      const response = await axios.post(endpoint, payload, {
        headers: {
          'Authorization': `Bearer ${config.takoApiKey}`,
          'User-Agent': 'Streamcal/1.0',
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 15000,
        validateStatus: status => (status >= 200 && status < 300) || status === 206
      });

      const resData = response.data;
      const result = resData.result || resData.data || resData;

      const rawPaymentUrl = result.paymentUrl || (result.transaction ? result.transaction.paymentUrl : '');
      const safePaymentUrl = (rawPaymentUrl && typeof rawPaymentUrl === 'string' && /^https:\/\//i.test(rawPaymentUrl))
        ? rawPaymentUrl
        : '';

      const record = {
        giftId: result.giftId || null,
        transactionId: result.transactionId || null,
        username: targetUsername,
        name: payload.name,
        email: payload.email,
        amount: payload.amount,
        paymentMethod: payload.paymentMethod,
        paymentUrl: safePaymentUrl,
        message: payload.message,
        status: 'pending',
        createdAt: new Date()
      };

      // Persist record
      await this.saveSupportRecord(record);

      return {
        success: true,
        giftId: record.giftId,
        transactionId: record.transactionId,
        paymentUrl: record.paymentUrl,
        amount: record.amount,
        name: record.name,
        paymentMethod: record.paymentMethod
      };
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data?.error || err.message;
      const statusCode = err.response?.status;
      const error = new Error(`Tako API Error: ${errMsg}`);
      error.statusCode = statusCode || 500;
      error.details = err.response?.data;
      throw error;
    }
  }

  /**
   * Check Gift Status from Tako API (GET /api/v1/gift/{giftId})
   */
  async getGiftStatus(giftId) {
    if (!this.isConfigured()) {
      throw new Error('Tako API is not configured yet');
    }

    const cleanGiftId = String(giftId || '').trim();
    if (!/^[a-zA-Z0-9_\-\.]{1,100}$/.test(cleanGiftId)) {
      throw new Error('Invalid giftId format');
    }

    const endpoint = `${this.baseUrl}/api/v1/gift/${encodeURIComponent(cleanGiftId)}`;

    try {
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${config.takoApiKey}`,
          'User-Agent': 'Streamcal/1.0',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      const resData = response.data;
      const result = resData.result || resData.data || resData;

      // Update in database if status changed
      if (result && result.status) {
        await this.updateStatus(cleanGiftId, result.status);
      }

      return result;
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data?.error || err.message;
      const error = new Error(`Failed to check gift status: ${errMsg}`);
      error.statusCode = err.response?.status || 500;
      throw error;
    }
  }

  /**
   * Check Transaction Status (GET /api/v1/transactions/{transactionId})
   */
  async getTransactionStatus(transactionId) {
    if (!this.isConfigured()) {
      throw new Error('Tako API is not configured yet');
    }

    const cleanTxId = String(transactionId || '').trim();
    if (!/^[a-zA-Z0-9_\-\.]{1,100}$/.test(cleanTxId)) {
      throw new Error('Invalid transactionId format');
    }

    const endpoint = `${this.baseUrl}/api/v1/transactions/${encodeURIComponent(cleanTxId)}`;

    try {
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${config.takoApiKey}`,
          'User-Agent': 'Streamcal/1.0',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      return response.data?.result || response.data;
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message;
      const error = new Error(`Failed to check transaction: ${errMsg}`);
      error.statusCode = err.response?.status || 500;
      throw error;
    }
  }

  /**
   * Verify Webhook Signature (HMAC-SHA256)
   */
  verifyWebhookSignature(rawBody, signature) {
    if (!config.takoWebhookSecret) return true; // Signature check skipped if no secret set
    if (!signature) return false;

    try {
      const hmac = crypto.createHmac('sha256', config.takoWebhookSecret);
      const computed = hmac.update(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody)).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  /**
   * Save support entry to MongoDB Atlas or local memory
   */
  async saveSupportRecord(record) {
    if (db.isConnected()) {
      try {
        const doc = await Support.create(record);
        return doc;
      } catch (err) {
        console.error('Error saving support record in MongoDB:', err.message);
      }
    }
    memorySupports.unshift(record);
    if (memorySupports.length > 50) memorySupports.pop();
    return record;
  }

  /**
   * Update status of support entry
   */
  async updateStatus(giftOrTransactionId, status) {
    if (!giftOrTransactionId || typeof giftOrTransactionId !== 'string') return;
    const cleanId = giftOrTransactionId.trim();
    if (!/^[a-zA-Z0-9_\-\.]{1,100}$/.test(cleanId)) return;
    const safeStatus = ['pending', 'success', 'failed', 'cancelled', 'expired', 'reversed'].includes(status)
      ? status
      : 'pending';

    if (db.isConnected()) {
      try {
        await Support.updateOne(
          { $or: [{ giftId: cleanId }, { transactionId: cleanId }] },
          { $set: { status: safeStatus } }
        ).exec();
      } catch (err) {
        console.error('Error updating status in MongoDB:', err.message);
      }
    }

    // Memory fallback update
    const memItem = memorySupports.find(
      s => s.giftId === cleanId || s.transactionId === cleanId
    );
    if (memItem) {
      memItem.status = safeStatus;
    }
  }

  /**
   * Get list of recent successful supporters
   */
  async getRecentSupporters(limit = 10) {
    if (db.isConnected()) {
      try {
        const supporters = await Support.find({ status: 'success' })
          .sort({ createdAt: -1 })
          .limit(limit)
          .select('name amount message createdAt paymentMethod')
          .lean();
        return supporters;
      } catch (err) {
        console.error('Error fetching supporters from MongoDB:', err.message);
      }
    }

    return memorySupports
      .filter(s => s.status === 'success')
      .slice(0, limit)
      .map(s => ({
        name: s.name,
        amount: s.amount,
        message: s.message,
        createdAt: s.createdAt,
        paymentMethod: s.paymentMethod
      }));
  }
}

module.exports = new TakoService();
