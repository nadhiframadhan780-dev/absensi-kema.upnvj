/**
 * Modul Antarmuka & Notifikasi UI Admin UPNVJ
 * Dilarang menggunakan alert(), confirm(), prompt().
 */
import { escapeHtml } from './utils.js';

// Synthesizer Web Audio API untuk feedback auditif
function playChime(freq = 587.33, duration = 0.15) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

/**
 * 1. TOAST NOTIFICATION SYSTEM
 * type: 'success' | 'error' | 'warning' | 'info'
 */
export function showToast(type = 'info', title = '', message = '') {
  let container = document.getElementById('admin-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'admin-toast-container';
    container.className = 'admin-toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: '<i data-lucide="check-circle-2" style="width: 20px; height: 20px; color: #10b981;"></i>',
    error: '<i data-lucide="alert-octagon" style="width: 20px; height: 20px; color: #ef4444;"></i>',
    warning: '<i data-lucide="alert-triangle" style="width: 20px; height: 20px; color: #f59e0b;"></i>',
    info: '<i data-lucide="info" style="width: 20px; height: 20px; color: #0284c7;"></i>'
  };

  const defaultTitles = {
    success: 'Berhasil',
    error: 'Terjadi Kesalahan',
    warning: 'Peringatan',
    info: 'Informasi'
  };

  const toast = document.createElement('div');
  toast.className = `admin-toast-item toast-${type} animate-slide-in`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');

  toast.innerHTML = `
    <div class="toast-body">
      <div class="toast-icon-frame">${icons[type] || icons.info}</div>
      <div class="toast-content">
        <h4 class="toast-title">${escapeHtml(title || defaultTitles[type])}</h4>
        <p class="toast-message">${escapeHtml(message)}</p>
      </div>
      <button type="button" class="toast-close-btn" aria-label="Tutup notifikasi">
        <i data-lucide="x" style="width: 15px; height: 15px;"></i>
      </button>
    </div>
    <div class="toast-countdown-bar"></div>
  `;

  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  if (type === 'success') playChime(659.25, 0.2);
  else if (type === 'error') playChime(311.13, 0.25);

  const closeBtn = toast.querySelector('.toast-close-btn');
  closeBtn.onclick = () => removeToast(toast);

  // Countdown timer 4.5 detik dengan pause on hover
  const bar = toast.querySelector('.toast-countdown-bar');
  let remaining = 4500;
  let start = Date.now();
  let timerId = null;

  function runTimer() {
    bar.style.transition = `width ${remaining}ms linear`;
    bar.style.width = '0%';
    timerId = setTimeout(() => removeToast(toast), remaining);
  }

  function pauseTimer() {
    clearTimeout(timerId);
    remaining -= (Date.now() - start);
    bar.style.transition = 'none';
    bar.style.width = window.getComputedStyle(bar).width;
  }

  function resumeTimer() {
    start = Date.now();
    runTimer();
  }

  toast.addEventListener('mouseenter', pauseTimer);
  toast.addEventListener('mouseleave', resumeTimer);
  runTimer();
}

function removeToast(toast) {
  if (!toast) return;
  toast.classList.add('animate-fade-out');
  setTimeout(() => toast.remove(), 250);
}

/**
 * 2. MODAL KONFIRMASI UMUM
 */
export function showConfirmDialog({
  title = 'Konfirmasi Tindakan',
  message = 'Apakah Anda yakin ingin melanjutkan tindakan ini?',
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
  isDestructive = false
}) {
  return new Promise((resolve) => {
    const modalEl = document.getElementById('admin-confirm-modal');
    if (!modalEl) {
      resolve(false);
      return;
    }

    const titleEl = document.getElementById('confirm-title');
    const msgEl = document.getElementById('confirm-message');
    const btnConfirm = document.getElementById('btn-confirm-action');
    const btnCancel = document.getElementById('btn-confirm-cancel');
    const secureSection = document.getElementById('confirm-secure-input-section');

    if (secureSection) secureSection.classList.add('hidden');
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (btnCancel) btnCancel.textContent = cancelText;

    if (btnConfirm) {
      btnConfirm.textContent = confirmText;
      if (isDestructive) {
        btnConfirm.className = 'btn-portal btn-danger';
      } else {
        btnConfirm.className = 'btn-portal btn-primary';
      }
    }

    modalEl.classList.remove('hidden');

    const handleConfirm = () => {
      cleanup();
      resolve(true);
    };

    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    function cleanup() {
      modalEl.classList.add('hidden');
      btnConfirm.removeEventListener('click', handleConfirm);
      btnCancel.removeEventListener('click', handleCancel);
    }

    btnConfirm.addEventListener('click', handleConfirm);
    btnCancel.addEventListener('click', handleCancel);
  });
}

/**
 * 3. MODAL DESTRUKTIF KHUSUS (Wajib Ketik "HAPUS")
 */
export function showDestructiveSecureDialog({
  title = 'Tindakan Berbahaya',
  message = 'Data ini akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.',
  targetKeyword = 'HAPUS'
}) {
  return new Promise((resolve) => {
    const modalEl = document.getElementById('admin-confirm-modal');
    if (!modalEl) {
      resolve(false);
      return;
    }

    const titleEl = document.getElementById('confirm-title');
    const msgEl = document.getElementById('confirm-message');
    const btnConfirm = document.getElementById('btn-confirm-action');
    const btnCancel = document.getElementById('btn-confirm-cancel');
    const secureSection = document.getElementById('confirm-secure-input-section');
    const inputKeyword = document.getElementById('confirm-secure-keyword');
    const keywordHint = document.getElementById('confirm-keyword-target');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (secureSection) secureSection.classList.remove('hidden');
    if (keywordHint) keywordHint.textContent = targetKeyword;
    if (inputKeyword) {
      inputKeyword.value = '';
      inputKeyword.placeholder = `Ketik "${targetKeyword}" untuk konfirmasi`;
    }

    btnConfirm.className = 'btn-portal btn-danger';
    btnConfirm.textContent = 'Hapus Permanen';
    btnConfirm.disabled = true;

    modalEl.classList.remove('hidden');
    if (inputKeyword) inputKeyword.focus();

    const handleInput = () => {
      btnConfirm.disabled = inputKeyword.value.trim() !== targetKeyword;
    };
    inputKeyword.addEventListener('input', handleInput);

    const handleConfirm = () => {
      cleanup();
      resolve(true);
    };

    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    function cleanup() {
      modalEl.classList.add('hidden');
      btnConfirm.removeEventListener('click', handleConfirm);
      btnCancel.removeEventListener('click', handleCancel);
      inputKeyword.removeEventListener('input', handleInput);
    }

    btnConfirm.addEventListener('click', handleConfirm);
    btnCancel.addEventListener('click', handleCancel);
  });
}

/**
 * 4. DRAWER / SLIDE-IN PANEL
 */
export function openDrawer(title, contentHtml, footerHtml = '') {
  const drawerEl = document.getElementById('admin-drawer-container');
  const backdropEl = document.getElementById('admin-drawer-backdrop');
  if (!drawerEl || !backdropEl) return;

  document.getElementById('admin-drawer-title').textContent = title;
  document.getElementById('admin-drawer-content').innerHTML = contentHtml;
  
  const footerEl = document.getElementById('admin-drawer-footer');
  if (footerEl) {
    if (footerHtml) {
      footerEl.innerHTML = footerHtml;
      footerEl.classList.remove('hidden');
    } else {
      footerEl.innerHTML = '';
      footerEl.classList.add('hidden');
    }
  }

  drawerEl.classList.remove('hidden');
  backdropEl.classList.remove('hidden');
  setTimeout(() => {
    drawerEl.classList.add('drawer-open');
    backdropEl.classList.add('backdrop-open');
  }, 10);

  if (window.lucide) window.lucide.createIcons();
}

export function closeDrawer() {
  const drawerEl = document.getElementById('admin-drawer-container');
  const backdropEl = document.getElementById('admin-drawer-backdrop');
  if (!drawerEl || !backdropEl) return;

  drawerEl.classList.remove('drawer-open');
  backdropEl.classList.remove('backdrop-open');
  setTimeout(() => {
    drawerEl.classList.add('hidden');
    backdropEl.classList.add('hidden');
  }, 280);
}

/**
 * 5. HELPER BUTTON SPINNER & LOADING
 */
export function setButtonLoading(button, isLoading, loadingText = 'Memproses...') {
  if (!button) return;
  if (isLoading) {
    button.disabled = true;
    button.dataset.originalHtml = button.innerHTML;
    button.innerHTML = `
      <svg class="animate-spin" style="width: 16px; height: 16px; display: inline-block; margin-right: 6px; vertical-align: middle;" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="10" stroke-width="4" stroke="currentColor" stroke-opacity="0.25"></circle>
        <path d="M4 12a8 8 0 018-8" stroke-width="4" stroke="currentColor"></path>
      </svg>
      <span>${escapeHtml(loadingText)}</span>
    `;
  } else {
    button.disabled = false;
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
    }
    if (window.lucide) window.lucide.createIcons();
  }
}

/**
 * 6. MODAL PROGRESS BAR OPERASI MASSAL (Import / Export / Batch Alpa)
 */
export function openProgressModal(title = 'Memproses Operasi Massal...') {
  const modal = document.getElementById('admin-progress-modal');
  if (!modal) return;
  document.getElementById('progress-modal-title').textContent = title;
  document.getElementById('progress-modal-percent').textContent = '0%';
  document.getElementById('progress-modal-bar').style.width = '0%';
  document.getElementById('progress-modal-status').textContent = 'Menyiapkan data...';
  modal.classList.remove('hidden');
}

export function updateProgressModal(percent, statusText) {
  const percentEl = document.getElementById('progress-modal-percent');
  const barEl = document.getElementById('progress-modal-bar');
  const statusEl = document.getElementById('progress-modal-status');
  if (percentEl) percentEl.textContent = `${Math.round(percent)}%`;
  if (barEl) barEl.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  if (statusEl && statusText) statusEl.textContent = statusText;
}

export function closeProgressModal() {
  const modal = document.getElementById('admin-progress-modal');
  if (modal) modal.classList.add('hidden');
}

/**
 * 7. NOTIFICATION CENTER (Pusat Notifikasi Real-time)
 */
export function renderNotificationCenter(notifications = []) {
  const badgeEl = document.getElementById('notif-badge-count');
  const listEl = document.getElementById('notif-dropdown-list');
  if (!listEl) return;

  const unreadCount = notifications.filter(n => !n.isRead).length;
  if (badgeEl) {
    if (unreadCount > 0) {
      badgeEl.textContent = unreadCount > 99 ? '99+' : unreadCount;
      badgeEl.classList.remove('hidden');
    } else {
      badgeEl.classList.add('hidden');
    }
  }

  if (notifications.length === 0) {
    listEl.innerHTML = `
      <div style="padding: 32px 16px; text-align: center; color: #94a3b8;">
        <i data-lucide="bell-off" style="width: 32px; height: 32px; margin: 0 auto 8px; stroke-width: 1.5;"></i>
        <p style="font-size: 13px; font-weight: 600; margin: 0;">Belum Ada Pemberitahuan</p>
        <p style="font-size: 11px; margin: 4px 0 0 0;">Semua pengajuan dan aktivitas baru akan muncul di sini.</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  listEl.innerHTML = notifications.slice(0, 8).map(n => `
    <div class="notif-item ${n.isRead ? '' : 'unread'}" data-notif-id="${n.id}">
      <div class="notif-item-icon ${n.tipe || 'info'}">
        <i data-lucide="${n.icon || 'bell'}" style="width: 16px; height: 16px;"></i>
      </div>
      <div class="notif-item-body">
        <div class="notif-item-title">${escapeHtml(n.judul)}</div>
        <div class="notif-item-desc">${escapeHtml(n.pesan)}</div>
        <div class="notif-item-time">${escapeHtml(n.waktuLalu || 'Baru saja')}</div>
      </div>
    </div>
  `).join('');

  if (window.lucide) window.lucide.createIcons();
}

/**
 * Inisialisasi Event Listener Global UI (Esc key, online/offline banner)
 */
export function initGlobalUiListeners() {
  // Tutup Modal atau Drawer dengan tombol Escape
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const confirmModal = document.getElementById('admin-confirm-modal');
      if (confirmModal && !confirmModal.classList.contains('hidden')) {
        confirmModal.classList.add('hidden');
      }
      closeDrawer();
    }
  });

  // Drawer Backdrop Click
  const backdrop = document.getElementById('admin-drawer-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', closeDrawer);
  }

  const closeDrawerBtn = document.getElementById('btn-close-drawer');
  if (closeDrawerBtn) {
    closeDrawerBtn.addEventListener('click', closeDrawer);
  }

  // Deteksi Online/Offline
  const offlineBanner = document.getElementById('admin-offline-banner');
  if (offlineBanner) {
    const updateConn = () => {
      if (!navigator.onLine) {
        offlineBanner.classList.remove('hidden');
        showToast('warning', 'Mode Offline', 'Koneksi internet terputus. Data sementara disinkronkan via cache.');
      } else {
        offlineBanner.classList.add('hidden');
      }
    };
    window.addEventListener('offline', updateConn);
    window.addEventListener('online', () => {
      offlineBanner.classList.add('hidden');
      showToast('success', 'Online Kembali', 'Koneksi internet telah terhubung.');
    });
  }
}
