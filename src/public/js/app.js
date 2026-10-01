/**
 * STREAMCAL - Ultra-lightweight Vanilla JS Client
 * Zero dependencies, blazing fast, handles drag-and-drop, clipboard paste, URL upload, and history.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const queueContainer = document.getElementById('queueContainer');
  const resultsContainer = document.getElementById('resultsContainer');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const themeToggle = document.getElementById('themeToggle');
  const urlUploadForm = document.getElementById('urlUploadForm');
  const remoteUrlInput = document.getElementById('remoteUrlInput');
  const urlUploadBtn = document.getElementById('urlUploadBtn');
  const historyList = document.getElementById('historyList');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  // Load Saved Theme
  const savedTheme = localStorage.getItem('streamcal_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  themeToggle?.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('streamcal_theme', newTheme);
    updateThemeIcon(newTheme);
  });

  function updateThemeIcon(theme) {
    if (!themeToggle) return;
    themeToggle.innerHTML = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
  }

  // Tab Switching
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetContent = document.getElementById(tabId);
      if (targetContent) targetContent.classList.add('active');

      if (tabId === 'tab-history') {
        renderHistory();
      }
    });
  });

  // Dropzone Events
  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        handleUploadBatch(files);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleUploadBatch(e.target.files);
        fileInput.value = ''; // Reset input
      }
    });
  }

  // Paste from Clipboard anywhere on the page (Ctrl + V to instantly upload screenshots!)
  window.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
    if (!items) return;

    const filesToUpload = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) {
          const isAllowed = (file.type && (file.type.startsWith('image/') || file.type.startsWith('audio/'))) ||
                            /\.(jpe?g|png|gif|webp|svg|bmp|ico|mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(file.name);
          if (isAllowed) {
            filesToUpload.push(file);
          } else {
            alert('Hanya file gambar (image) dan audio yang diperbolehkan!');
          }
        }
      }
    }

    if (filesToUpload.length > 0) {
      // Switch to file tab if not active
      document.querySelector('[data-tab="tab-file"]')?.click();
      handleUploadBatch(filesToUpload);
    }
  });

  // Upload Batch Handler
  function handleUploadBatch(files) {
    Array.from(files).forEach(file => {
      uploadSingleFile(file);
    });
  }

  // Upload Single File with live XHR Progress Bar
  function uploadSingleFile(file) {
    // Client-side validations
    const isImageOrAudio = (file.type && (file.type.startsWith('image/') || file.type.startsWith('audio/'))) ||
                           /\.(jpe?g|png|gif|webp|svg|bmp|ico|tiff|mp3|wav|ogg|m4a|aac|flac|opus|weba)$/i.test(file.name);
    if (!isImageOrAudio) {
      alert(`File "${file.name}" ditolak. Hanya file gambar dan audio yang diperbolehkan!`);
      return;
    }

    const maxSizeBytes = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSizeBytes) {
      alert(`File "${file.name}" terlalu besar (${formatBytes(file.size)}). Ukuran maksimal adalah 2MB!`);
      return;
    }

    const queueId = 'queue_' + Math.random().toString(36).substring(2, 9);
    
    // Create Queue Item Element
    const queueItem = document.createElement('div');
    queueItem.className = 'queue-item';
    queueItem.id = queueId;
    queueItem.innerHTML = `
      <div class="queue-header">
        <span class="queue-name">${escapeHtml(file.name)}</span>
        <span class="queue-size">${formatBytes(file.size)} &bull; <strong class="queue-pct">0%</strong></span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width: 0%"></div>
      </div>
    `;
    queueContainer.prepend(queueItem);

    const formData = new FormData();
    formData.append('files', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        const fill = queueItem.querySelector('.progress-bar-fill');
        const pctText = queueItem.querySelector('.queue-pct');
        if (fill) fill.style.width = `${percent}%`;
        if (pctText) pctText.textContent = `${percent}%`;
      }
    });

    xhr.onload = function() {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.success && res.files && res.files.length > 0) {
            res.files.forEach(uploaded => {
              renderResultCard(uploaded);
              saveToHistory(uploaded);
            });
            setTimeout(() => queueItem.remove(), 1000);
          } else {
            showQueueError(queueItem, res.error || 'Upload error');
          }
        } catch (err) {
          showQueueError(queueItem, 'Invalid server response');
        }
      } else {
        let errMessage = 'Upload failed';
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.error) errMessage = res.error;
        } catch (_) {}
        showQueueError(queueItem, errMessage);
      }
    };

    xhr.onerror = function() {
      showQueueError(queueItem, 'Network connection error');
    };

    xhr.send(formData);
  }

  function showQueueError(element, message) {
    const fill = element.querySelector('.progress-bar-fill');
    if (fill) fill.style.background = 'var(--danger-color)';
    const pct = element.querySelector('.queue-pct');
    if (pct) {
      pct.textContent = message;
      pct.style.color = 'var(--danger-color)';
    }
  }

  // URL Upload Form Handler
  urlUploadForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = remoteUrlInput.value.trim();
    if (!url) return;

    urlUploadBtn.disabled = true;
    urlUploadBtn.textContent = 'Downloading...';

    try {
      const response = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await response.json();
      if (data.success && data.files) {
        data.files.forEach(file => {
          renderResultCard(file);
          saveToHistory(file);
        });
        remoteUrlInput.value = '';
      } else {
        alert(data.error || 'Failed to download from URL.');
      }
    } catch (err) {
      alert('Error contacting server: ' + err.message);
    } finally {
      urlUploadBtn.disabled = false;
      urlUploadBtn.textContent = 'Upload from URL';
    }
  });

  // ========================================================
  // MEDIA DOWNLOADER (YouTube & TikTok)
  // ========================================================
  const downloaderForm = document.getElementById('downloaderForm');
  const mediaUrlInput = document.getElementById('mediaUrlInput');
  const pasteMediaBtn = document.getElementById('pasteMediaBtn');
  const fetchMediaBtn = document.getElementById('fetchMediaBtn');
  const fetchMediaBtnText = document.getElementById('fetchMediaBtnText');
  const downloaderResultContainer = document.getElementById('downloaderResultContainer');

  pasteMediaBtn?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        mediaUrlInput.value = text.trim();
        mediaUrlInput.focus();
      }
    } catch (_) {
      mediaUrlInput.focus();
    }
  });

  downloaderForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = mediaUrlInput.value.trim();
    if (!url) return;

    fetchMediaBtn.disabled = true;
    fetchMediaBtnText.innerHTML = '<span class="dl-spinner"></span> Memproses...';
    downloaderResultContainer.innerHTML = '';

    try {
      const res = await fetch('/api/downloader/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const json = await res.json();
      if (json.success && json.data) {
        renderMediaResult(json.data);
      } else {
        showDownloaderError(json.error || 'Gagal mengambil konten media.');
      }
    } catch (err) {
      showDownloaderError('Terjadi kesalahan menghubungi server: ' + err.message);
    } finally {
      fetchMediaBtn.disabled = false;
      fetchMediaBtnText.textContent = 'Ambil Media';
    }
  });

  function showDownloaderError(msg) {
    if (!downloaderResultContainer) return;
    downloaderResultContainer.innerHTML = `
      <div style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:var(--radius-sm); padding:14px 18px; color:#ef4444; font-size:0.9rem; margin-top:14px; display:flex; align-items:center; gap:8px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>${escapeHtml(msg)}</span>
      </div>
    `;
  }

  function renderMediaResult(data) {
    if (!downloaderResultContainer) return;

    const isYt = data.platform === 'youtube';
    const platformLabel = isYt ? 'YouTube' : 'TikTok';
    const platformClass = isYt ? 'youtube' : 'tiktok';

    const card = document.createElement('div');
    card.className = 'media-result-card';

    // Build video download buttons
    let videoButtonsHtml = '';
    if (data.videos && data.videos.length > 0) {
      data.videos.forEach((vid, idx) => {
        const cleanName = `${data.title.substring(0, 40)}_${vid.quality}.${vid.format}`;
        const proxyUrl = `/api/downloader/download?url=${encodeURIComponent(vid.url)}&filename=${encodeURIComponent(cleanName)}`;
        videoButtonsHtml += `
          <a href="${proxyUrl}" class="btn-media-dl ${idx === 0 ? 'primary-dl' : ''}" download="${escapeHtml(cleanName)}" target="_blank" rel="noopener">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Download Video (${escapeHtml(vid.quality)})
          </a>
        `;
      });
    }

    // Build audio download buttons & preview
    let audioSectionHtml = '';
    if (data.audios && data.audios.length > 0) {
      const primaryAudio = data.audios[0];
      const audioCleanName = `${data.title.substring(0, 40)}_audio.${primaryAudio.format}`;
      const audioProxyUrl = `/api/downloader/download?url=${encodeURIComponent(primaryAudio.url)}&filename=${encodeURIComponent(audioCleanName)}`;

      audioSectionHtml = `
        <div class="download-subgroup-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          Audio MP3
        </div>

        <div class="audio-preview-wrap">
          <audio controls preload="none" src="${escapeHtml(primaryAudio.url)}"></audio>
        </div>

        <div class="download-buttons-grid">
          <a href="${audioProxyUrl}" class="btn-media-dl" download="${escapeHtml(audioCleanName)}" target="_blank" rel="noopener">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download MP3 (${escapeHtml(primaryAudio.quality)})
          </a>
          <button type="button" class="btn-media-dl btn-streamcal-save" id="saveStreamcalBtn" data-audiourl="${escapeHtml(primaryAudio.url)}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>
            <span id="saveStreamcalBtnText">Simpan ke Streamcal</span>
          </button>
        </div>

        <div id="saveStreamcalResult"></div>
      `;
    }

    card.innerHTML = `
      <div class="media-card-grid">
        <div class="media-thumb-container">
          <img src="${escapeHtml(data.thumbnail || '/assets/mascot.svg')}" alt="Thumbnail" loading="lazy">
          ${data.durationFormatted ? `<span class="media-duration-tag">${escapeHtml(data.durationFormatted)}</span>` : ''}
        </div>

        <div class="media-details">
          <div>
            <div class="media-meta-bar" style="margin-bottom:6px;">
              <span class="platform-pill ${platformClass}">${platformLabel}</span>
              ${data.author ? `<span class="media-author-pill">${escapeHtml(data.author)}</span>` : ''}
            </div>
            <h4 class="media-main-title">${escapeHtml(data.title)}</h4>
          </div>

          <div class="download-options-group">
            ${videoButtonsHtml ? `
              <div class="download-subgroup-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>
                Video MP4
              </div>
              <div class="download-buttons-grid">
                ${videoButtonsHtml}
              </div>
            ` : ''}

            ${audioSectionHtml}
          </div>
        </div>
      </div>
    `;

    downloaderResultContainer.appendChild(card);

    // Save to Streamcal Click Handler
    const saveBtn = card.querySelector('#saveStreamcalBtn');
    const saveResultDiv = card.querySelector('#saveStreamcalResult');
    const saveBtnText = card.querySelector('#saveStreamcalBtnText');

    saveBtn?.addEventListener('click', async () => {
      const audioUrl = saveBtn.getAttribute('data-audiourl');
      if (!audioUrl) return;

      saveBtn.disabled = true;
      saveBtnText.innerHTML = '<span class="dl-spinner"></span> Menyimpan...';
      if (saveResultDiv) saveResultDiv.innerHTML = '';

      try {
        const res = await fetch('/api/downloader/save-streamcal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: audioUrl,
            title: data.title,
            format: 'mp3'
          })
        });

        const resJson = await res.json();
        if (resJson.success && resJson.file) {
          const f = resJson.file;
          saveToHistory(f);

          saveBtnText.textContent = 'Tersimpan!';
          saveBtn.style.background = 'rgba(16, 185, 129, 0.3)';

          if (saveResultDiv) {
            saveResultDiv.innerHTML = `
              <div class="saved-streamcal-box">
                <div class="saved-streamcal-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Tersimpan di Streamcal! Tautan Langsung Permanen:
                </div>
                <div class="url-box" style="margin-top:4px;">
                  <input type="text" class="url-input" value="${escapeHtml(f.url)}" readonly onclick="this.select()">
                  <button type="button" class="btn btn-primary copy-btn" data-copy="${escapeHtml(f.url)}">Copy Link</button>
                </div>
              </div>
            `;

            const copyBtn = saveResultDiv.querySelector('.copy-btn');
            copyBtn?.addEventListener('click', () => {
              copyToClipboard(f.url, copyBtn);
            });
          }
        } else {
          alert(resJson.error || 'Gagal menyimpan ke Streamcal.');
          saveBtn.disabled = false;
          saveBtnText.textContent = 'Simpan ke Streamcal';
        }
      } catch (err) {
        alert('Kesalahan saat menyimpan: ' + err.message);
        saveBtn.disabled = false;
        saveBtnText.textContent = 'Simpan ke Streamcal';
      }
    });
  }

  // Render Result Card (Catbox styled output)
  function renderResultCard(file) {
    const card = document.createElement('div');
    card.className = 'result-card';

    const isImage = file.mimeType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(file.url);
    const isAudio = file.mimeType?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|opus|weba)$/i.test(file.url);
    const directUrl = file.url;
    const mdCode = isImage ? `![${file.name}](${directUrl})` : `[${file.name}](${directUrl})`;
    const bbCode = isImage ? `[img]${directUrl}[/img]` : `[url=${directUrl}]${file.name}[/url]`;

    let previewElement = '';
    if (isImage) {
      previewElement = `<a href="${directUrl}" target="_blank" rel="noopener"><img src="${directUrl}" class="thumb-preview" alt="Preview" loading="lazy"></a>`;
    } else if (isAudio) {
      previewElement = `<audio controls src="${directUrl}" style="height: 38px; max-width: 220px; outline: none;"></audio>`;
    }

    card.innerHTML = `
      <div class="result-card-header">
        <span class="result-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Upload Complete: ${escapeHtml(file.name)}
        </span>
        <span style="font-size:0.8rem; color:var(--text-dim);">${formatBytes(file.size)}</span>
      </div>

      <div class="url-box">
        <input type="text" class="url-input" value="${directUrl}" readonly onclick="this.select()">
        <button class="btn btn-primary copy-btn" data-copy="${directUrl}">Copy Link</button>
      </div>

      <div class="preview-row">
        ${previewElement}
        <div class="code-formats">
          <div class="code-row">
            <span class="code-label">Markdown:</span>
            <input type="text" class="code-snippet" value="${escapeHtml(mdCode)}" readonly onclick="this.select()">
          </div>
          <div class="code-row">
            <span class="code-label">BBCode:</span>
            <input type="text" class="code-snippet" value="${escapeHtml(bbCode)}" readonly onclick="this.select()">
          </div>
        </div>
      </div>
    `;

    resultsContainer.prepend(card);

    // Setup Copy Button
    const copyBtn = card.querySelector('.copy-btn');
    copyBtn?.addEventListener('click', () => {
      copyToClipboard(directUrl, copyBtn);
    });
  }

  // Copy to Clipboard Utility
  function copyToClipboard(text, btnElement) {
    navigator.clipboard.writeText(text).then(() => {
      const originalText = btnElement.textContent;
      btnElement.textContent = 'Copied!';
      btnElement.style.background = 'var(--success-color)';
      setTimeout(() => {
        btnElement.textContent = originalText;
        btnElement.style.background = '';
      }, 2000);
    }).catch(() => {
      prompt('Copy link:', text);
    });
  }

  // Local Storage History
  function saveToHistory(file) {
    let history = [];
    try {
      history = JSON.parse(localStorage.getItem('streamcal_history') || '[]');
    } catch (_) {}

    history.unshift({
      ...file,
      timestamp: new Date().toISOString()
    });

    // Keep max 50 items
    if (history.length > 50) history = history.slice(0, 50);
    localStorage.setItem('streamcal_history', JSON.stringify(history));
  }

  function renderHistory() {
    if (!historyList) return;
    let history = [];
    try {
      history = JSON.parse(localStorage.getItem('streamcal_history') || '[]');
    } catch (_) {}

    if (history.length === 0) {
      historyList.innerHTML = `<div class="empty-state">No uploaded files in this browser yet.</div>`;
      return;
    }

    let rowsHtml = `
      <table class="history-table">
        <thead>
          <tr>
            <th>Preview</th>
            <th>Name</th>
            <th>Size</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
    `;

    history.forEach(item => {
      const isImg = item.mimeType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(item.url);
      const isAud = item.mimeType?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|opus|weba)$/i.test(item.url);
      let thumbHtml = '📄';
      if (isImg) {
        thumbHtml = `<img src="${item.url}" class="history-thumb" alt="thumb">`;
      } else if (isAud) {
        thumbHtml = `<span style="font-size:1.4rem;">🎵</span>`;
      }

      rowsHtml += `
        <tr>
          <td>
            ${thumbHtml}
          </td>
          <td>
            <a href="${item.url}" target="_blank" style="font-weight:500;">${escapeHtml(item.name || item.storedName)}</a>
          </td>
          <td style="color:var(--text-dim);">${formatBytes(item.size)}</td>
          <td>
            <button class="btn btn-secondary history-copy-btn" data-url="${item.url}" style="padding:4px 10px; font-size:0.8rem;">Copy</button>
          </td>
        </tr>
      `;
    });

    rowsHtml += `</tbody></table>`;
    historyList.innerHTML = rowsHtml;

    // Attach copy events
    historyList.querySelectorAll('.history-copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-url');
        copyToClipboard(url, btn);
      });
    });
  }

  clearHistoryBtn?.addEventListener('click', () => {
    if (confirm('Clear local upload history?')) {
      localStorage.removeItem('streamcal_history');
      renderHistory();
    }
  });

  // Helper Functions
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }
});
