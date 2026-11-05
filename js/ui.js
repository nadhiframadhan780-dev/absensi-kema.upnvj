/**
 * Sistem Notifikasi & UI Feedback Modern
 * Menggantikan alert(), confirm(), prompt() bawaan browser
 */

// Kontainer elemen DOM UI
let toastContainer = null;
let confirmModal = null;
let proofModal = null;
let offlineBanner = null;

export function initUI() {
  toastContainer = document.getElementById('toast-container');
  confirmModal = document.getElementById('confirm-modal');
  proofModal = document.getElementById('proof-modal');
  offlineBanner = document.getElementById('offline-banner');

  // Pantau status koneksi online/offline
  window.addEventListener('online', () => {
    updateOnlineStatus(true);
    showToast('success', 'Koneksi Pulih', 'Anda kembali terhubung ke internet.');
  });

  window.addEventListener('offline', () => {
    updateOnlineStatus(false);
    showToast('warning', 'Koneksi Terputus', 'Anda sedang offline. Data lokal tetap aman.');
  });

  // Pantau status koneksi secara dinamis
  if (typeof navigator !== 'undefined' && 'onLine' in navigator && navigator.onLine === false && window.location.hostname !== 'localhost') {
    updateOnlineStatus(false);
  }

  // Keyboard shortcut: Tutup modal dengan tombol Esc
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeConfirmModal(false);
      closeProofModal();
    }
  });
}

function updateOnlineStatus(isOnline) {
  if (!offlineBanner) offlineBanner = document.getElementById('offline-banner');
  if (offlineBanner) {
    if (isOnline) {
      offlineBanner.classList.add('hidden');
    } else {
      offlineBanner.classList.remove('hidden');
    }
  }
}

/**
 * Tampilkan Toast Notification Modern
 * @param {'success'|'error'|'warning'|'info'} type 
 * @param {string} title 
 * @param {string} message 
 * @param {number} duration Durasi dalam ms (default 4500ms)
 */
export function showToast(type = 'info', title = '', message = '', duration = 4500) {
  if (!toastContainer) {
    toastContainer = document.getElementById('toast-container');
  }
  if (!toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type} animate-slide-in`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');

  // Icon mapping
  let iconSvg = '';
  switch (type) {
    case 'success':
      iconSvg = `<svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
      break;
    case 'error':
      iconSvg = `<svg class="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
      break;
    case 'warning':
      iconSvg = `<svg class="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
      break;
    default:
      iconSvg = `<svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
  }

  // Sanitasi teks dasar untuk mencegah XSS
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);

  toast.innerHTML = `
    <div class="toast-content flex items-start gap-3 p-4">
      <div class="toast-icon shrink-0 mt-0.5">${iconSvg}</div>
      <div class="toast-text flex-1 min-w-0">
        <h4 class="font-semibold text-sm text-slate-800 leading-snug">${safeTitle}</h4>
        ${safeMessage ? `<p class="text-xs text-slate-600 mt-0.5 leading-relaxed">${safeMessage}</p>` : ''}
      </div>
      <button type="button" class="toast-close text-slate-400 hover:text-slate-600 transition-colors p-1 -mr-1 -mt-1 rounded-lg" aria-label="Tutup notifikasi">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
      </button>
    </div>
    <div class="toast-progress-bar"></div>
  `;

  toastContainer.appendChild(toast);

  const progressBar = toast.querySelector('.toast-progress-bar');
  let startTime = Date.now();
  let remaining = duration;
  let timerId = null;
  let isPaused = false;

  const startTimer = () => {
    startTime = Date.now();
    if (progressBar) {
      progressBar.style.transition = `width ${remaining}ms linear`;
      progressBar.style.width = '0%';
    }
    timerId = setTimeout(() => {
      dismissToast(toast);
    }, remaining);
  };

  const pauseTimer = () => {
    if (isPaused) return;
    isPaused = true;
    clearTimeout(timerId);
    remaining -= (Date.now() - startTime);
    if (progressBar) {
      const computedWidth = window.getComputedStyle(progressBar).width;
      progressBar.style.transition = 'none';
      progressBar.style.width = computedWidth;
    }
  };

  const resumeTimer = () => {
    if (!isPaused) return;
    isPaused = false;
    if (remaining > 0) {
      startTimer();
    } else {
      dismissToast(toast);
    }
  };

  // Event listener pause on hover
  toast.addEventListener('mouseenter', pauseTimer);
  toast.addEventListener('mouseleave', resumeTimer);

  // Tombol close
  const closeBtn = toast.querySelector('.toast-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      clearTimeout(timerId);
      dismissToast(toast);
    });
  }

  // Mulai timer
  startTimer();
}

function dismissToast(toast) {
  if (!toast || toast.dataset.dismissing) return;
  toast.dataset.dismissing = 'true';
  toast.classList.remove('animate-slide-in');
  toast.classList.add('animate-fade-out');
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 250);
}

/**
 * Modal Dialog Konfirmasi Modern (Pengganti confirm())
 */
let confirmResolver = null;

export function showConfirmDialog({
  title = 'Konfirmasi Tindakan',
  message = 'Apakah Anda yakin ingin melanjutkan tindakan ini?',
  confirmText = 'Lanjutkan',
  cancelText = 'Batal',
  isDestructive = false
}) {
  if (!confirmModal) {
    confirmModal = document.getElementById('confirm-modal');
  }

  return new Promise((resolve) => {
    confirmResolver = resolve;

    const titleEl = document.getElementById('confirm-modal-title');
    const msgEl = document.getElementById('confirm-modal-message');
    const okBtn = document.getElementById('confirm-modal-ok');
    const cancelBtn = document.getElementById('confirm-modal-cancel');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;

    if (okBtn) {
      okBtn.textContent = confirmText;
      if (isDestructive) {
        okBtn.className = 'px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-all focus:ring-2 focus:ring-rose-500/20';
      } else {
        okBtn.className = 'px-4 py-2 text-sm font-semibold text-white bg-navy-800 hover:bg-navy-900 rounded-xl shadow-sm transition-all focus:ring-2 focus:ring-navy-600/20';
      }
    }

    if (cancelBtn) {
      cancelBtn.textContent = cancelText;
    }

    if (confirmModal) {
      confirmModal.classList.remove('hidden');
      confirmModal.style.display = 'flex';

      // Pastikan backdrop click membatalkan dialog
      confirmModal.onclick = (e) => {
        if (e.target === confirmModal) {
          closeConfirmModal(false);
        }
      };

      if (window.lucide) window.lucide.createIcons();
    } else {
      // Fallback aman jika elemen DOM modal tidak ditemukan
      const result = window.confirm(`${title}\n\n${message}`);
      resolve(result);
    }
  });
}

export function closeConfirmModal(result = false) {
  if (!confirmModal) confirmModal = document.getElementById('confirm-modal');
  if (confirmModal) {
    confirmModal.classList.add('hidden');
    confirmModal.style.display = 'none';
  }
  if (confirmResolver) {
    confirmResolver(result);
    confirmResolver = null;
  }
}

/**
 * Modal Bukti Absensi Berhasil
 */
export function showAttendanceProof(data = {}) {
  if (!proofModal) proofModal = document.getElementById('proof-modal');
  if (!proofModal) return;

  const namaEl = document.getElementById('proof-nama');
  const nimEl = document.getElementById('proof-nim');
  const matkulEl = document.getElementById('proof-matkul');
  const prodiEl = document.getElementById('proof-prodi');
  const waktuEl = document.getElementById('proof-waktu');
  const metodeEl = document.getElementById('proof-metode');
  const statusEl = document.getElementById('proof-status');

  if (namaEl) namaEl.textContent = data.nama || '-';
  if (nimEl) nimEl.textContent = data.nim || '-';
  if (matkulEl) matkulEl.textContent = data.mataKuliah || '-';
  if (prodiEl) prodiEl.textContent = `${data.prodi || '-'} (${data.fakultas || '-'})`;
  if (waktuEl) waktuEl.textContent = `${data.tanggal || ''} • ${data.waktuFormatted || data.jam || 'Tercatat'}`;
  if (metodeEl) metodeEl.textContent = data.metode === 'scan' ? 'Scan Barcode / QR' : 'Presensi Manual';
  if (statusEl) statusEl.textContent = data.status || 'Hadir';

  proofModal.classList.remove('hidden');
  proofModal.style.display = 'flex';

  // Bunyikan audio beep dan getar
  playSuccessSound();
}

export function closeProofModal() {
  if (!proofModal) proofModal = document.getElementById('proof-modal');
  if (proofModal) {
    proofModal.classList.add('hidden');
    proofModal.style.display = 'none';
  }
}

/**
 * Audio Beep & Haptic Vibration saat presensi sukses
 */
export function playSuccessSound() {
  try {
    // Web Audio API sintetis (tanpa perlu file eksternal)
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.1); // A5

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    }

    // Getar pada smartphone (Haptic Feedback)
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 150]);
    }
  } catch (e) {
    console.debug('Audio/Vibration feedback not available:', e);
  }
}

/**
 * Helper Spinner Button
 */
export function setButtonLoading(button, isLoading = true, loadingText = 'Memproses...') {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `
      <span class="inline-flex items-center gap-2">
        <svg class="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>${loadingText}</span>
      </span>
    `;
  } else {
    button.disabled = false;
    if (button.dataset.originalText) {
      button.innerHTML = button.dataset.originalText;
    }
  }
}

/**
 * Sanitasi HTML untuk keamanan XSS
 */
export function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}
