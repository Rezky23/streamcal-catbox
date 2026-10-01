const { recognizeBytes } = require('shazamio-core');
const axios = require('axios');
const crypto = require('crypto');

class RecognizerService {
  /**
   * Generate UUID v4 for Shazam request tracking
   */
  _generateUUID() {
    return crypto.randomUUID();
  }

  /**
   * Send HTTP recognition request directly to Shazam's mobile discovery API
   */
  async _sendShazamRequest(sig, timezone = 'Asia/Jakarta', language = 'en-US') {
    const uuid1 = this._generateUUID();
    const uuid2 = this._generateUUID();
    const url = `https://amp.shazam.com/discovery/v5/${language}/US/iphone/-/tag/${uuid1}/${uuid2}?sync=true&webv3=true&sampling=true&connected=&shazamapiversion=v3&sharehub=true&hubv5minorversion=v5.1&hidelb=true&video=v3`;

    const body = {
      timezone: timezone,
      signature: {
        uri: sig.uri,
        samplems: sig.samplems,
      },
      timestamp: Date.now(),
      context: {},
      geolocation: {},
    };

    const response = await axios.post(url, body, {
      headers: {
        'X-Shazam-Platform': 'IPHONE',
        'X-Shazam-AppVersion': '14.1.0',
        'Accept': '*/*',
        'Content-Type': 'application/json',
        'Accept-Language': language,
        'User-Agent': 'Shazam/14.1.0 (iPhone; iOS 14.7.1; Scale/3.00)'
      },
      timeout: 10000
    });

    return response.data;
  }

  /**
   * Identify music from an audio Buffer using Shazam WebAssembly fingerprinting
   * @param {Buffer} buffer - Raw audio file buffer (mp3, wav, ogg, m4a, webm, etc.)
   * @returns {Promise<Object>} Formatted song details or matched: false
   */
  async recognizeBuffer(buffer) {
    if (!buffer || buffer.length === 0) {
      throw new Error('File audio kosong atau tidak terbaca.');
    }

    let signatures = [];

    try {
      signatures = recognizeBytes(buffer, 0, Number.MAX_SAFE_INTEGER);
    } catch (err) {
      console.error('[RecognizerService] Fingerprint extraction error:', err.message);
      throw new Error('Gagal mengekstrak sidik jari audio (fingerprint). Pastikan format audio valid.');
    }

    if (!signatures || signatures.length === 0) {
      return {
        matched: false,
        message: 'Tidak dapat mengekstrak audio signature. Coba file audio dengan durasi minimal 4-5 detik.'
      };
    }

    try {
      let rawResult = null;

      // Try the signatures (top 3 signatures to keep latency low)
      for (let i = 0; i < signatures.length; i++) {
        const sig = signatures[i];

        try {
          const res = await this._sendShazamRequest(sig, 'Asia/Jakarta', 'en-US');

          if (res && Array.isArray(res.matches) && res.matches.length > 0 && res.track) {
            rawResult = res;
            break;
          }
        } catch (apiErr) {
          console.warn(`[RecognizerService] Attempt ${i + 1} request warning:`, apiErr.message);
        }

        if (i >= 2) break;
      }

      if (!rawResult || !rawResult.track) {
        return {
          matched: false,
          message: 'Lagu tidak dapat dikenali di database Shazam. Pastikan audio terdengar jelas tanpa terlalu banyak noise.'
        };
      }

      const track = rawResult.track;
      const title = track.title || 'Unknown Title';
      const artist = track.subtitle || 'Unknown Artist';

      let album = null;
      let label = null;
      let releaseYear = null;
      let genre = track.genres ? (track.genres.primary || Object.values(track.genres)[0]) : null;
      let lyrics = null;

      if (Array.isArray(track.sections)) {
        for (const section of track.sections) {
          if (section.type === 'SONG' && Array.isArray(section.metadata)) {
            for (const item of section.metadata) {
              if (item.title === 'Album') album = item.text;
              if (item.title === 'Label') label = item.text;
              if (item.title === 'Released') releaseYear = item.text;
            }
          }
          if (section.type === 'LYRICS' && Array.isArray(section.text)) {
            lyrics = section.text.join('\n');
          }
        }
      }

      // High-res cover art
      const coverArt = track.images?.coverarthq ||
                       track.images?.coverart ||
                       track.share?.image ||
                       null;

      // 30s iTunes / Apple Music preview audio
      let previewAudio = null;
      if (track.hub?.actions) {
        const audioAction = track.hub.actions.find(a => a.type === 'uri' && a.uri);
        if (audioAction) previewAudio = audioAction.uri;
      }

      // External Links
      const shazamUrl = track.share?.href || track.url || null;
      let appleMusicUrl = null;
      let spotifyUrl = null;

      if (track.hub?.providers) {
        for (const p of track.hub.providers) {
          if (p.type === 'applemusic') {
            appleMusicUrl = p.actions?.[0]?.uri || null;
          }
          if (p.type === 'spotify') {
            spotifyUrl = p.actions?.[0]?.uri || null;
          }
        }
      }

      const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${artist} - ${title}`)}`;

      return {
        matched: true,
        key: track.key,
        title,
        artist,
        album,
        label,
        releaseYear,
        genre,
        coverArt,
        previewAudio,
        shazamUrl,
        appleMusicUrl,
        spotifyUrl,
        youtubeSearchUrl,
        lyrics
      };
    } finally {
      // Free WebAssembly memory pointers
      for (const sig of signatures) {
        try {
          if (sig && typeof sig.free === 'function') sig.free();
        } catch (_) {}
      }
    }
  }

  /**
   * Identify music by downloading audio from a public URL
   * @param {string} audioUrl
   */
  async recognizeFromUrl(audioUrl) {
    if (!audioUrl) throw new Error('URL audio tidak boleh kosong.');

    const res = await axios.get(audioUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxContentLength: 15 * 1024 * 1024, // 15MB
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const buffer = Buffer.from(res.data);
    return this.recognizeBuffer(buffer);
  }
}

module.exports = new RecognizerService();
