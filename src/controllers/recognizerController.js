const recognizerService = require('../services/recognizerService');

class RecognizerController {
  async recognizeAudio(req, res) {
    try {
      let result;

      if (req.file && req.file.buffer) {
        // Audio uploaded via form data
        result = await recognizerService.recognizeBuffer(req.file.buffer);
      } else if (req.body && req.body.url) {
        // Audio recognized from URL
        const audioUrl = req.body.url.trim();
        result = await recognizerService.recognizeFromUrl(audioUrl);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Silakan upload file audio atau masukkan URL audio langsung.'
        });
      }

      if (!result.matched) {
        return res.status(200).json({
          success: false,
          message: result.message || 'Lagu tidak ditemukan.',
          data: result
        });
      }

      return res.json({
        success: true,
        message: 'Lagu berhasil diidentifikasi!',
        data: result
      });
    } catch (error) {
      console.error('[RecognizerController] Error recognizing audio:', error.message);
      return res.status(500).json({
        success: false,
        message: error.message || 'Terjadi kesalahan saat memproses pengenalan audio.'
      });
    }
  }
}

module.exports = new RecognizerController();
