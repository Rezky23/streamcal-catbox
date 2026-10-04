/**
 * STREAMCAL - Dedicated Support Page Client Logic
 * Handles donation presets, checkout processing, and live status verification
 */

document.addEventListener('DOMContentLoaded', () => {
  // Theme Management
  const themeToggle = document.getElementById('themeToggle');
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

  // State
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

  // Preset button handling
  const presetBtns = document.querySelectorAll('.support-preset-btn');
  const customAmountWrap = document.getElementById('customAmountWrap');
  const supportAmountInput = document.getElementById('supportAmountInput');
  const submitBtn = document.getElementById('supportSubmitBtn');
  const submitBtnText = document.getElementById('supportSubmitBtnText');
  const methodCards = document.querySelectorAll('.support-method-card');
  const supportForm = document.getElementById('supportForm');
  const refreshSupportersBtn = document.getElementById('refreshSupportersBtn');

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

  // Custom amount typing
  supportAmountInput?.addEventListener('input', () => {
    const val = parseInt(supportAmountInput.value, 10) || 0;
    supportSelectedAmount = val;
    if (submitBtnText) {
      submitBtnText.textContent = `Kirim Dukungan (${formatRupiah(val)})`;
    }
  });

  // Payment method selection
  methodCards.forEach(card => {
    card.addEventListener('click', () => {
      methodCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      supportSelectedMethod = card.getAttribute('data-method') || 'qris';
    });
  });

  // Load Supporters & Config on page load
  loadSupportData();

  async function loadSupportData() {
    try {
      const res = await fetch('/api/support/config');
      const data = await res.json();
      if (data.success && data.data) {
        renderSupportersList(data.data.recentSupporters || []);
      }
    } catch (err) {
      console.warn('Failed to load support config:', err);
    }
  }

  // Refresh supporters
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

  // Handle Form Submission
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

    // Background polling every 4 seconds
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
          loadSupportData();
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
});
