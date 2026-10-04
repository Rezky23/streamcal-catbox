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
      } else if (tabId === 'tab-support') {
        initSupportTab();
      }
    });
  });

  // Sub-Tab Switching (Image to URL: Upload Files & Upload from URL)
  const subTabButtons = document.querySelectorAll('.sub-tab-btn');
  const subTabPanes = document.querySelectorAll('.sub-tab-pane');

  subTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const subtabId = btn.getAttribute('data-subtab');
      subTabButtons.forEach(b => b.classList.remove('active'));
      subTabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(subtabId);
      if (targetPane) targetPane.classList.add('active');
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
      // Switch to image-url tab and files sub-tab if not active
      document.querySelector('[data-tab="tab-image-url"]')?.click();
      document.querySelector('[data-subtab="subtab-upload-files"]')?.click();
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
      fetchMediaBtnText.textContent = 'Download';
    }
  });

  // Quick Hints Click Handler
  document.querySelectorAll('.dl-hint-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const hintUrl = btn.getAttribute('data-url');
      if (hintUrl && mediaUrlInput) {
        mediaUrlInput.value = hintUrl;
        downloaderForm?.dispatchEvent(new Event('submit'));
      }
    });
  });

  function showDownloaderError(msg) {
    if (!downloaderResultContainer) return;
    downloaderResultContainer.innerHTML = `
      <div style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:var(--radius-sm); padding:14px 18px; color:#ef4444; font-size:0.9rem; margin-top:10px; display:flex; align-items:center; gap:8px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>${escapeHtml(msg)}</span>
      </div>
    `;
  }

  function renderMediaResult(data) {
    if (!downloaderResultContainer) return;

    const isYt = data.platform === 'youtube';
    const platformLabel = isYt ? 'YouTube' : 'TikTok';
    const platformTagClass = isYt ? 'dl-tag-yt' : 'dl-tag-tt';

    const card = document.createElement('div');
    card.className = 'dl-result-card';

    // Build video download buttons
    let videoButtonsHtml = '';
    if (data.videos && data.videos.length > 0) {
      data.videos.forEach((vid, idx) => {
        const cleanName = `${data.title.substring(0, 40)}_${vid.quality}.${vid.format}`;
        const proxyUrl = `/api/downloader/download?url=${encodeURIComponent(vid.url)}&filename=${encodeURIComponent(cleanName)}`;
        videoButtonsHtml += `
          <a href="${proxyUrl}" class="dl-action-btn ${idx === 0 ? 'btn-video-primary' : 'btn-video-secondary'}" download="${escapeHtml(cleanName)}" target="_blank" rel="noopener">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
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
        <div class="dl-section-label">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          Audio MP3
        </div>

        <div class="dl-audio-player-box">
          <audio controls preload="none" src="${escapeHtml(primaryAudio.url)}"></audio>
        </div>

        <div class="dl-buttons-row">
          <a href="${audioProxyUrl}" class="dl-action-btn btn-audio-dl" download="${escapeHtml(audioCleanName)}" target="_blank" rel="noopener">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download MP3 (${escapeHtml(primaryAudio.quality)})
          </a>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="dl-result-layout">
        <div class="dl-thumb-wrapper">
          <img src="${escapeHtml(data.thumbnail || '/assets/mascot.svg')}" alt="Thumbnail" referrerpolicy="no-referrer" loading="lazy" onerror="this.src='/assets/mascot.svg'">
          ${data.durationFormatted ? `<span class="dl-duration-pill">${escapeHtml(data.durationFormatted)}</span>` : ''}
        </div>

        <div class="dl-meta-details">
          <div>
            <div class="dl-creator-row">
              <span class="dl-tag ${platformTagClass}">${platformLabel}</span>
              ${data.author ? `<span class="dl-creator-name">${escapeHtml(data.author)}</span>` : ''}
            </div>
            <h3 class="dl-title-text">${escapeHtml(data.title)}</h3>
          </div>

          <div class="dl-actions-block">
            ${videoButtonsHtml ? `
              <div class="dl-section-label">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>
                Video MP4
              </div>
              <div class="dl-buttons-row">
                ${videoButtonsHtml}
              </div>
            ` : ''}

            ${audioSectionHtml}
          </div>
        </div>
      </div>
    `;

    downloaderResultContainer.appendChild(card);
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
      previewElement = `<a href="${escapeHtml(directUrl)}" target="_blank" rel="noopener"><img src="${escapeHtml(directUrl)}" class="thumb-preview" alt="Preview" loading="lazy"></a>`;
    } else if (isAudio) {
      previewElement = `<audio controls src="${escapeHtml(directUrl)}" style="height: 38px; max-width: 220px; outline: none;"></audio>`;
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
        <input type="text" class="url-input" value="${escapeHtml(directUrl)}" readonly onclick="this.select()">
        <button class="btn btn-primary copy-btn" data-copy="${escapeHtml(directUrl)}">Copy Link</button>
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

  // ========================================================
  // AUDIO RECOGNIZER (Upload, Mic & Recognize)
  // ========================================================
  const recDropzone = document.getElementById('recDropzone');
  const recFileInput = document.getElementById('recFileInput');
  const recBrowseBtn = document.getElementById('recBrowseBtn');
  const recMicBtn = document.getElementById('recMicBtn');
  const recMicBtnText = document.getElementById('recMicBtnText');
  const recToggleUrlBtn = document.getElementById('recToggleUrlBtn');
  const recUrlBox = document.getElementById('recUrlBox');
  const recAudioUrlInput = document.getElementById('recAudioUrlInput');
  const recSubmitUrlBtn = document.getElementById('recSubmitUrlBtn');
  const recToggleYtBtn = document.getElementById('recToggleYtBtn');
  const recYtSearchBox = document.getElementById('recYtSearchBox');
  const recYtSearchInput = document.getElementById('recYtSearchInput');
  const recYtSearchBtn = document.getElementById('recYtSearchBtn');
  const recSelectedBox = document.getElementById('recSelectedBox');
  const recSelectedName = document.getElementById('recSelectedName');
  const recSelectedSize = document.getElementById('recSelectedSize');
  const recSelectedAudioPlayer = document.getElementById('recSelectedAudioPlayer');
  const recRemoveFileBtn = document.getElementById('recRemoveFileBtn');
  const recSubmitFileBtn = document.getElementById('recSubmitFileBtn');
  const recSubmitFileBtnText = document.getElementById('recSubmitFileBtnText');
  const recResultContainer = document.getElementById('recResultContainer');

  let currentAudioFile = null;
  let mediaRecorder = null;
  let audioChunks = [];
  let recordTimer = null;
  let recordSeconds = 0;
  let mediaStream = null;

  // Browse File Triggers
  recDropzone?.addEventListener('click', () => recFileInput?.click());
  recBrowseBtn?.addEventListener('click', () => recFileInput?.click());

  // Dropzone drag & drop
  if (recDropzone) {
    ['dragenter', 'dragover'].forEach(name => {
      recDropzone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        recDropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      recDropzone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        recDropzone.classList.remove('dragover');
      });
    });

    recDropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        stageAudioFile(files[0]);
      }
    });
  }

  // File Input Change
  recFileInput?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      stageAudioFile(e.target.files[0]);
      recFileInput.value = '';
    }
  });

  // Stage Selected File
  function stageAudioFile(file) {
    if (!file) return;
    currentAudioFile = file;
    if (recSelectedName) recSelectedName.textContent = file.name;
    if (recSelectedSize) recSelectedSize.textContent = formatBytes(file.size);

    // Audio preview
    const blobUrl = URL.createObjectURL(file);
    if (recSelectedAudioPlayer) recSelectedAudioPlayer.src = blobUrl;
    if (recSelectedBox) recSelectedBox.style.display = 'flex';
    if (recResultContainer) recResultContainer.innerHTML = '';
  }

  // Remove Selected File
  recRemoveFileBtn?.addEventListener('click', () => {
    currentAudioFile = null;
    if (recSelectedAudioPlayer) {
      recSelectedAudioPlayer.pause();
      recSelectedAudioPlayer.src = '';
    }
    if (recSelectedBox) recSelectedBox.style.display = 'none';
  });

  // Toggle URL Input
  recToggleUrlBtn?.addEventListener('click', () => {
    if (!recUrlBox) return;
    if (recUrlBox.style.display === 'none' || !recUrlBox.style.display) {
      recUrlBox.style.display = 'block';
      if (recYtSearchBox) recYtSearchBox.style.display = 'none';
      recAudioUrlInput?.focus();
    } else {
      recUrlBox.style.display = 'none';
    }
  });

  // Toggle YouTube Direct Search Box
  recToggleYtBtn?.addEventListener('click', () => {
    if (!recYtSearchBox) return;
    if (recYtSearchBox.style.display === 'none' || !recYtSearchBox.style.display) {
      recYtSearchBox.style.display = 'block';
      if (recUrlBox) recUrlBox.style.display = 'none';
      recYtSearchInput?.focus();
    } else {
      recYtSearchBox.style.display = 'none';
    }
  });

  function performDirectYtSearch(query) {
    const q = (query || '').trim();
    if (!q) {
      alert('Silakan ketik judul lagu, nama artis, atau lirik untuk dicari di YouTube.');
      return;
    }
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    window.open(searchUrl, '_blank', 'noopener,noreferrer');
  }

  recYtSearchBtn?.addEventListener('click', () => {
    performDirectYtSearch(recYtSearchInput?.value);
  });

  recYtSearchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      performDirectYtSearch(recYtSearchInput.value);
    }
  });

  // Microphone Recording via MediaRecorder
  recMicBtn?.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      // Stop recording
      mediaRecorder.stop();
      return;
    }

    // Start recording
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Browser Anda tidak mendukung perekaman audio via mikrofon.');
      return;
    }

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      recordSeconds = 0;

      mediaRecorder = new MediaRecorder(mediaStream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        clearInterval(recordTimer);
        recMicBtn.classList.remove('recording');
        if (recMicBtnText) recMicBtnText.textContent = 'Rekam Suara (Mic)';

        if (mediaStream) {
          mediaStream.getTracks().forEach(track => track.stop());
          mediaStream = null;
        }

        if (audioChunks.length > 0) {
          const mimeType = mediaRecorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(audioChunks, { type: mimeType });
          const recordedFile = new File([audioBlob], `rekaman_mic_${Date.now()}.webm`, { type: mimeType });
          stageAudioFile(recordedFile);
        }
      };

      mediaRecorder.start();
      recMicBtn.classList.add('recording');
      if (recMicBtnText) recMicBtnText.innerHTML = '<span class="rec-mic-dot"></span> Merekam... (00:00)';

      recordTimer = setInterval(() => {
        recordSeconds++;
        const mins = String(Math.floor(recordSeconds / 60)).padStart(2, '0');
        const secs = String(recordSeconds % 60).padStart(2, '0');
        if (recMicBtnText) recMicBtnText.innerHTML = `<span class="rec-mic-dot"></span> Berhenti (${mins}:${secs})`;

        // Auto-stop after 20 seconds to keep audio optimal for fingerprinting
        if (recordSeconds >= 20) {
          mediaRecorder.stop();
        }
      }, 1000);

    } catch (err) {
      console.error('Mic Error:', err);
      alert('Tidak dapat mengakses mikrofon: ' + err.message);
    }
  });

  // Submit Uploaded / Recorded Audio
  recSubmitFileBtn?.addEventListener('click', async () => {
    if (!currentAudioFile) return;

    recSubmitFileBtn.disabled = true;
    if (recSubmitFileBtnText) recSubmitFileBtnText.innerHTML = '<span class="dl-spinner"></span> Mengidentifikasi lagu...';
    if (recResultContainer) recResultContainer.innerHTML = '';

    const formData = new FormData();
    formData.append('audio', currentAudioFile);

    try {
      const res = await fetch('/api/recognize', {
        method: 'POST',
        body: formData
      });

      const json = await res.json();
      if (json.success && json.data && json.data.matched) {
        renderRecognizeResult(json.data);
      } else {
        showRecognizeError(json.message || 'Lagu tidak berhasil diidentifikasi.');
      }
    } catch (err) {
      showRecognizeError('Terjadi kesalahan menghubungi server: ' + err.message);
    } finally {
      recSubmitFileBtn.disabled = false;
      if (recSubmitFileBtnText) recSubmitFileBtnText.textContent = 'Kenali Lagu Sekarang';
    }
  });

  // Submit Audio URL
  recSubmitUrlBtn?.addEventListener('click', async () => {
    const url = recAudioUrlInput?.value.trim();
    if (!url) {
      recAudioUrlInput?.focus();
      return;
    }

    recSubmitUrlBtn.disabled = true;
    recSubmitUrlBtn.innerHTML = '<span class="dl-spinner"></span> Menganalisis...';
    if (recResultContainer) recResultContainer.innerHTML = '';

    try {
      const res = await fetch('/api/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const json = await res.json();
      if (json.success && json.data && json.data.matched) {
        renderRecognizeResult(json.data);
      } else {
        showRecognizeError(json.message || 'Lagu tidak berhasil diidentifikasi.');
      }
    } catch (err) {
      showRecognizeError('Terjadi kesalahan menghubungi server: ' + err.message);
    } finally {
      recSubmitUrlBtn.disabled = false;
      recSubmitUrlBtn.innerHTML = '<span>Kenali Audio</span>';
    }
  });

  // Show Error Card
  function showRecognizeError(msg) {
    if (!recResultContainer) return;

    // Sanitize any remaining mention of third-party engine / Shazam
    const safeMsg = (msg || '').replace(/shazam/gi, 'database musik');

    recResultContainer.innerHTML = `
      <div style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:var(--radius-md); padding:18px 20px; color:#ef4444; font-size:0.9rem; margin-top:14px; display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; align-items:center; gap:8px; font-weight:700;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>Pencarian Lagu Gagal</span>
        </div>
        <div style="color:var(--text-main); line-height:1.5;">${escapeHtml(safeMsg)}</div>
        <div style="font-size:0.82rem; color:var(--text-muted); line-height:1.5;">
          💡 <strong>Tips:</strong> Pastikan audio berdurasi setidaknya 4-10 detik, memuat melodi atau vokal yang jelas tanpa terlalu banyak noise/suara latar.
        </div>

        <!-- YouTube Search Fallback -->
        <div style="margin-top:6px; padding-top:14px; border-top:1px solid rgba(239,68,68,0.25); display:flex; flex-direction:column; gap:8px;">
          <div style="font-size:0.88rem; color:var(--text-main); font-weight:600; display:flex; align-items:center; gap:6px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#ef4444"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            <span>Cari Manual di YouTube:</span>
          </div>
          <div style="font-size:0.82rem; color:var(--text-muted);">
            Lagu tidak terdeteksi otomatis? Ketik judul lagu atau penggalan lirik untuk dicari langsung di YouTube:
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:2px;">
            <input type="text" id="recFallbackYtInput" placeholder="Ketik penggalan lirik atau artis..." style="flex:1; min-width:200px; padding:9px 14px; background:var(--surface-color); border:1px solid var(--border-color); border-radius:var(--radius-sm); color:var(--text-main); font-size:0.88rem; outline:none;">
            <button type="button" id="recFallbackYtBtn" class="rec-action-btn rec-link-youtube" style="padding:9px 16px; font-weight:600; display:inline-flex; align-items:center; gap:6px; cursor:pointer; border-radius:var(--radius-sm);">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              <span>Cari di YouTube</span>
            </button>
          </div>
        </div>
      </div>
    `;

    const fallbackInput = document.getElementById('recFallbackYtInput');
    const fallbackBtn = document.getElementById('recFallbackYtBtn');

    fallbackBtn?.addEventListener('click', () => {
      performDirectYtSearch(fallbackInput?.value);
    });

    fallbackInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        performDirectYtSearch(fallbackInput.value);
      }
    });
  }

  // Render Song Match Result
  function renderRecognizeResult(song) {
    if (!recResultContainer) return;

    const coverImg = song.coverArt || '/assets/mascot.svg';
    let previewAudioHtml = '';
    if (song.previewAudio) {
      previewAudioHtml = `
        <div class="rec-player-section">
          <div class="rec-player-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Official Audio Preview (30 detik)
          </div>
          <audio controls autoplay style="width:100%; height:36px; outline:none;">
            <source src="${escapeHtml(song.previewAudio)}" type="audio/mp4">
            <source src="${escapeHtml(song.previewAudio)}" type="audio/aac">
            Browser Anda tidak mendukung audio player.
          </audio>
        </div>
      `;
    }

    let metaChips = '';
    if (song.album) metaChips += `<div class="rec-meta-chip">Album: <strong>${escapeHtml(song.album)}</strong></div>`;
    if (song.releaseYear) metaChips += `<div class="rec-meta-chip">Tahun: <strong>${escapeHtml(song.releaseYear)}</strong></div>`;
    if (song.genre) metaChips += `<div class="rec-meta-chip">Genre: <strong>${escapeHtml(song.genre)}</strong></div>`;
    if (song.label) metaChips += `<div class="rec-meta-chip">Label: <strong>${escapeHtml(song.label)}</strong></div>`;

    // Action buttons
    let linksHtml = '';
    if (song.youtubeSearchUrl) {
      linksHtml += `
        <a href="${escapeHtml(song.youtubeSearchUrl)}" target="_blank" rel="noopener noreferrer" class="rec-link-btn rec-link-youtube">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          Cari di YouTube
        </a>
      `;
    }
    if (song.spotifyUrl) {
      linksHtml += `
        <a href="${escapeHtml(song.spotifyUrl)}" target="_blank" rel="noopener noreferrer" class="rec-link-btn rec-link-spotify">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><path d="M7 9c3-1 7-1 10 1M8 12c2.5-.8 5.5-.8 8 .8M9 15c2-.5 4.5-.5 6 .5" stroke="#fff" stroke-width="1.5" fill="none"/></svg>
          Spotify
        </a>
      `;
    }
    if (song.appleMusicUrl) {
      linksHtml += `
        <a href="${escapeHtml(song.appleMusicUrl)}" target="_blank" rel="noopener noreferrer" class="rec-link-btn rec-link-apple">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.242 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/></svg>
          Apple Music
        </a>
      `;
    }

    let lyricsHtml = '';
    if (song.lyrics) {
      lyricsHtml = `
        <div class="rec-lyrics-box">
          <div class="rec-lyrics-header">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Lirik Lagu
          </div>
          <div class="rec-lyrics-content">${escapeHtml(song.lyrics)}</div>
        </div>
      `;
    }

    recResultContainer.innerHTML = `
      <div class="rec-result-card">
        <div class="rec-result-layout">
          <div class="rec-cover-wrap">
            <img src="${escapeHtml(coverImg)}" alt="${escapeHtml(song.title)}" class="rec-cover-img" onerror="this.src='/assets/mascot.svg'">
          </div>

          <div class="rec-info-col">
            <div class="rec-badge-match">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              Lagu Teridentifikasi!
            </div>

            <div class="rec-track-title">${escapeHtml(song.title)}</div>
            <div class="rec-track-artist">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              ${escapeHtml(song.artist)}
            </div>

            ${metaChips ? `<div class="rec-meta-grid">${metaChips}</div>` : ''}

            ${previewAudioHtml}

            <div class="rec-links-row">
              ${linksHtml}
            </div>
          </div>
        </div>

        ${lyricsHtml}

        <div style="display:flex; justify-content:flex-end; border-top:1px solid var(--border-color); padding-top:14px;">
          <button type="button" id="recResetBtn" class="rec-action-btn" style="font-size:0.82rem; padding:6px 14px;">
            <span>🔄 Cari Lagu Lain</span>
          </button>
        </div>
      </div>
    `;

    document.getElementById('recResetBtn')?.addEventListener('click', () => {
      recResultContainer.innerHTML = '';
      recRemoveFileBtn?.click();
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
      const rawUrl = item.url || '';
      // Ensure URL is a valid http/https or relative path
      const safeUrl = (/^(https?:\/\/|\/)/i.test(rawUrl)) ? escapeHtml(rawUrl) : '#';

      let thumbHtml = '📄';
      if (isImg && safeUrl !== '#') {
        thumbHtml = `<img src="${safeUrl}" class="history-thumb" alt="thumb">`;
      } else if (isAud) {
        thumbHtml = `<span style="font-size:1.4rem;">🎵</span>`;
      }

      rowsHtml += `
        <tr>
          <td>
            ${thumbHtml}
          </td>
          <td>
            <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="font-weight:500;">${escapeHtml(item.name || item.storedName)}</a>
          </td>
          <td style="color:var(--text-dim);">${formatBytes(item.size)}</td>
          <td>
            <button class="btn btn-secondary history-copy-btn" data-url="${safeUrl}" style="padding:4px 10px; font-size:0.8rem;">Copy</button>
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

  // ========================================================
  // SUPPORT ME (TAKO.ID) MODULE
  // ========================================================
  const navSupportBtn = document.getElementById('navSupportBtn');
  navSupportBtn?.addEventListener('click', () => {
    const tabSupportBtn = document.querySelector('[data-tab="tab-support"]');
    if (tabSupportBtn) {
      tabSupportBtn.click();
      const mainCard = document.querySelector('.main-card');
      if (mainCard) {
        mainCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });

  let supportInitialized = false;
  let supportSelectedAmount = 10000;
  let supportSelectedMethod = 'qris';
  let supportPollingTimer = null;

  function formatRupiah(num) {
    const val = Number(num) || 0;
    return 'Rp ' + val.toLocaleString('id-ID');
  }

  function timeAgo(dateInput) {
    const date = new Date(dateInput);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return 'Baru saja';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} menit yang lalu`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} jam yang lalu`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} hari yang lalu`;
  }

  function initSupportTab() {
    if (!supportInitialized) {
      supportInitialized = true;
      setupSupportEvents();
    }
    loadSupportConfig();
  }

  async function loadSupportConfig() {
    try {
      const res = await fetch('/api/support/config');
      const data = await res.json();
      if (data.success && data.data) {
        const conf = data.data;
        // Update direct link
        const directLink = document.getElementById('takoDirectLink');
        const directUsername = document.getElementById('takoDirectUsername');
        if (directLink && conf.profileUrl) directLink.href = conf.profileUrl;
        if (directUsername && conf.username) directUsername.textContent = conf.username;

        // Render recent supporters
        renderSupportersList(conf.recentSupporters || []);
      }
    } catch (err) {
      console.warn('Could not load Tako config:', err);
    }
  }

  function setupSupportEvents() {
    const presetBtns = document.querySelectorAll('.support-preset-btn');
    const customAmountWrap = document.getElementById('customAmountWrap');
    const supportAmountInput = document.getElementById('supportAmountInput');
    const submitBtn = document.getElementById('supportSubmitBtn');
    const submitBtnText = document.getElementById('supportSubmitBtnText');
    const methodCards = document.querySelectorAll('.support-method-card');
    const supportForm = document.getElementById('supportForm');
    const refreshSupportersBtn = document.getElementById('refreshSupportersBtn');

    // Preset button click
    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        presetBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const amt = btn.getAttribute('data-amount');
        if (amt === 'custom') {
          if (customAmountWrap) customAmountWrap.style.display = 'block';
          if (supportAmountInput) {
            supportAmountInput.focus();
            supportSelectedAmount = parseInt(supportAmountInput.value, 10) || 10000;
          }
        } else {
          if (customAmountWrap) customAmountWrap.style.display = 'none';
          supportSelectedAmount = parseInt(amt, 10);
          if (supportAmountInput) supportAmountInput.value = supportSelectedAmount;
        }

        if (submitBtnText) {
          submitBtnText.textContent = `Kirim Dukungan (${formatRupiah(supportSelectedAmount)})`;
        }
      });
    });

    // Custom input typing
    supportAmountInput?.addEventListener('input', () => {
      const val = parseInt(supportAmountInput.value, 10) || 0;
      supportSelectedAmount = val;
      if (submitBtnText) {
        submitBtnText.textContent = `Kirim Dukungan (${formatRupiah(val)})`;
      }
    });

    // Payment method card click
    methodCards.forEach(card => {
      card.addEventListener('click', () => {
        methodCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        supportSelectedMethod = card.getAttribute('data-method') || 'qris';
      });
    });

    // Refresh supporters button
    refreshSupportersBtn?.addEventListener('click', async () => {
      refreshSupportersBtn.disabled = true;
      refreshSupportersBtn.textContent = '...';
      try {
        const res = await fetch('/api/support/recent');
        const data = await res.json();
        if (data.success && data.data) {
          renderSupportersList(data.data);
        }
      } catch (err) {
        console.warn('Failed to refresh supporters:', err);
      } finally {
        refreshSupportersBtn.disabled = false;
        refreshSupportersBtn.textContent = 'Refresh';
      }
    });

    // Form submit
    supportForm?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const nameInput = document.getElementById('supportNameInput');
      const emailInput = document.getElementById('supportEmailInput');
      const messageInput = document.getElementById('supportMessageInput');
      const checkoutContainer = document.getElementById('supportCheckoutContainer');

      const name = nameInput?.value?.trim();
      const email = emailInput?.value?.trim();
      const message = messageInput?.value?.trim() || '';
      const amount = supportSelectedAmount;
      const paymentMethod = supportSelectedMethod;

      if (!name) {
        alert('Mohon masukkan nama atau samaran Anda.');
        nameInput?.focus();
        return;
      }

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert('Mohon masukkan alamat email yang valid untuk konfirmasi transaksi.');
        emailInput?.focus();
        return;
      }

      if (!amount || amount < 1000) {
        alert('Nominal dukungan minimal Rp 1.000.');
        if (customAmountWrap) customAmountWrap.style.display = 'block';
        supportAmountInput?.focus();
        return;
      }

      // Disable submit & show spinner
      if (submitBtn) submitBtn.disabled = true;
      if (submitBtnText) submitBtnText.textContent = 'Memproses pembayaran...';

      try {
        const res = await fetch('/api/support/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            name,
            email,
            amount,
            paymentMethod,
            message
          })
        });

        const data = await res.json();

        // Handle case where API credentials are not configured on server
        if (data.isConfigured === false) {
          if (checkoutContainer) {
            checkoutContainer.style.display = 'block';
            checkoutContainer.innerHTML = `
              <div class="support-checkout-box" style="border-color:var(--warning-color); background:rgba(245, 158, 11, 0.08);">
                <div class="support-checkout-header">
                  <div style="font-weight:700; color:var(--warning-color); font-size:1rem; display:flex; align-items:center; gap:8px;">
                    <span>⚠️</span> Pengaturan Donasi
                  </div>
                </div>
                <p style="font-size:0.88rem; color:var(--text-muted); line-height:1.5;">
                  ${escapeHtml(data.message || 'Layanan donasi sedang dalam penyiapan sistem.')}
                </p>
                <div class="support-checkout-actions">
                  <a href="${escapeHtml(data.fallbackUrl || '#')}" target="_blank" rel="noopener noreferrer" class="support-pay-btn" style="background:var(--accent-primary);">
                    <span>Lanjutkan Pembayaran Donasi</span>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </a>
                </div>
              </div>
            `;
            checkoutContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
          return;
        }

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Gagal memproses transaksi donasi.');
        }

        const gift = data.data;
        renderCheckoutCard(gift);

        // Auto-open payment link
        if (gift.paymentUrl) {
          window.open(gift.paymentUrl, '_blank', 'noopener,noreferrer');
        }
      } catch (err) {
        alert('Terjadi kesalahan: ' + err.message);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (submitBtnText) submitBtnText.textContent = `Kirim Dukungan (${formatRupiah(supportSelectedAmount)})`;
      }
    });
  }

  function renderCheckoutCard(gift) {
    const checkoutContainer = document.getElementById('supportCheckoutContainer');
    if (!checkoutContainer) return;

    if (supportPollingTimer) {
      clearInterval(supportPollingTimer);
      supportPollingTimer = null;
    }

    checkoutContainer.style.display = 'block';
    checkoutContainer.innerHTML = `
      <div class="support-checkout-box" id="activeCheckoutBox">
        <div class="support-checkout-header">
          <div style="font-weight:700; color:var(--text-main); font-size:1.02rem; display:flex; align-items:center; gap:8px;">
            <span>💖</span> Tiket Pembayaran Dukungan
          </div>
          <span class="support-status-badge support-status-pending" id="checkoutStatusBadge">
            ⏳ Menunggu Pembayaran
          </span>
        </div>

        <div class="support-checkout-meta">
          <div class="support-checkout-row">
            <span>Nominal:</span>
            <span style="color:#34d399; font-size:1.05rem;">${formatRupiah(gift.amount)}</span>
          </div>
          <div class="support-checkout-row">
            <span>Metode:</span>
            <span style="text-transform:uppercase;">${escapeHtml(gift.paymentMethod || 'qris')}</span>
          </div>
          <div class="support-checkout-row">
            <span>Atas Nama:</span>
            <span>${escapeHtml(gift.name)}</span>
          </div>
          ${gift.giftId ? `
          <div class="support-checkout-row">
            <span>ID Donasi:</span>
            <span style="font-family:monospace; font-size:0.8rem; color:var(--text-dim);">${escapeHtml(gift.giftId.slice(0, 16))}...</span>
          </div>` : ''}
        </div>

        <div class="support-checkout-actions">
          ${gift.paymentUrl ? `
          <a href="${escapeHtml(gift.paymentUrl)}" target="_blank" rel="noopener noreferrer" class="support-pay-btn">
            <span>Bayar Sekarang 🚀</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>` : ''}

          <button type="button" class="support-check-btn" id="checkPaymentStatusBtn" data-giftid="${escapeHtml(gift.giftId || '')}">
            <span>🔄 Cek Status</span>
          </button>
        </div>

        <div id="checkoutFeedbackMsg" style="font-size:0.82rem; color:var(--text-dim); line-height:1.4;">
          Selesaikan pembayaran di halaman pembayaran yang terbuka. Status akan otomatis terverifikasi secara berkala.
        </div>
      </div>
    `;

    checkoutContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    const checkBtn = document.getElementById('checkPaymentStatusBtn');
    checkBtn?.addEventListener('click', () => {
      checkGiftStatus(gift.giftId);
    });

    // Start background status polling (every 4 seconds, for 3 minutes)
    if (gift.giftId) {
      let pollAttempts = 0;
      supportPollingTimer = setInterval(async () => {
        pollAttempts++;
        if (pollAttempts > 45) {
          clearInterval(supportPollingTimer);
          supportPollingTimer = null;
          return;
        }
        const done = await checkGiftStatus(gift.giftId, true);
        if (done) {
          clearInterval(supportPollingTimer);
          supportPollingTimer = null;
        }
      }, 4000);
    }
  }

  async function checkGiftStatus(giftId, isSilent = false) {
    if (!giftId) return false;
    const badge = document.getElementById('checkoutStatusBadge');
    const feedback = document.getElementById('checkoutFeedbackMsg');
    const checkBtn = document.getElementById('checkPaymentStatusBtn');

    if (!isSilent && checkBtn) {
      checkBtn.disabled = true;
      checkBtn.innerHTML = '<span>⏳ Memeriksa...</span>';
    }

    try {
      const res = await fetch(`/api/support/status/${encodeURIComponent(giftId)}`);
      const data = await res.json();

      if (!isSilent && checkBtn) {
        checkBtn.disabled = false;
        checkBtn.innerHTML = '<span>🔄 Cek Status</span>';
      }

      if (data.success && data.data) {
        const status = (data.data.status || '').toLowerCase();

        if (status === 'success') {
          if (badge) {
            badge.className = 'support-status-badge support-status-success';
            badge.textContent = '🎉 Pembayaran Berhasil!';
          }
          if (feedback) {
            feedback.innerHTML = '<strong style="color:#34d399;">Terima kasih banyak! Donasi Anda telah berhasil dikonfirmasi. Dukungan Anda membantu Streamcal tetap gratis & online! 🌟</strong>';
          }
          // Refresh supporters list to show new donor
          loadSupportConfig();
          return true;
        } else if (status === 'failed') {
          if (badge) {
            badge.className = 'support-status-badge support-status-failed';
            badge.textContent = '✕ Pembayaran Dibatalkan / Gagal';
          }
          return true;
        } else {
          if (!isSilent && feedback) {
            feedback.textContent = `Status transaksi saat ini: ${status || 'Menunggu konfirmasi pembayaran'}.`;
          }
        }
      }
    } catch (err) {
      if (!isSilent && feedback) {
        feedback.textContent = 'Gagal memeriksa status: ' + err.message;
      }
    }
    return false;
  }

  function renderSupportersList(supporters) {
    const container = document.getElementById('supportersListContainer');
    if (!container) return;

    if (!supporters || supporters.length === 0) {
      container.innerHTML = `
        <div class="supporter-empty-state">
          <span style="font-size:1.6rem;">💖</span>
          <p>Belum ada pendukung terdaftar.</p>
          <span style="font-size:0.78rem; color:var(--text-dim);">Jadilah pendukung pertama hari ini!</span>
        </div>
      `;
      return;
    }

    let html = '';
    supporters.forEach(s => {
      const initial = (s.name || 'A').charAt(0).toUpperCase();
      const amountStr = formatRupiah(s.amount);
      const timeStr = s.createdAt ? timeAgo(s.createdAt) : '';

      html += `
        <div class="supporter-item">
          <div class="supporter-top-row">
            <div class="supporter-name-badge">
              <div class="supporter-avatar">${escapeHtml(initial)}</div>
              <span>${escapeHtml(s.name)}</span>
            </div>
            <span class="supporter-amount-pill">${escapeHtml(amountStr)}</span>
          </div>
          ${s.message ? `<div class="supporter-msg">"${escapeHtml(s.message)}"</div>` : ''}
          <div class="supporter-time">${escapeHtml(timeStr)}</div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // Helper Functions
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/`/g, '&#96;');
  }

  function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return '#';
    const trimmed = url.trim();
    if (/^(https?:\/\/|\/)/i.test(trimmed) && !/^(javascript|data|vbscript):/i.test(trimmed)) {
      return escapeHtml(trimmed);
    }
    return '#';
  }
});

