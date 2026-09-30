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
