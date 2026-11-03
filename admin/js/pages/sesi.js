/**
 * Page Controller: Manajemen Sesi Perkuliahan (Pertemuan)
 * Real-time monitoring, Mode Presentasi / Proyektor, QR 30 Detik, & Otomasi Alpa
 */
import { 
  listenSessionsRealtime, 
  createSession, 
  createRecurringSessions, 
  openSession, 
  rotateSessionQrToken, 
  closeSessionAndMarkAlpa, 
  deleteSession 
} from '../services/sessionService.js';
import { fetchCourses, getCourseStudentsRoster } from '../services/courseService.js';
import { db, collection, query, where, onSnapshot } from '../firebase.js';
import { escapeHtml, formatDateWIB, formatTimeWIB, generateSessionCode } from '../utils.js';
import { showToast, showConfirmDialog, setButtonLoading } from '../ui.js';
import { authState } from '../auth.js';

let sessionsUnsubscribe = null;
let currentSessions = [];
let availableCourses = [];
let activeProjectorInterval = null;
let activeSessionAttUnsubscribe = null;

export async function renderSesiPage() {
  const container = document.getElementById('view-sesi');
  if (!container) return;

  setupSesiEventListeners();
  loadCoursesDropdown();

  if (sessionsUnsubscribe) sessionsUnsubscribe();
  sessionsUnsubscribe = listenSessionsRealtime({
    fakultas: authState.fakultas || 'all',
    prodi: authState.prodi || 'all',
    dosenUid: authState.role === 'dosen' ? authState.user.uid : null
  }, (sessions) => {
    currentSessions = sessions;
    renderSessionsList(sessions);
  });
}

async function loadCoursesDropdown() {
  try {
    availableCourses = await fetchCourses({
      fakultas: authState.fakultas || 'all',
      prodi: authState.prodi || 'all',
      dosenUid: authState.role === 'dosen' ? authState.user.uid : null
    });

    const select = document.getElementById('sesi-course-select');
    if (select) {
      select.innerHTML = '<option value="">Pilih Mata Kuliah</option>' +
        availableCourses.map(c => `<option value="${c.id}">${c.kode} - ${c.nama} (Kelas ${c.kelas || 'A'})</option>`).join('');
    }
  } catch (err) {
    console.warn('Gagal memuat daftar mata kuliah untuk sesi:', err);
  }
}

function setupSesiEventListeners() {
  const btnCreate = document.getElementById('btn-create-session');
  if (btnCreate) btnCreate.onclick = openCreateSessionModal;

  const btnRecurring = document.getElementById('btn-create-recurring-sessions');
  if (btnRecurring) btnRecurring.onclick = openCreateRecurringModal;

  const closeProjectorBtn = document.getElementById('btn-close-projector-mode');
  if (closeProjectorBtn) closeProjectorBtn.onclick = closeProjectorMode;
}

function renderSessionsList(sessions) {
  const grid = document.getElementById('sessions-cards-grid');
  if (!grid) return;

  if (sessions.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 48px; text-align: center; color: var(--slate-400); background: #ffffff; border-radius: 16px; border: 1px dashed var(--slate-300);">
        <i data-lucide="calendar-x" style="width: 36px; height: 36px; margin: 0 auto 10px; stroke-width: 1.5;"></i>
        <h4 style="font-size: 15px; font-weight: 700; color: var(--slate-700); margin: 0;">Belum Ada Sesi Perkuliahan</h4>
        <p style="font-size: 12px; margin: 6px 0 0 0;">Klik "Buat Sesi Pertemuan" atau gunakan generator sesi berulang untuk 16 pertemuan.</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  grid.innerHTML = sessions.map(s => {
    const isLive = s.status === 'Dibuka';
    const isClosed = s.status === 'Ditutup';

    return `
      <div class="session-card ${isLive ? 'session-live' : ''}">
        <div class="session-card-header">
          <span class="session-meeting-badge">Pertemuan ${s.pertemuan || 1}</span>
          <span class="session-status-pill status-${(s.status || 'terjadwal').toLowerCase()}">
            ${isLive ? '<span class="pulse-indicator"></span>' : ''}
            ${s.status || 'Terjadwal'}
          </span>
        </div>
        <div class="session-card-body">
          <h3 class="session-course-title">${escapeHtml(s.namaMk || 'Mata Kuliah')}</h3>
          <div class="session-meta-row">
            <span><strong>Kode:</strong> ${escapeHtml(s.kodeMk || '-')} (Kls ${escapeHtml(s.kelas || 'A')})</span>
            <span><strong>Tanggal:</strong> ${formatDateWIB(s.tanggal)}</span>
            <span><strong>Waktu:</strong> ${s.jamBuka || '08:00'} - ${s.jamTutup || '09:40'} WIB</span>
            <span><strong>Dosen:</strong> ${escapeHtml(s.dosenNama || 'Dosen Pengampu')}</span>
          </div>

          ${isLive ? `
            <div class="session-live-token-box">
              <div>Kode Sesi: <strong class="font-mono text-gold">${s.kodeSesi || '-'}</strong></div>
              <div style="font-size: 10px; color: var(--slate-400); margin-top: 2px;">QR Code dinamis berganti tiap 30 detik</div>
            </div>
          ` : ''}
        </div>

        <div class="session-card-actions">
          ${isLive ? `
            <button type="button" class="btn-portal btn-primary btn-sm btn-projector" data-id="${s.id}">
              <i data-lucide="tv" style="width: 14px; height: 14px;"></i>
              <span>Layar Proyektor</span>
            </button>
            <button type="button" class="btn-portal btn-danger btn-sm btn-close-session" data-id="${s.id}">
              <i data-lucide="stop-circle" style="width: 14px; height: 14px;"></i>
              <span>Tutup Sesi</span>
            </button>
          ` : isClosed ? `
            <span style="font-size: 12px; color: var(--slate-400); font-weight: 600;">Sesi Telah Selesai</span>
            <button type="button" class="btn-portal btn-secondary btn-sm btn-view-report" data-id="${s.id}">
              <i data-lucide="file-text" style="width: 14px; height: 14px;"></i>
              <span>Rekap Sesi</span>
            </button>
          ` : `
            <button type="button" class="btn-portal btn-primary btn-sm btn-open-session" data-id="${s.id}">
              <i data-lucide="play-circle" style="width: 14px; height: 14px;"></i>
              <span>Buka Presensi</span>
            </button>
            <button type="button" class="btn-action-icon btn-delete-session" data-id="${s.id}" title="Hapus Sesi">
              <i data-lucide="trash-2" style="width: 15px; height: 15px; color: var(--rose-500);"></i>
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');

  // Pasang listener pada tombol kartu
  grid.querySelectorAll('.btn-open-session').forEach(btn => {
    btn.onclick = () => handleOpenSession(btn.dataset.id);
  });

  grid.querySelectorAll('.btn-close-session').forEach(btn => {
    btn.onclick = () => handleCloseSession(btn.dataset.id);
  });

  grid.querySelectorAll('.btn-projector').forEach(btn => {
    btn.onclick = () => openProjectorMode(btn.dataset.id);
  });

  grid.querySelectorAll('.btn-delete-session').forEach(btn => {
    btn.onclick = () => handleDeleteSession(btn.dataset.id);
  });

  if (window.lucide) window.lucide.createIcons();
}

/**
 * Buka Sesi Perkuliahan
 */
async function handleOpenSession(sessionId) {
  try {
    await openSession(sessionId);
    showToast('success', 'Sesi Dibuka', 'Mahasiswa sekarang dapat melakukan presensi pada sesi ini.');
  } catch (err) {
    showToast('error', 'Gagal Membuka Sesi', err.message);
  }
}

/**
 * Tutup Sesi dengan Opsi Otomatis Tandai Mahasiswa yang Belum Hadir Sebagai "Alpa"
 */
async function handleCloseSession(sessionId) {
  const session = currentSessions.find(s => s.id === sessionId);
  if (!session) return;

  const confirmed = await showConfirmDialog({
    title: `Tutup Sesi: ${session.namaMk}?`,
    message: 'Apakah Anda ingin menutup sesi perkuliahan ini dan otomatis menandai mahasiswa yang belum absen sebagai "Alpa"?',
    confirmText: 'Ya, Tutup & Tandai Alpa',
    cancelText: 'Batal',
    isDestructive: true
  });

  if (confirmed) {
    try {
      showToast('info', 'Memproses Penutupan Sesi...', 'Menghitung mahasiswa dan mencatat status Alpa...');
      const result = await closeSessionAndMarkAlpa(session, { markAlpa: true });
      showToast('success', 'Sesi Berhasil Ditutup', `Sesi ditutup. ${result.alpaCount} mahasiswa otomatis dicatat Alpa.`);
    } catch (err) {
      showToast('error', 'Gagal Menutup Sesi', err.message);
    }
  }
}

/**
 * MODE PRESENTASI / PROYEKTOR LAYAR KELAS
 * QR Code Dinamis Otomatis Berganti Setiap 30 Detik
 */
async function openProjectorMode(sessionId) {
  const session = currentSessions.find(s => s.id === sessionId);
  if (!session) return;

  const projectorModal = document.getElementById('modal-projector-mode');
  if (!projectorModal) return;

  document.getElementById('projector-course-title').textContent = `${session.namaMk} (Pertemuan ${session.pertemuan})`;
  document.getElementById('projector-dosen-name').textContent = `Dosen: ${session.dosenNama || 'Dosen Pengampu'}`;
  document.getElementById('projector-session-code').textContent = session.kodeSesi;

  projectorModal.classList.remove('hidden');

  // Render QR pertama
  renderDynamicProjectorQr(session);

  // Interval regenerasi token QR tiap 30 detik
  if (activeProjectorInterval) clearInterval(activeProjectorInterval);
  activeProjectorInterval = setInterval(async () => {
    try {
      const refreshed = await rotateSessionQrToken(sessionId);
      session.qrToken = refreshed.qrToken;
      session.qrTokenExp = refreshed.qrTokenExp;
      renderDynamicProjectorQr(session);
    } catch (e) {
      console.warn('Gagal merotasi token QR proyektor:', e);
    }
  }, 30000);

  // Pantau jumlah kehadiran secara real-time
  if (activeSessionAttUnsubscribe) activeSessionAttUnsubscribe();
  activeSessionAttUnsubscribe = onSnapshot(query(
    collection(db, 'attendance'),
    where('sesiId', '==', sessionId)
  ), (snap) => {
    const countEl = document.getElementById('projector-present-count');
    if (countEl) countEl.textContent = snap.size;
  });
}

function renderDynamicProjectorQr(session) {
  const qrContainer = document.getElementById('projector-qr-canvas');
  if (!qrContainer) return;

  qrContainer.innerHTML = '';
  // Data QR payload berupa JSON terenkripsi/terstruktur
  const qrPayload = JSON.stringify({
    type: 'UPNVJ_ATTENDANCE_SESSION',
    sessionId: session.id,
    kodeMk: session.kodeMk,
    token: session.qrToken,
    exp: session.qrTokenExp
  });

  if (window.QRCode) {
    new window.QRCode(qrContainer, {
      text: qrPayload,
      width: 280,
      height: 280,
      colorDark: '#0b2341',
      colorLight: '#ffffff',
      correctLevel: window.QRCode.CorrectLevel.H
    });
  }
}

function closeProjectorMode() {
  const projectorModal = document.getElementById('modal-projector-mode');
  if (projectorModal) projectorModal.classList.add('hidden');
  if (activeProjectorInterval) clearInterval(activeProjectorInterval);
  if (activeSessionAttUnsubscribe) activeSessionAttUnsubscribe();
}

/**
 * Modal Buat Sesi Tunggal
 */
function openCreateSessionModal() {
  const modal = document.getElementById('modal-create-session');
  if (!modal) return;
  modal.classList.remove('hidden');

  const form = document.getElementById('form-create-session');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const courseId = document.getElementById('sesi-course-select').value;
      const course = availableCourses.find(c => c.id === courseId);
      if (!course) {
        showToast('warning', 'Pilih Mata Kuliah', 'Harap pilih mata kuliah terlebih dahulu.');
        return;
      }

      const btn = document.getElementById('btn-submit-create-session');
      setButtonLoading(btn, true, 'Menyimpan...');

      try {
        const payload = {
          courseId: course.id,
          kodeMk: course.kode,
          namaMk: course.nama,
          fakultas: course.fakultas,
          prodi: course.prodi,
          semester: course.semester,
          kelas: course.kelas || 'A',
          dosenUid: course.dosenUid || authState.user.uid,
          dosenNama: course.dosenNama || authState.adminDoc?.nama || 'Dosen Pengampu',
          pertemuan: Number(document.getElementById('sesi-input-pertemuan').value || 1),
          tanggal: document.getElementById('sesi-input-tanggal').value,
          jamBuka: document.getElementById('sesi-input-jambuka').value,
          jamTutup: document.getElementById('sesi-input-jamtutup').value,
          batasTerlambatMenit: Number(document.getElementById('sesi-input-terlambat').value || 15),
          metode: document.getElementById('sesi-input-metode').value || 'keduanya',
          catatan: document.getElementById('sesi-input-catatan').value
        };

        await createSession(payload);
        showToast('success', 'Sesi Berhasil Dibuat', `Pertemuan ke-${payload.pertemuan} ${payload.namaMk} telah ditambahkan.`);
        modal.classList.add('hidden');
        form.reset();
      } catch (err) {
        showToast('error', 'Gagal Membuat Sesi', err.message);
      } finally {
        setButtonLoading(btn, false);
      }
    };
  }
}

/**
 * Modal Pembuat 16 Pertemuan Otomatis (Recurring Sessions)
 */
function openCreateRecurringModal() {
  const modal = document.getElementById('modal-recurring-session');
  if (!modal) return;
  modal.classList.remove('hidden');

  const select = document.getElementById('recurring-course-select');
  if (select) {
    select.innerHTML = '<option value="">Pilih Mata Kuliah</option>' +
      availableCourses.map(c => `<option value="${c.id}">${c.kode} - ${c.nama} (Kelas ${c.kelas || 'A'})</option>`).join('');
  }

  const btnProcess = document.getElementById('btn-submit-recurring-sessions');
  if (btnProcess) {
    btnProcess.onclick = async () => {
      const courseId = select.value;
      const course = availableCourses.find(c => c.id === courseId);
      const startDate = document.getElementById('recurring-start-date').value;

      if (!course || !startDate) {
        showToast('warning', 'Lengkapi Data', 'Pilih mata kuliah dan tanggal pertemuan pertama.');
        return;
      }

      setButtonLoading(btnProcess, true, 'Membuat 16 Sesi...');
      try {
        const count = await createRecurringSessions(course, { startDate, count: 16 });
        showToast('success', '16 Sesi Dibuat', `Sebanyak ${count} pertemuan berulang mingguan berhasil dijadwalkan.`);
        modal.classList.add('hidden');
      } catch (err) {
        showToast('error', 'Gagal Generate Sesi', err.message);
      } finally {
        setButtonLoading(btnProcess, false);
      }
    };
  }
}

async function handleDeleteSession(sessionId) {
  const confirmed = await showConfirmDialog({
    title: 'Hapus Sesi Perkuliahan?',
    message: 'Sesi ini akan dihapus dari jadwal perkuliahan.',
    confirmText: 'Ya, Hapus',
    isDestructive: true
  });

  if (confirmed) {
    try {
      await deleteSession(sessionId);
      showToast('success', 'Dihapus', 'Sesi berhasil dihapus.');
    } catch (err) {
      showToast('error', 'Gagal Menghapus', err.message);
    }
  }
}
