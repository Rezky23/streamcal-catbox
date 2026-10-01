const mime = require('mime-types');
const path = require('path');

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function getCleanExtension(filename, mimeType) {
  let ext = path.extname(filename || '').toLowerCase().replace(/^\./, '');
  if (!ext && mimeType) {
    const extFromMime = mime.extension(mimeType);
    if (extFromMime) ext = extFromMime;
  }
  // Standardize common types
  if (ext === 'jpeg') ext = 'jpg';
  return ext;
}

const net = require('net');

function isPrivateIp(ip) {
  // IPv4 checks
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(n => parseInt(n, 10));
    // 0.0.0.0/8
    if (parts[0] === 0) return true;
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 127.0.0.0/8 (loopback)
    if (parts[0] === 127) return true;
    // 169.254.0.0/16 (link-local, cloud metadata)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 100.64.0.0/10 (carrier-grade NAT)
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    // Broadcast
    if (parts[0] === 255 && parts[1] === 255 && parts[2] === 255 && parts[3] === 255) return true;
    return false;
  }

  // IPv6 checks
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    // Loopback ::1
    if (lower === '::1' || lower === '0000:0000:0000:0000:0000:0000:0000:0001') return true;
    // Unspecified ::
    if (lower === '::' || lower === '0000:0000:0000:0000:0000:0000:0000:0000') return true;
    // Unique local address fc00::/7
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    // Link-local fe80::/10
    if (lower.startsWith('fe80:')) return true;
    // IPv4-mapped IPv6 (::ffff:127.0.0.1, etc.)
    if (lower.startsWith('::ffff:')) {
      const ipv4Part = lower.replace('::ffff:', '');
      return isPrivateIp(ipv4Part);
    }
    return false;
  }

  return false;
}

function isValidHttpUrl(string) {
  let url;
  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }
  return url.protocol === 'http:' || url.protocol === 'https:';
}

function isSafePublicUrl(string) {
  if (!isValidHttpUrl(string)) return false;

  try {
    const parsed = new URL(string);
    const hostname = parsed.hostname.toLowerCase().trim();

    // Disallow non-standard ports commonly probed during SSRF (allow 80, 443, 8080, 8443, or default)
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname === 'metadata.google.internal' ||
      hostname === 'instance-data'
    ) {
      return false;
    }

    // Check if hostname is an IP (v4 or v6)
    const cleanHost = hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(cleanHost)) {
      if (isPrivateIp(cleanHost)) return false;
    }

    // Check for decimal / octal / hex IP obfuscation
    if (/^0x[0-9a-f]+$/i.test(hostname) || /^\d+$/.test(hostname)) {
      return false;
    }

    return true;
  } catch (_) {
    return false;
  }
}

module.exports = {
  formatBytes,
  getCleanExtension,
  isValidHttpUrl,
  isPrivateIp,
  isSafePublicUrl
};
