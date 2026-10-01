const axios = require('axios');
const crypto = require('crypto');
const btch = require('btch-downloader');

// Savetube constants
const SAVETUBE_KEY = 'C5D58EF67A7584E4A29F6C35BBC4EB12';
const YOUTUBE_REGEX = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|live\/))([a-zA-Z0-9_-]{11})/;
const TIKTOK_REGEX = /tiktok\.com/;

/**
 * Format seconds into readable MM:SS or HH:MM:SS
 */
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const secNum = parseInt(seconds, 10);
  const hours = Math.floor(secNum / 3600);
  const minutes = Math.floor((secNum % 3600) / 60);
  const secs = secNum % 60;
  const pad = (n) => (n < 10 ? '0' + n : n);

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(secs)}`;
  }
  return `${minutes}:${pad(secs)}`;
}

/**
 * Detect media platform from URL
 */
function detectPlatform(url) {
  if (!url || typeof url !== 'string') return null;
  const clean = url.trim().toLowerCase();
  if (clean.includes('youtube.com') || clean.includes('youtu.be')) return 'youtube';
  if (clean.includes('tiktok.com')) return 'tiktok';
  return null;
}

/**
 * Resolve unshortened URL (e.g. vt.tiktok.com or youtu.be redirects)
 */
async function unshortenUrl(url) {
  if (!url) return url;
  if (!url.includes('vt.tiktok.com') && !url.includes('vm.tiktok.com')) {
    return url;
  }
  try {
    const res = await axios.get(url, {
      maxRedirects: 5,
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    return res.request?.res?.responseUrl || res.config?.url || url;
  } catch (err) {
    return url;
  }
}

/**
 * Savetube AES decryptor
 */
function decryptSaveTube(enc) {
  const sr = Buffer.from(enc, 'base64');
  const ky = Buffer.from(SAVETUBE_KEY, 'hex');
  const iv = sr.slice(0, 16);
  const dt = sr.slice(16);
  const dc = crypto.createDecipheriv('aes-128-cbc', ky, iv);
  return JSON.parse(Buffer.concat([dc.update(dt), dc.final()]).toString());
}

/**
 * Resolve YouTube media details & download links
 */
async function resolveYouTube(rawUrl) {
  const match = rawUrl.match(YOUTUBE_REGEX);
  if (!match || !match[1]) {
    throw new Error('URL YouTube tidak valid atau Video ID tidak ditemukan.');
  }
  const videoId = match[1];

  // Try fetching official oEmbed for fast, reliable author and title
  let oembedData = null;
  try {
    const oembedRes = await axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, {
      timeout: 5000
    });
    oembedData = oembedRes.data;
  } catch (_) {}

  const videos = [];
  const audios = [];
  let title = oembedData?.title || 'YouTube Video';
  let author = oembedData?.author_name || 'YouTube Creator';
  let thumbnail = oembedData?.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  let duration = 0;

  // 1. Primary engine: SaveTube VIP CDN
  try {
    const stClient = axios.create({
      timeout: 12000,
      headers: {
        'content-type': 'application/json',
        'origin': 'https://yt.savetube.me',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const cdnRes = await stClient.get('https://media.savetube.vip/api/random-cdn');
    const cdn = cdnRes.data?.cdn;

    if (cdn) {
      const infoRes = await stClient.post(`https://${cdn}/v2/info`, {
        url: `https://www.youtube.com/watch?v=${videoId}`
      });

      if (infoRes.data?.data) {
        const dec = decryptSaveTube(infoRes.data.data);
        if (dec.title) title = dec.title;
        if (dec.duration) duration = dec.duration;
        if (dec.thumbnail) thumbnail = dec.thumbnail;

        // Fetch 720p video
        try {
          const dl720 = await stClient.post(`https://${cdn}/download`, {
            id: videoId,
            downloadType: 'video',
            quality: '720',
            key: dec.key
          });
          if (dl720.data?.data?.downloadUrl) {
            videos.push({
              quality: '720p HD',
              format: 'mp4',
              url: dl720.data.data.downloadUrl,
              type: 'video'
            });
          }
        } catch (_) {}

        // Fetch 360p video
        try {
          const dl360 = await stClient.post(`https://${cdn}/download`, {
            id: videoId,
            downloadType: 'video',
            quality: '360',
            key: dec.key
          });
          if (dl360.data?.data?.downloadUrl) {
            videos.push({
              quality: '360p SD',
              format: 'mp4',
              url: dl360.data.data.downloadUrl,
              type: 'video'
            });
          }
        } catch (_) {}

        // Fetch 128k MP3 audio
        try {
          const dlAudio = await stClient.post(`https://${cdn}/download`, {
            id: videoId,
            downloadType: 'audio',
            quality: '128',
            key: dec.key
          });
          if (dlAudio.data?.data?.downloadUrl) {
            audios.push({
              quality: '128 kbps',
              format: 'mp3',
              url: dlAudio.data.data.downloadUrl,
              type: 'audio'
            });
          }
        } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('SaveTube resolution warning:', err.message);
  }

  // 2. Secondary fallback if no videos or audios were resolved: kelvdra scraper
  if (videos.length === 0 || audios.length === 0) {
    try {
      const scraper = require('@kelvdra/scraper');
      if (videos.length === 0) {
        const mp4Res = await scraper.ytmp4(`https://www.youtube.com/watch?v=${videoId}`, '360');
        if (mp4Res?.download?.url) {
          videos.push({
            quality: '360p MP4',
            format: 'mp4',
            url: mp4Res.download.url,
            type: 'video'
          });
          if (!title || title === 'YouTube Video') title = mp4Res.download.title || title;
        }
      }
      if (audios.length === 0) {
        const mp3Res = await scraper.ytmp3(`https://www.youtube.com/watch?v=${videoId}`, 'mp3');
        if (mp3Res?.download?.url) {
          audios.push({
            quality: '128 kbps MP3',
            format: 'mp3',
            url: mp3Res.download.url,
            type: 'audio'
          });
        }
      }
    } catch (err) {
      console.warn('Scraper fallback warning:', err.message);
    }
  }

  if (videos.length === 0 && audios.length === 0) {
    throw new Error('Gagal mengambil tautan unduhan YouTube. Format mungkin dilindungi hak cipta.');
  }

  return {
    platform: 'youtube',
    originalUrl: rawUrl,
    videoId,
    title,
    author,
    durationFormatted: formatDuration(duration),
    durationSeconds: duration,
    thumbnail,
    videos,
    audios
  };
}

/**
 * Resolve TikTok media details & download links
 */
async function resolveTikTok(rawUrl) {
  const unshortened = await unshortenUrl(rawUrl);

  let title = 'TikTok Video';
  let author = 'TikTok Creator';
  let thumbnail = '';
  let duration = 0;
  const videos = [];
  const audios = [];

  // 1. Primary engine: btch-downloader (uses dl.tiktokio.com for direct 200 no-watermark MP4 & MP3)
  try {
    const data = await btch.ttdl(unshortened);
    if (data && data.status && (data.video?.length > 0 || data.audio?.length > 0)) {
      if (data.title) title = data.title;
      if (data.thumbnail) thumbnail = data.thumbnail;

      if (Array.isArray(data.video)) {
        data.video.forEach((vUrl, idx) => {
          if (vUrl) {
            videos.push({
              quality: idx === 0 ? 'No Watermark (MP4)' : `Option ${idx + 1} (MP4)`,
              format: 'mp4',
              url: vUrl,
              type: 'video'
            });
          }
        });
      }

      if (Array.isArray(data.audio)) {
        data.audio.forEach((aUrl, idx) => {
          if (aUrl) {
            audios.push({
              quality: idx === 0 ? 'Original Sound (MP3)' : `Audio ${idx + 1}`,
              format: 'mp3',
              url: aUrl,
              type: 'audio'
            });
          }
        });
      }
    }
  } catch (err) {
    console.warn('btch.ttdl warning:', err.message);
  }

  // 2. Secondary engine: tikwm API
  if (videos.length === 0 || audios.length === 0) {
    try {
      const payload = new URLSearchParams({
        url: unshortened,
        count: '12',
        cursor: '0',
        web: '1',
        hd: '1'
      });

      const res = await axios.post('https://www.tikwm.com/api/', payload.toString(), {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });

      if (res.data?.code === 0 && res.data.data) {
        const d = res.data.data;
        if (d.title) title = d.title;
        if (d.author?.nickname) author = d.author.nickname;
        if (d.duration) duration = d.duration;
        if (!thumbnail && d.cover) {
          thumbnail = d.cover.startsWith('http') ? d.cover : `https://www.tikwm.com${d.cover}`;
        }

        const makeUrl = (u) => (u && u.startsWith('http') ? u : `https://www.tikwm.com${u}`);

        if (videos.length === 0) {
          if (d.hdplay) {
            videos.push({
              quality: 'HD No Watermark (MP4)',
              format: 'mp4',
              url: makeUrl(d.hdplay),
              type: 'video'
            });
          }
          if (d.play) {
            videos.push({
              quality: 'Standard No Watermark (MP4)',
              format: 'mp4',
              url: makeUrl(d.play),
              type: 'video'
            });
          }
        }

        if (audios.length === 0 && d.music) {
          audios.push({
            quality: 'Original Audio (MP3)',
            format: 'mp3',
            url: makeUrl(d.music),
            type: 'audio'
          });
        }
      }
    } catch (err) {
      console.warn('tikwm fallback warning:', err.message);
    }
  }

  if (videos.length === 0 && audios.length === 0) {
    throw new Error('Gagal mengambil konten TikTok. Pastikan video bersifat publik dan tautan valid.');
  }

  return {
    platform: 'tiktok',
    originalUrl: rawUrl,
    title,
    author,
    durationFormatted: formatDuration(duration),
    durationSeconds: duration,
    thumbnail,
    videos,
    audios
  };
}

/**
 * Universal media resolver
 */
async function resolveMedia(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Silakan masukkan tautan (URL) yang valid.');
  }

  const cleanUrl = url.trim();
  const platform = detectPlatform(cleanUrl);

  if (!platform) {
    throw new Error('Platform tidak didukung. Saat ini hanya mendukung unduhan YouTube dan TikTok.');
  }

  if (platform === 'youtube') {
    return await resolveYouTube(cleanUrl);
  } else if (platform === 'tiktok') {
    return await resolveTikTok(cleanUrl);
  }

  throw new Error('Platform tidak dikenali.');
}

module.exports = {
  detectPlatform,
  resolveMedia,
  resolveYouTube,
  resolveTikTok,
  formatDuration
};
