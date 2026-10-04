/**
 * STREAMCAL - Dedicated Support Page Client Logic
 * Handles country/region guidance (ID, MY, SG, US), custom amounts, presets, and checkout verification
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

  // Country Currency Configurations & Approximate Conversion Rates
  const COUNTRY_CONFIGS = {
    id: {
      name: 'Indonesia',
      flag: '🇮🇩',
      currency: 'IDR',
      symbol: 'Rp',
      rate: 1, // 1 IDR = 1 IDR
      defaultMethod: 'qris',
      helpText: '<strong>Indonesia (IDR):</strong> Mendukung pembayaran instan via QRIS (Semua Bank & e-Wallet), GoPay, DANA, dan PayPal/Kartu Kredit.',
      methodsRecommendation: 'Rekomendasi: QRIS, GoPay, DANA',
      qrisNote: 'BCA, Mandiri, BRI, GoPay, OVO, DANA, ShopeePay',
      paypalNote: 'Kartu Debit & Kredit / Saldo PayPal'
    },
    my: {
      name: 'Malaysia',
      flag: '🇲🇾',
      currency: 'MYR',
      symbol: 'RM',
      rate: 3600, // ~1 MYR = 3,600 IDR
      defaultMethod: 'qris',
      helpText: '<strong>Malaysia (MYR):</strong> Anda dapat scan <strong>QRIS Cross-Border via DuitNow QR</strong> (Maybank MAE, CIMB OCTO, Touch \'n Go eWallet, Public Bank, Boost) atau bayar via <strong>PayPal / Kartu Kredit</strong>.',
      methodsRecommendation: '🇲🇾 Rekomendasi: QRIS (DuitNow) & PayPal',
      qrisNote: 'DuitNow QR (Maybank MAE, CIMB, Touch \'n Go eWallet, Public Bank)',
      paypalNote: 'PayPal & Kartu Kredit/Debit Malaysia (MYR)'
    },
    sg: {
      name: 'Singapore',
      flag: '🇸🇬',
      currency: 'SGD',
      symbol: 'S$',
      rate: 12000, // ~1 SGD = 12,000 IDR
      defaultMethod: 'qris',
      helpText: '<strong>Singapore (SGD):</strong> Anda dapat scan <strong>QRIS Cross-Border via PayNow / NETS</strong> (DBS PayLah!, OCBC Digital, UOB TMRW, NETS) atau bayar via <strong>PayPal / Kartu Kredit</strong>.',
      methodsRecommendation: '🇸🇬 Rekomendasi: QRIS (PayNow/NETS) & PayPal',
      qrisNote: 'PayNow / NETS (DBS PayLah!, OCBC Digital, UOB TMRW)',
      paypalNote: 'PayPal & Kartu Kredit/Debit Singapura (SGD)'
    },
    us: {
      name: 'United States',
      flag: '🇺🇸',
      currency: 'USD',
      symbol: '$',
      rate: 15900, // ~1 USD = 15,900 IDR
      defaultMethod: 'paypal',
      helpText: '<strong>United States & Global (USD):</strong> Mendukung pembayaran via <strong>PayPal & seluruh Kartu Debit / Kredit internasional</strong> (Visa, MasterCard, American Express, Discover) dengan konversi otomatis dalam USD.',
      methodsRecommendation: '🇺🇸 Rekomendasi: PayPal / International Card',
      qrisNote: 'QRIS (Mendukung aplikasi perbankan mitra tertentu)',
      paypalNote: 'United States (USD) & Semua Kartu Internasional'
    }
  };

  // State
  let selectedCountry = 'id';
  let supportSelectedAmount = 10000;
  let supportSelectedMethod = 'qris';
  let supportPollingTimer = null;

  // DOM Elements
  const countryBtns = document.querySelectorAll('.support-country-btn');
  const countryHelpIcon = document.getElementById('countryHelpIcon');
  const countryHelpText = document.getElementById('countryHelpText');
  const methodRecommendationTag = document.getElementById('methodRecommendationTag');
  const qrisSubText = document.getElementById('qrisSubText');
  const paypalSubText = document.getElementById('paypalSubText');

  const presetBtns = document.querySelectorAll('.support-preset-btn');
  const supportAmountInput = document.getElementById('supportAmountInput');
  const currencyApproxText = document.getElementById('currencyApproxText');
  const submitBtn = document.getElementById('supportSubmitBtn');
  const submitBtnText = document.getElementById('supportSubmitBtnText');
  const methodCards = document.querySelectorAll('.support-method-card');
  const supportForm = document.getElementById('supportForm');
  const refreshSupportersBtn = document.getElementById('refreshSupportersBtn');

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

  // Update Country UI & Method Guidance
  function selectCountry(countryKey) {
    const cfg = COUNTRY_CONFIGS[countryKey] || COUNTRY_CONFIGS.id;
    selectedCountry = countryKey;

    // Toggle active country button
    countryBtns.forEach(btn => {
      if (btn.getAttribute('data-country') === countryKey) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update helper banner
    if (countryHelpIcon) countryHelpIcon.textContent = cfg.flag;
    if (countryHelpText) countryHelpText.innerHTML = cfg.helpText;
    if (methodRecommendationTag) methodRecommendationTag.textContent = cfg.methodsRecommendation;
    if (qrisSubText) qrisSubText.textContent = cfg.qrisNote;
    if (paypalSubText) paypalSubText.textContent = cfg.paypalNote;

    // Switch default method if switching to US
    if (countryKey === 'us') {
      selectPaymentMethod('paypal');
    } else if (supportSelectedMethod === 'paypal' && (countryKey === 'id' || countryKey === 'my' || countryKey === 'sg')) {
      // Keep or let user choose, but if qris was default
      selectPaymentMethod('qris');
    }

    updateAmountAndCurrencyUI();
  }

  // Handle Country selection click
  countryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const c = btn.getAttribute('data-country');
      if (c && COUNTRY_CONFIGS[c]) {
        selectCountry(c);
      }
    });
  });

  // Update Currency Conversion & Submit Button Text
  function updateAmountAndCurrencyUI() {
    const amt = supportSelectedAmount || 10000;
    const cfg = COUNTRY_CONFIGS[selectedCountry] || COUNTRY_CONFIGS.id;

    if (currencyApproxText) {
      if (selectedCountry === 'id') {
        currencyApproxText.textContent = `≈ ${formatRupiah(amt)} IDR`;
      } else {
        const foreignVal = (amt / cfg.rate).toFixed(2);
        currencyApproxText.textContent = `≈ ${cfg.symbol} ${foreignVal} ${cfg.currency} (${formatRupiah(amt)})`;
      }
    }

    if (submitBtnText) {
      if (selectedCountry === 'id') {
        submitBtnText.textContent = `Kirim Dukungan (${formatRupiah(amt)})`;
      } else {
        const foreignVal = (amt / cfg.rate).toFixed(2);
        submitBtnText.textContent = `Kirim Dukungan (${cfg.symbol} ${foreignVal} / ${formatRupiah(amt)})`;
      }
    }
  }

  // Preset button click handling
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const amt = parseInt(btn.getAttribute('data-amount'), 10) || 10000;
      supportSelectedAmount = amt;
      if (supportAmountInput) {
        supportAmountInput.value = amt;
      }
      updateAmountAndCurrencyUI();
    });
  });

  // Custom Amount Input typing
  supportAmountInput?.addEventListener('input', () => {
    const rawVal = supportAmountInput.value.replace(/[^0-9]/g, '');
    const val = parseInt(rawVal, 10) || 0;
    supportSelectedAmount = val;

    // Highlight matching preset if any, else unhighlight
    let matchedPreset = false;
    presetBtns.forEach(btn => {
      const btnAmt = parseInt(btn.getAttribute('data-amount'), 10);
      if (btnAmt === val) {
        btn.classList.add('active');
        matchedPreset = true;
      } else {
        btn.classList.remove('active');
      }
    });

    updateAmountAndCurrencyUI();
  });

  // Payment Method Selection
  function selectPaymentMethod(methodName) {
    supportSelectedMethod = methodName;
    methodCards.forEach(card => {
      if (card.getAttribute('data-method') === methodName) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });
  }

  methodCards.forEach(card => {
    card.addEventListener('click', () => {
      const m = card.getAttribute('data-method') || 'qris';
      selectPaymentMethod(m);
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

  // Render Hall of Supporters
  function renderSupportersList(supporters) {
    const container = document.getElementById('supportersListContainer');
    if (!container) return;

    if (!supporters || supporters.length === 0) {
      container.innerHTML = `
        <div class="supporter-empty-state">
          <span>💖</span>
          <p>Belum ada pendukung terbaru.<br>Jadilah yang pertama mendukung server Streamcal!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = supporters.map(sup => `
      <div class="supporter-item">
        <div class="supporter-avatar">💖</div>
        <div class="supporter-details">
          <div class="supporter-top">
            <span class="supporter-name">${escapeHtml(sup.name || 'Supporter')}</span>
            <span class="supporter-amount">${formatRupiah(sup.amount)}</span>
          </div>
          ${sup.message ? `<div class="supporter-msg">"${escapeHtml(sup.message)}"</div>` : ''}
          <div class="supporter-time">${timeAgo(sup.createdAt)}</div>
        </div>
      </div>
    `).join('');
  }

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
      supportAmountInput?.focus();
      return;
    }

    if (amount > 50000000) {
      alert('Nominal dukungan maksimal Rp 50.000.000.');
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
      updateAmountAndCurrencyUI();
    }
  });

  // Render Checkout Ticket
  function renderCheckoutCard(gift) {
    const checkoutContainer = document.getElementById('supportCheckoutContainer');
    if (!checkoutContainer) return;

    if (supportPollingTimer) {
      clearInterval(supportPollingTimer);
      supportPollingTimer = null;
    }

    const cfg = COUNTRY_CONFIGS[selectedCountry] || COUNTRY_CONFIGS.id;
    let countryPaymentTip = '';

    if (gift.paymentMethod === 'qris') {
      if (selectedCountry === 'my') {
        countryPaymentTip = `
          <div style="margin-top:10px; padding:8px 12px; background:rgba(16, 185, 129, 0.1); border-left:3px solid #10b981; border-radius:4px; font-size:0.8rem; color:var(--text-main);">
            🇲🇾 <strong>Petunjuk Supporter Malaysia:</strong> Buka aplikasi <strong>Maybank MAE, CIMB OCTO, Public Bank</strong> atau <strong>Touch 'n Go eWallet</strong> > Pilih <em>Scan QR</em> > Arahkan ke kode QRIS di halaman pembayaran untuk bayar instan via DuitNow Cross-Border.
          </div>
        `;
      } else if (selectedCountry === 'sg') {
        countryPaymentTip = `
          <div style="margin-top:10px; padding:8px 12px; background:rgba(16, 185, 129, 0.1); border-left:3px solid #10b981; border-radius:4px; font-size:0.8rem; color:var(--text-main);">
            🇸🇬 <strong>Petunjuk Supporter Singapore:</strong> Buka aplikasi <strong>DBS PayLah!, OCBC Digital, UOB TMRW</strong> atau <strong>NETS</strong> > Pilih <em>Scan QR</em> > Arahkan ke kode QRIS di halaman pembayaran untuk bayar instan via PayNow Cross-Border.
          </div>
        `;
      } else {
        countryPaymentTip = `
          <div style="margin-top:10px; padding:8px 12px; background:rgba(99, 102, 241, 0.08); border-left:3px solid var(--accent-primary); border-radius:4px; font-size:0.8rem; color:var(--text-muted);">
            📱 Buka aplikasi BCA, Mandiri Livin, BRImo, GoPay, OVO, ShopeePay atau DANA > Scan QRIS untuk menyelesaikan pembayaran.
          </div>
        `;
      }
    } else if (gift.paymentMethod === 'paypal') {
      countryPaymentTip = `
        <div style="margin-top:10px; padding:8px 12px; background:rgba(99, 102, 241, 0.08); border-left:3px solid var(--accent-primary); border-radius:4px; font-size:0.8rem; color:var(--text-muted);">
          💳 Masuk menggunakan akun PayPal atau pilih tombol <strong>"Pay with Debit or Credit Card"</strong> di halaman PayPal untuk menyelesaikan pembayaran.
        </div>
      `;
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
            <span style="color:#34d399; font-size:1.05rem; font-weight:800;">
              ${formatRupiah(gift.amount)}
              ${selectedCountry !== 'id' ? `<span style="font-size:0.85rem; color:var(--text-muted); font-weight:500;">(≈ ${cfg.symbol} ${(gift.amount / cfg.rate).toFixed(2)} ${cfg.currency})</span>` : ''}
            </span>
          </div>
          <div class="support-checkout-row">
            <span>Metode:</span>
            <span style="text-transform:uppercase; font-weight:700;">${escapeHtml(gift.paymentMethod || 'qris')}</span>
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

        ${countryPaymentTip}

        <div class="support-checkout-actions" style="margin-top:14px;">
          ${gift.paymentUrl ? `
          <a href="${escapeHtml(gift.paymentUrl)}" target="_blank" rel="noopener noreferrer" class="support-pay-btn">
            <span>Bayar Sekarang 🚀</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>` : ''}

          <button type="button" class="support-check-btn" id="checkPaymentStatusBtn" data-giftid="${escapeHtml(gift.giftId || '')}">
            <span>🔄 Cek Status</span>
          </button>
        </div>

        <div id="checkoutFeedbackMsg" style="font-size:0.82rem; color:var(--text-dim); line-height:1.4; margin-top:8px;">
          Selesaikan pembayaran di halaman yang terbuka. Status akan otomatis terverifikasi secara berkala.
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

  // Check Gift status from server API
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
            badge.innerHTML = '✅ Pembayaran Berhasil!';
          }
          if (feedback) {
            feedback.innerHTML = '<span style="color:#34d399; font-weight:700;">Terima kasih banyak atas dukungan Anda untuk Streamcal! 💖</span>';
          }
          loadSupportData();
          return true;
        } else if (status === 'failed' || status === 'reversed') {
          if (badge) {
            badge.className = 'support-status-badge';
            badge.style.background = 'rgba(239, 68, 68, 0.15)';
            badge.style.color = '#f87171';
            badge.innerHTML = '❌ Pembayaran Dibatalkan';
          }
          return true;
        } else {
          if (badge) {
            badge.className = 'support-status-badge support-status-pending';
            badge.innerHTML = '⏳ Menunggu Pembayaran';
          }
          if (!isSilent && feedback) {
            feedback.textContent = 'Pembayaran belum terdeteksi. Silakan selesaikan pembayaran lalu klik tombol cek status lagi.';
          }
        }
      }
    } catch (err) {
      if (!isSilent && checkBtn) {
        checkBtn.disabled = false;
        checkBtn.innerHTML = '<span>🔄 Cek Status</span>';
      }
      console.warn('Status check error:', err);
    }

    return false;
  }

  // Initial UI sync
  updateAmountAndCurrencyUI();
});
