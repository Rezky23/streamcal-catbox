const takoService = require('../services/takoService');

class SupportController {
  /**
   * Get public configuration and creator details
   */
  async getConfig(req, res) {
    try {
      const isConfigured = takoService.isConfigured();
      const username = takoService.getUsername();
      const recentSupporters = await takoService.getRecentSupporters(8);

      return res.json({
        success: true,
        data: {
          isConfigured,
          username,
          profileUrl: `https://tako.id/${encodeURIComponent(username)}`,
          supportedCountries: [
            { id: 'id', name: 'Indonesia', flag: '🇮🇩', currency: 'IDR', prefix: 'Rp' },
            { id: 'my', name: 'Malaysia', flag: '🇲🇾', currency: 'MYR', prefix: 'RM' },
            { id: 'sg', name: 'Singapore', flag: '🇸🇬', currency: 'SGD', prefix: 'S$' },
            { id: 'us', name: 'United States', flag: '🇺🇸', currency: 'USD', prefix: '$' }
          ],
          supportedMethods: [
            { id: 'qris', name: 'QRIS', desc: 'Scan via BCA, Mandiri, BRI, DANA, GoPay, OVO & Cross-Border ASEAN (DuitNow MY 🇲🇾, PayNow/NETS SG 🇸🇬)', icon: 'qris' },
            { id: 'gopay', name: 'GoPay', desc: 'Bayar instan via GoPay Indonesia 🇮🇩', icon: 'gopay' },
            { id: 'dana', name: 'DANA', desc: 'Bayar instan via DANA Wallet Indonesia 🇮🇩', icon: 'dana' },
            { id: 'paypal', name: 'PayPal / Cards', desc: 'United States 🇺🇸 & International Credit/Debit Card (USD, MYR, SGD)', icon: 'paypal' }
          ],
          presetAmounts: [10000, 25000, 50000, 100000, 200000],
          recentSupporters
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Create donation / gift transaction via Tako API
   */
  async createSupport(req, res) {
    try {
      const { name, email, amount, paymentMethod = 'qris', message = '' } = req.body;

      // Validation
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ success: false, error: 'Nama pendukung wajib diisi' });
      }

      if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({ success: false, error: 'Alamat email valid wajib diisi untuk konfirmasi pembayaran' });
      }

      const numAmount = parseInt(amount, 10);
      if (isNaN(numAmount) || numAmount < 1000) {
        return res.status(400).json({ success: false, error: 'Nominal dukungan minimal Rp 1.000' });
      }

      if (numAmount > 50000000) {
        return res.status(400).json({ success: false, error: 'Nominal dukungan maksimal Rp 50.000.000' });
      }

      const validMethods = ['qris', 'gopay', 'dana', 'paypal'];
      const method = (paymentMethod || 'qris').toLowerCase();
      if (!validMethods.includes(method)) {
        return res.status(400).json({ success: false, error: `Metode pembayaran tidak valid. Pilihan: ${validMethods.join(', ')}` });
      }

      // Check if Tako credentials are setup
      if (!takoService.isConfigured()) {
        const username = takoService.getUsername();
        return res.status(200).json({
          success: false,
          isConfigured: false,
          fallbackUrl: `https://tako.id/${encodeURIComponent(username)}`,
          message: 'Tako API Key belum diatur di .env. Anda dapat berdonasi langsung melalui tautan profil kreator Tako.'
        });
      }

      // Create gift via Tako API
      const result = await takoService.createGift({
        name,
        email,
        amount: numAmount,
        paymentMethod: method,
        message
      });

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      const status = err.statusCode || 500;
      return res.status(status).json({
        success: false,
        error: err.message,
        details: err.details || null
      });
    }
  }

  /**
   * Check Gift or Transaction Status
   */
  async checkStatus(req, res) {
    try {
      const { giftId } = req.params;
      if (!giftId) {
        return res.status(400).json({ success: false, error: 'giftId is required' });
      }

      if (!takoService.isConfigured()) {
        return res.status(400).json({ success: false, error: 'Tako API is not configured' });
      }

      const statusData = await takoService.getGiftStatus(giftId);
      return res.json({
        success: true,
        data: statusData
      });
    } catch (err) {
      return res.status(err.statusCode || 500).json({
        success: false,
        error: err.message
      });
    }
  }

  /**
   * Get Recent Supporters list
   */
  async getRecentSupporters(req, res) {
    try {
      const supporters = await takoService.getRecentSupporters(15);
      return res.json({
        success: true,
        data: supporters
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Handle Webhook from Tako
   */
  async handleWebhook(req, res) {
    try {
      const signature = req.headers['x-tako-signature'];
      const rawBody = req.body;

      if (!takoService.verifyWebhookSignature(rawBody, signature)) {
        return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
      }

      const event = req.body?.event;
      const data = req.body?.data;

      if (event === 'payment.success' && data) {
        const giftId = data.relatedGiftId || data.id;
        if (giftId) {
          await takoService.updateStatus(giftId, 'success');
        }
      }

      return res.json({ success: true, message: 'Webhook received' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = new SupportController();
