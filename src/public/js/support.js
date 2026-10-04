/**
 * STREAMCAL - Dedicated Support Page Client Logic
 * Faithfully structured after Tako Gift UI layout (https://tako.id/streamcal/gift)
 * Handles multicurrency (IDR, MYR, SGD, USD), country routing, presets, custom amounts, and checkout
 */

document.addEventListener('DOMContentLoaded', () => {
  // Multicurrency & Country Configurations
  const CURRENCY_CONFIG = {
    IDR: {
      symbol: 'Rp',
      country: 'id',
      minAlert: 'Jumlah Minimum Muncul di Alert: IDR 1.000',
      presets: [5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000],
      defaultVal: 10000,
      rateToIdr: 1,
      format: (val) => 'IDR ' + Number(val).toLocaleString('id-ID')
    },
    MYR: {
      symbol: 'RM',
      country: 'my',
      minAlert: 'Jumlah Minimum Muncul di Alert: MYR 1.00',
      presets: [5, 10, 20, 50, 100, 200],
      defaultVal: 10,
      rateToIdr: 3600,
      format: (val) => 'MYR ' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    },
    SGD: {
      symbol: 'S$',
      country: 'sg',
      minAlert: 'Jumlah Minimum Muncul di Alert: SGD 0.72',
      presets: [2, 5, 10, 25, 50, 100],
      defaultVal: 5,
      rateToIdr: 12000,
      format: (val) => 'SGD ' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    },
    USD: {
      symbol: '$',
      country: 'us',
      minAlert: 'Jumlah Minimum Muncul di Alert: USD 1.00',
      presets: [1, 3, 5, 10, 25, 50],
      defaultVal: 5,
      rateToIdr: 15900,
      format: (val) => 'USD ' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    }
  };

  // State
  let currentCurrency = 'IDR';
  let currentCountry = 'id';
  let rawAmountValue = 10000;
  let selectedMethod = 'qris';
  let supportPollingTimer = null;

  // DOM Elements
  const topAnnounceBar = document.getElementById('topAnnounceBar');
  const closeAnnounceBtn = document.getElementById('closeAnnounceBtn');

  const tabGiftBtn = document.getElementById('tabGiftBtn');
  const tabSupportersBtn = document.getElementById('tabSupportersBtn');
  const tabAboutBtn = document.getElementById('tabAboutBtn');

  const viewTabGift = document.getElementById('viewTabGift');
  const viewTabSupporters = document.getElementById('viewTabSupporters');
  const viewTabAbout = document.getElementById('viewTabAbout');

  const currencySelector = document.getElementById('currencySelector');
  const supportAmountInput = document.getElementById('supportAmountInput');
  const alertMinText = document.getElementById('alertMinText');
  const presetChipsWrap = document.getElementById('presetChipsWrap');

  const countryPaymentSelect = document.getElementById('countryPaymentSelect');
  const methodCards = document.querySelectorAll('.tako-method-card');
  const qrisBadgeText = document.getElementById('qrisBadgeText');
  const methodCardGopay = document.getElementById('methodCardGopay');
  const methodCardDana = document.getElementById('methodCardDana');

  const summaryItemLabel = document.getElementById('summaryItemLabel');
  const summaryItemValue = document.getElementById('summaryItemValue');
  const summaryTotalValue = document.getElementById('summaryTotalValue');

  const quickEmojiBtn = document.getElementById('quickEmojiBtn');
  const supportMessageInput = document.getElementById('supportMessageInput');
  const supportForm = document.getElementById('supportForm');
  const supportSubmitBtn = document.getElementById('supportSubmitBtn');
  const supportSubmitBtnText = document.getElementById('supportSubmitBtnText');
  const supportCheckoutContainer = document.getElementById('supportCheckoutContainer');
  const refreshSupportersBtn = document.getElementById('refreshSupportersBtn');

  // Announcement close
  closeAnnounceBtn?.addEventListener('click', () => {
    if (topAnnounceBar) topAnnounceBar.style.display = 'none';
  });

  // Tab switching
  function switchTab(tabKey) {
    const tabs = [
      { key: 'gift', btn: tabGiftBtn, view: viewTabGift },
      { key: 'supporters', btn: tabSupportersBtn, view: viewTabSupporters },
      { key: 'about', btn: tabAboutBtn, view: viewTabAbout }
    ];

    tabs.forEach(t => {
      if (t.key === tabKey) {
        t.btn?.classList.add('active');
        t.view?.classList.remove('hidden');
      } else {
        t.btn?.classList.remove('active');
        t.view?.classList.add('hidden');
      }
    });

    if (tabKey === 'supporters') {
      loadSupporters();
    }
  }

  tabGiftBtn?.addEventListener('click', () => switchTab('gift'));
  tabSupportersBtn?.addEventListener('click', () => switchTab('supporters'));
  tabAboutBtn?.addEventListener('click', () => switchTab('about'));

  // Quick Emoji Button
  const emojis = ['💖', '🔥', '✨', '☕', '🚀', '🥰', '🍕', '🎉', '👏', '⭐'];
  quickEmojiBtn?.addEventListener('click', () => {
    if (!supportMessageInput) return;
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    supportMessageInput.value = (supportMessageInput.value + ' ' + randomEmoji).trim();
    supportMessageInput.focus();
  });

  // Render Preset Chips for current currency
  function renderPresetChips() {
    if (!presetChipsWrap) return;
    const cfg = CURRENCY_CONFIG[currentCurrency] || CURRENCY_CONFIG.IDR;
    presetChipsWrap.innerHTML = '';

    cfg.presets.forEach(p => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'preset-chip-btn' + (rawAmountValue === p ? ' active' : '');
      chip.textContent = cfg.format(p);
      chip.dataset.amount = p;

      chip.addEventListener('click', () => {
        rawAmountValue = p;
        if (supportAmountInput) {
          supportAmountInput.value = formatInputDisplay(p, currentCurrency);
        }
        updatePresetChipActiveState();
        updateSummaryBox();
      });

      presetChipsWrap.appendChild(chip);
    });
  }

  function updatePresetChipActiveState() {
    const chips = presetChipsWrap?.querySelectorAll('.preset-chip-btn');
    chips?.forEach(chip => {
      const amt = Number(chip.dataset.amount);
      if (amt === rawAmountValue) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
  }

  function formatInputDisplay(val, curr) {
    if (curr === 'IDR') {
      return Number(val).toLocaleString('id-ID');
    }
    return String(val);
  }

  // Update Summary Box
  function updateSummaryBox() {
    const cfg = CURRENCY_CONFIG[currentCurrency] || CURRENCY_CONFIG.IDR;
    const displayStr = cfg.format(rawAmountValue);

    // Calculate equivalent IDR if foreign currency
    const idrAmount = Math.round(rawAmountValue * cfg.rateToIdr);
    const idrStr = 'IDR ' + idrAmount.toLocaleString('id-ID');

    if (summaryItemLabel) {
      summaryItemLabel.textContent = `Pembelian ${displayStr}`;
    }
    if (summaryItemValue) {
      summaryItemValue.textContent = displayStr;
    }
    if (summaryTotalValue) {
      if (currentCurrency === 'IDR') {
        summaryTotalValue.textContent = displayStr;
      } else {
        summaryTotalValue.textContent = `${displayStr} (≈ ${idrStr})`;
      }
    }
    if (supportSubmitBtnText) {
      supportSubmitBtnText.textContent = `Lakukan Pembayaran (${displayStr})`;
    }
  }

  // Currency Selector Changed
  currencySelector?.addEventListener('change', () => {
    const newCurr = currencySelector.value;
    if (CURRENCY_CONFIG[newCurr]) {
      currentCurrency = newCurr;
      const cfg = CURRENCY_CONFIG[newCurr];
      rawAmountValue = cfg.defaultVal;

      if (supportAmountInput) {
        supportAmountInput.value = formatInputDisplay(rawAmountValue, currentCurrency);
      }
      if (alertMinText) {
        alertMinText.textContent = cfg.minAlert;
      }

      // Sync Country dropdown
      if (countryPaymentSelect && countryPaymentSelect.value !== cfg.country) {
        countryPaymentSelect.value = cfg.country;
        syncCountryPaymentRules(cfg.country);
      }

      renderPresetChips();
      updateSummaryBox();
    }
  });

  // Country Payment Select Changed
  countryPaymentSelect?.addEventListener('change', () => {
    const country = countryPaymentSelect.value;
    syncCountryPaymentRules(country);

    // Sync Currency
    let matchedCurr = 'IDR';
    if (country === 'my') matchedCurr = 'MYR';
    else if (country === 'sg') matchedCurr = 'SGD';
    else if (country === 'us') matchedCurr = 'USD';

    if (currencySelector && currencySelector.value !== matchedCurr) {
      currencySelector.value = matchedCurr;
      currentCurrency = matchedCurr;
      const cfg = CURRENCY_CONFIG[matchedCurr];
      rawAmountValue = cfg.defaultVal;
      if (supportAmountInput) {
        supportAmountInput.value = formatInputDisplay(rawAmountValue, currentCurrency);
      }
      if (alertMinText) {
        alertMinText.textContent = cfg.minAlert;
      }
      renderPresetChips();
      updateSummaryBox();
    }
  });

  // Adjust payment methods according to selected country
  function syncCountryPaymentRules(country) {
    currentCountry = country;

    if (country === 'us') {
      // US prefers PayPal
      selectPaymentMethod('paypal');
      if (methodCardGopay) methodCardGopay.style.opacity = '0.4';
      if (methodCardDana) methodCardDana.style.opacity = '0.4';
      if (qrisBadgeText) qrisBadgeText.textContent = 'Mitra';
    } else if (country === 'my') {
      selectPaymentMethod('qris');
      if (qrisBadgeText) qrisBadgeText.textContent = 'DuitNow';
      if (methodCardGopay) methodCardGopay.style.opacity = '0.4';
      if (methodCardDana) methodCardDana.style.opacity = '0.4';
    } else if (country === 'sg') {
      selectPaymentMethod('qris');
      if (qrisBadgeText) qrisBadgeText.textContent = 'PayNow';
      if (methodCardGopay) methodCardGopay.style.opacity = '0.4';
      if (methodCardDana) methodCardDana.style.opacity = '0.4';
    } else {
      // Indonesia
      selectPaymentMethod('qris');
      if (qrisBadgeText) qrisBadgeText.textContent = 'Instan';
      if (methodCardGopay) methodCardGopay.style.opacity = '1';
      if (methodCardDana) methodCardDana.style.opacity = '1';
    }
  }

  // Numerical amount input typing
  supportAmountInput?.addEventListener('input', () => {
    let clean = supportAmountInput.value.replace(/[^0-9.]/g, '');
    const num = parseFloat(clean) || 0;
    rawAmountValue = num;

    updatePresetChipActiveState();
    updateSummaryBox();
  });

  // Payment Method Selection
  function selectPaymentMethod(methodName) {
    selectedMethod = methodName;
    methodCards.forEach(card => {
      if (card.dataset.method === methodName) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });
  }

  methodCards.forEach(card => {
    card.addEventListener('click', () => {
      const m = card.dataset.method || 'qris';
      selectPaymentMethod(m);
    });
  });

  // Form Submission
  supportForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nameInput = document.getElementById('supportNameInput');
    const emailInput = document.getElementById('supportEmailInput');
    const messageInput = document.getElementById('supportMessageInput');

    const name = nameInput?.value?.trim();
    const email = emailInput?.value?.trim();
    const message = messageInput?.value?.trim() || '';

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

    // Convert to IDR for backend Tako API
    const cfg = CURRENCY_CONFIG[currentCurrency] || CURRENCY_CONFIG.IDR;
    const idrAmount = Math.max(1000, Math.round(rawAmountValue * cfg.rateToIdr));

    if (idrAmount < 1000) {
      alert('Nominal dukungan minimal Rp 1.000 (IDR 1.000).');
      supportAmountInput?.focus();
      return;
    }

    if (idrAmount > 50000000) {
      alert('Nominal dukungan maksimal Rp 50.000.000 (IDR 50.000.000).');
      supportAmountInput?.focus();
      return;
    }

    if (supportSubmitBtn) supportSubmitBtn.disabled = true;
    if (supportSubmitBtnText) supportSubmitBtnText.textContent = 'Memproses Pembayaran...';

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
          amount: idrAmount,
          paymentMethod: selectedMethod,
          message
        })
      });

      const data = await res.json();

      if (data.isConfigured === false) {
        renderFallbackCard(data);
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal memproses pembayaran donasi.');
      }

      const gift = data.data;
      let popupHandle = null;

      if (gift.paymentUrl) {
        popupHandle = openPaymentPopup(gift.paymentUrl);
      }

      renderCheckoutCard(gift, popupHandle);
    } catch (err) {
      alert('Terjadi kesalahan: ' + err.message);
    } finally {
      if (supportSubmitBtn) supportSubmitBtn.disabled = false;
      updateSummaryBox();
    }
  });

  // Open centered seamless payment popup window
  function openPaymentPopup(url) {
    if (!url) return null;
    const popupWidth = 480;
    const popupHeight = 720;
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - popupWidth) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - popupHeight) / 2));

    try {
      if (paymentPopupWindow && !paymentPopupWindow.closed) {
        paymentPopupWindow.location.href = url;
        paymentPopupWindow.focus();
        return paymentPopupWindow;
      }
    } catch (_) {}

    try {
      paymentPopupWindow = window.open(
        url,
        'StreamcalPaymentModal',
        `width=${popupWidth},height=${popupHeight},left=${left},top=${top},status=no,menubar=no,toolbar=no,location=no,scrollbars=yes,resizable=yes`
      );
    } catch (e) {
      console.warn('Popup blocked:', e);
      paymentPopupWindow = null;
    }

    return paymentPopupWindow;
  }

  // Render Fallback card if Tako is in setup mode
  function renderFallbackCard(data) {
    if (!supportCheckoutContainer) return;
    supportCheckoutContainer.style.display = 'block';
    supportCheckoutContainer.innerHTML = `
      <div class="tako-checkout-card" style="border-color:#f59e0b;">
        <div class="tako-checkout-header">
          <div style="font-weight:700; color:#f59e0b; font-size:1rem;">⚠️ Status Sistem Donasi</div>
        </div>
        <p style="font-size:0.88rem; color:var(--tako-text-muted); line-height:1.5;">
          ${escapeHtml(data.message || 'Layanan donasi sedang dalam penyiapan sistem.')}
        </p>
        <div style="display:flex; gap:10px;">
          <a href="${escapeHtml(data.fallbackUrl || '#')}" target="_blank" rel="noopener noreferrer" class="tako-pay-link">
            <span>Buka Profil Kreator Streamcal</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </div>
      </div>
    `;
    supportCheckoutContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Render Active Checkout Ticket (Option A: Seamless Popup & Live Polling)
  function renderCheckoutCard(gift, popupHandle) {
    if (!supportCheckoutContainer) return;

    if (supportPollingTimer) {
      clearInterval(supportPollingTimer);
      supportPollingTimer = null;
    }

    const cfg = CURRENCY_CONFIG[currentCurrency] || CURRENCY_CONFIG.IDR;
    const formattedIdr = 'IDR ' + Number(gift.amount).toLocaleString('id-ID');
    const originalDisplay = currentCurrency !== 'IDR' ? `${cfg.format(rawAmountValue)} (${formattedIdr})` : formattedIdr;
    const isPopupBlocked = !popupHandle || popupHandle.closed || typeof popupHandle.closed === 'undefined';

    let countryTip = '';
    if (gift.paymentMethod === 'qris') {
      if (currentCountry === 'my') {
        countryTip = `🇲🇾 <strong>Petunjuk DuitNow:</strong> Buka aplikasi Maybank MAE, CIMB OCTO, atau Touch 'n Go eWallet > Scan QR > Arahkan ke kode QRIS di jendela pembayaran pop-up.`;
      } else if (currentCountry === 'sg') {
        countryTip = `🇸🇬 <strong>Petunjuk PayNow:</strong> Buka aplikasi DBS PayLah!, OCBC Digital, UOB TMRW, atau NETS > Scan QR > Arahkan ke kode QRIS di jendela pembayaran pop-up.`;
      } else {
        countryTip = `📱 Buka aplikasi BCA, Mandiri Livin, BRImo, GoPay, OVO, ShopeePay atau DANA > Scan kode QRIS di jendela pembayaran.`;
      }
    } else if (gift.paymentMethod === 'paypal') {
      countryTip = `💳 Masuk ke akun PayPal Anda atau pilih opsi <strong>"Pay with Debit or Credit Card"</strong> di jendela pop-up yang terbuka.`;
    }

    supportCheckoutContainer.style.display = 'block';
    supportCheckoutContainer.innerHTML = `
      <div class="tako-checkout-card" id="activeCheckoutCard">
        <div class="tako-checkout-header">
          <div style="font-weight:800; color:#ffffff; font-size:1.05rem; display:flex; align-items:center; gap:8px;">
            <span>💖</span> Tiket Pembayaran Dukungan
          </div>
          <span class="tako-status-badge" id="checkoutBadge">
            <span class="pulse-dot"></span> ⏳ Menunggu Pembayaran...
          </span>
        </div>

        <div style="display:flex; flex-direction:column; gap:8px; font-size:0.9rem; padding:12px; background:#111923; border-radius:8px; border:1px solid #1e2b3c;">
          <div style="display:flex; justify-content:space-between;">
            <span style="color:var(--tako-text-dim);">Nominal Hadiah:</span>
            <span style="color:#34d399; font-weight:800;">${originalDisplay}</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color:var(--tako-text-dim);">Metode:</span>
            <span style="text-transform:uppercase; font-weight:700; color:#ffffff;">${escapeHtml(gift.paymentMethod || 'qris')}</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color:var(--tako-text-dim);">Atas Nama:</span>
            <span style="color:#ffffff;">${escapeHtml(gift.name)}</span>
          </div>
          ${gift.giftId ? `
          <div style="display:flex; justify-content:space-between;">
            <span style="color:var(--tako-text-dim);">ID Transaksi:</span>
            <span style="font-family:monospace; font-size:0.8rem; color:#64748b;">${escapeHtml(gift.giftId.slice(0, 16))}...</span>
          </div>` : ''}
        </div>

        <!-- Popup Guide Banner -->
        <div style="padding:10px 14px; background:rgba(59, 130, 246, 0.12); border-left:3px solid #3b82f6; border-radius:6px; font-size:0.84rem; color:#bfdbfe; line-height:1.5;">
          💡 <strong>Jendela Pembayaran Terbuka:</strong> Silakan selesaikan pembayaran di jendela terpusat. Halaman Streamcal ini akan memverifikasi dan mendeteksi pembayaran Anda secara otomatis.
        </div>

        <!-- Popup Blocked Warning -->
        <div id="popupBlockedAlert" style="${isPopupBlocked ? 'display:block;' : 'display:none;'} padding:10px 12px; background:rgba(245, 158, 11, 0.15); border:1px solid #f59e0b; border-radius:6px; font-size:0.82rem; color:#fde68a;">
          ⚠️ Jendela pop-up terblokir oleh peramban. Silakan klik tombol <strong>"Buka Jendela Pembayaran"</strong> di bawah.
        </div>

        ${countryTip ? `
        <div style="padding:10px 12px; background:rgba(16, 185, 129, 0.1); border-left:3px solid #10b981; border-radius:4px; font-size:0.82rem; color:#a7f3d0; line-height:1.5;">
          ${countryTip}
        </div>` : ''}

        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:4px;">
          ${gift.paymentUrl ? `
          <button type="button" class="tako-pay-link" id="reopenPaymentPopupBtn" style="border:none; cursor:pointer;">
            <span>🚀 Buka Jendela Pembayaran</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </button>` : ''}

          <button type="button" class="tako-check-btn" id="checkPaymentStatusBtn">
            <span>🔄 Cek Status Manual</span>
          </button>
        </div>

        <!-- Success Container -->
        <div id="checkoutSuccessArea" style="display:none;"></div>

        <div id="checkoutFeedbackMsg" style="font-size:0.8rem; color:var(--tako-text-dim);">
          Selesaikan pembayaran di jendela pembayaran. Status transaksi akan diverifikasi otomatis tanpa perlu memuat ulang halaman.
        </div>
      </div>
    `;

    supportCheckoutContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Reopen popup button
    const reopenBtn = document.getElementById('reopenPaymentPopupBtn');
    reopenBtn?.addEventListener('click', () => {
      openPaymentPopup(gift.paymentUrl);
      const alertBox = document.getElementById('popupBlockedAlert');
      if (alertBox) alertBox.style.display = 'none';
    });

    // Check status button
    const checkBtn = document.getElementById('checkPaymentStatusBtn');
    checkBtn?.addEventListener('click', () => {
      checkGiftStatus(gift.giftId);
    });

    // Auto-polling every 3.5 seconds
    if (gift.giftId) {
      let attempts = 0;
      supportPollingTimer = setInterval(async () => {
        attempts++;
        if (attempts > 60) { // ~3.5 minutes
          clearInterval(supportPollingTimer);
          supportPollingTimer = null;
          return;
        }
        const done = await checkGiftStatus(gift.giftId, true);
        if (done) {
          clearInterval(supportPollingTimer);
          supportPollingTimer = null;
        }
      }, 3500);
    }
  }

  // Check Status API & Auto-Verification
  async function checkGiftStatus(giftId, isSilent = false) {
    if (!giftId) return false;
    const badge = document.getElementById('checkoutBadge');
    const feedback = document.getElementById('checkoutFeedbackMsg');
    const successArea = document.getElementById('checkoutSuccessArea');
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
        checkBtn.innerHTML = '<span>🔄 Cek Status Manual</span>';
      }

      if (data.success && data.data) {
        const status = (data.data.status || '').toLowerCase();
        if (status === 'success') {
          // Auto close popup window if still open
          try {
            if (paymentPopupWindow && !paymentPopupWindow.closed) {
              paymentPopupWindow.close();
            }
          } catch (_) {}

          if (badge) {
            badge.className = 'tako-status-badge success';
            badge.innerHTML = '✅ Pembayaran Berhasil!';
          }

          if (successArea) {
            successArea.style.display = 'block';
            successArea.innerHTML = `
              <div class="celebration-box" style="margin-top:10px; padding:18px; background:rgba(34, 197, 94, 0.12); border:1.5px solid #22c55e; border-radius:10px; text-align:center;">
                <div style="font-size:2rem; margin-bottom:6px;">🎉 💖</div>
                <div style="font-size:1.15rem; font-weight:800; color:#4ade80;">Terima Kasih Banyak Atas Dukungan Anda!</div>
                <div style="font-size:0.86rem; color:#cbd5e1; margin-top:6px;">Donasi Anda telah terverifikasi sukses dan dialokasikan langsung untuk pemeliharaan server berkecepatan tinggi Streamcal.</div>
              </div>
            `;
          }

          if (feedback) {
            feedback.innerHTML = '<span style="color:#22c55e; font-weight:700;">Transaksi selesai dengan sukses! Nama Anda telah dicatat di Hall of Supporters.</span>';
          }

          loadSupporters();
          return true;
        } else if (status === 'failed' || status === 'reversed') {
          if (badge) {
            badge.className = 'tako-status-badge';
            badge.style.background = 'rgba(239, 68, 68, 0.15)';
            badge.style.color = '#ef4444';
            badge.innerHTML = '❌ Pembayaran Dibatalkan';
          }
          return true;
        } else {
          if (!isSilent && feedback) {
            feedback.textContent = 'Pembayaran belum terdeteksi. Silakan selesaikan pembayaran di jendela pop-up lalu klik tombol cek status lagi.';
          }
        }
      }
    } catch (err) {
      if (!isSilent && checkBtn) {
        checkBtn.disabled = false;
        checkBtn.innerHTML = '<span>🔄 Cek Status Manual</span>';
      }
      console.warn('Status error:', err);
    }

    return false;
  }

  // Load Supporters for Leaderboard Tab
  async function loadSupporters() {
    const container = document.getElementById('supportersListContainer');
    if (!container) return;

    try {
      const res = await fetch('/api/support/recent');
      const data = await res.json();

      if (data.success && data.data) {
        renderSupporters(data.data);
      }
    } catch (err) {
      console.warn('Failed to load supporters:', err);
    }
  }

  refreshSupportersBtn?.addEventListener('click', async () => {
    refreshSupportersBtn.disabled = true;
    refreshSupportersBtn.textContent = '...';
    await loadSupporters();
    refreshSupportersBtn.disabled = false;
    refreshSupportersBtn.textContent = 'Refresh';
  });

  function renderSupporters(list) {
    const container = document.getElementById('supportersListContainer');
    if (!container) return;

    if (!list || list.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:30px 10px; color:var(--tako-text-dim);">
          <div style="font-size:2rem; margin-bottom:8px;">💖</div>
          <div>Belum ada pendukung terbaru.<br>Jadilah yang pertama mendukung server Streamcal!</div>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(sup => `
      <div class="supporter-item-row">
        <div class="supporter-item-avatar">💖</div>
        <div style="flex:1; min-width:0;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:700; color:#ffffff; font-size:0.95rem;">${escapeHtml(sup.name || 'Supporter')}</span>
            <span style="font-weight:800; color:#34d399; font-size:0.95rem;">IDR ${Number(sup.amount).toLocaleString('id-ID')}</span>
          </div>
          ${sup.message ? `<div style="font-size:0.85rem; color:var(--tako-text-muted); margin-top:3px;">"${escapeHtml(sup.message)}"</div>` : ''}
          <div style="font-size:0.75rem; color:var(--tako-text-dim); margin-top:3px;">${timeAgo(sup.createdAt)}</div>
        </div>
      </div>
    `).join('');
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

  // Initialize UI
  renderPresetChips();
  updateSummaryBox();
});
