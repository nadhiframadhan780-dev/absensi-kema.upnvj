/**
 * Page Controller: Mode Scanner Admin / Kiosk Presensi
 * html5-qrcode, Flash Result Card 2 Detik, Beep + Getar, & Dukungan Barcode Scanner USB (Keyboard Wedge)
 */
import { db, collection, getDocs, query, where, addDoc } from '../firebase.js';
import { fetchStudents } from '../services/studentService.js';
import { addManualAttendance } from '../services/attendanceService.js';
import { escapeHtml, getTodayWIB, formatTimeWIB } from '../utils.js';
import { showToast } from '../ui.js';
import { authState } from '../auth.js';
import { validateDynamicQrPayload } from '../../../js/logic.js';

let html5QrCode = null;
let activeScannerSession = null;
let isScannerActive = false;
let recentScans = [];

// Audio feedback synthesiser
function playScanSound(isSuccess = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isSuccess ? 'sine' : 'sawtooth';
    osc.frequency.setValueAtTime(isSuccess ? 880 : 220, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (isSuccess ? 0.2 : 0.4));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (isSuccess ? 0.2 : 0.4));
  } catch (e) {}

  if ('vibrate' in navigator) {
    navigator.vibrate(isSuccess ? [50, 50, 80] : [120, 80, 120]);
  }
}

export async function renderScannerPage() {
  const container = document.getElementById('view-scanner');
  if (!container) return;

  setupScannerControls();
  await loadActiveSessionsForScanner();
  setupUsbBarcodeWedgeListener();
}

async function loadActiveSessionsForScanner() {
  const select = document.getElementById('scanner-session-select');
  if (!select) return;

  try {
    const today = getTodayWIB();
    const q = query(
      collection(db, 'sessions'),
      where('status', '==', 'Dibuka')
    );
    const snap = await getDocs(q);
    const sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (sessions.length === 0) {
      select.innerHTML = '<option value="">Tidak ada sesi yang sedang dibuka hari ini</option>';
      activeScannerSession = null;
      return;
    }

    select.innerHTML = '<option value="">-- Pilih Sesi Perkuliahan Aktif --</option>' +
      sessions.map(s => `<option value="${s.id}">${s.namaMk} (Pertemuan ${s.pertemuan}) - Kls ${s.kelas || 'A'}</option>`).join('');

    select.onchange = () => {
      activeScannerSession = sessions.find(s => s.id === select.value) || null;
      updateScannerStatus();
    };
  } catch (e) {
    console.warn('Gagal memuat sesi aktif untuk scanner:', e);
  }
}

let adminScanFilterMode = 'all'; // 'all' | 'qr' | 'barcode'

function setupScannerControls() {
  const btnStart = document.getElementById('btn-start-admin-scanner');
  const btnStop = document.getElementById('btn-stop-admin-scanner');
  const formManual = document.getElementById('form-scanner-manual-nim');

  const btnAll = document.getElementById('btn-admin-scan-all');
  const btnQr = document.getElementById('btn-admin-scan-qr');
  const btnBarcode = document.getElementById('btn-admin-scan-barcode');

  const setAdminFilter = (activeBtn, mode) => {
    [btnAll, btnQr, btnBarcode].forEach(b => {
      if (b) {
        b.style.background = 'transparent';
        b.style.color = 'var(--text-muted)';
        b.classList.remove('active');
      }
    });
    if (activeBtn) {
      activeBtn.style.background = 'var(--navy-900, #0b2341)';
      activeBtn.style.color = '#ffffff';
      activeBtn.classList.add('active');
    }
    adminScanFilterMode = mode;
  };

  if (btnAll) btnAll.onclick = () => setAdminFilter(btnAll, 'all');
  if (btnQr) btnQr.onclick = () => setAdminFilter(btnQr, 'qr');
  if (btnBarcode) btnBarcode.onclick = () => setAdminFilter(btnBarcode, 'barcode');

  if (btnStart) btnStart.onclick = startAdminCamera;
  if (btnStop) btnStop.onclick = stopAdminCamera;

  if (formManual) {
    formManual.onsubmit = async (e) => {
      e.preventDefault();
      const input = document.getElementById('scanner-manual-nim-input');
      const nim = input ? input.value.trim() : '';
      if (nim) {
        await processScannedNim(nim);
        if (input) input.value = '';
      }
    };
  }
}

function updateScannerStatus() {
  const hintEl = document.getElementById('scanner-session-hint');
  if (!hintEl) return;
  if (activeScannerSession) {
    hintEl.innerHTML = `<span style="color: #059669; font-weight: 700;">Sesi Aktif:</span> ${escapeHtml(activeScannerSession.namaMk)} (${escapeHtml(activeScannerSession.kodeMk)})`;
  } else {
    hintEl.innerHTML = `<span style="color: #ef4444; font-weight: 700;">Perhatian:</span> Pilih sesi perkuliahan aktif terlebih dahulu.`;
  }
}

async function startAdminCamera() {
  if (!activeScannerSession) {
    showToast('warning', 'Pilih Sesi Dahulu', 'Silakan pilih sesi perkuliahan yang aktif sebelum mengaktifkan kamera scanner.');
    return;
  }

  if (!window.Html5Qrcode) {
    showToast('error', 'Pustaka Scanner Belum Siap', 'Pustaka pemindai kamera sedang dimuat.');
    return;
  }

  try {
    if (!html5QrCode) {
      html5QrCode = new window.Html5Qrcode("admin-scanner-viewport");
    }

    const cameras = await window.Html5Qrcode.getCameras();
    if (!cameras || cameras.length === 0) {
      showToast('error', 'Kamera Tidak Ditemukan', 'Perangkat tidak memiliki kamera atau izin akses ditolak.');
      return;
    }

    // Prioritaskan kamera belakang jika ada
    const backCam = cameras.find(c => c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('belakang'));
    const cameraId = backCam ? backCam.id : cameras[0].id;

    await html5QrCode.start(
      cameraId,
      { fps: 10, qrbox: { width: 260, height: 260 }, aspectRatio: 1.33333 },
      async (decodedText) => {
        // Debounce scan agar tidak berkali-kali terbaca sekaligus
        if (isScannerActive) {
          isScannerActive = false;
          await processScannedNim(decodedText.trim());
          setTimeout(() => { isScannerActive = true; }, 2200);
        }
      },
      () => {}
    );

    isScannerActive = true;
    document.getElementById('btn-start-admin-scanner')?.classList.add('hidden');
    document.getElementById('btn-stop-admin-scanner')?.classList.remove('hidden');
    document.getElementById('scanner-idle-badge')?.classList.add('hidden');
    showToast('info', 'Scanner Aktif', 'Arahkan kamera ke barcode/QR KTM mahasiswa.');
  } catch (err) {
    console.error('Error starting admin camera:', err);
    showToast('error', 'Gagal Membuka Kamera', err.message);
  }
}

async function stopAdminCamera() {
  if (html5QrCode && isScannerActive) {
    try {
      await html5QrCode.stop();
      isScannerActive = false;
    } catch (e) {}
  }
  document.getElementById('btn-start-admin-scanner')?.classList.remove('hidden');
  document.getElementById('btn-stop-admin-scanner')?.classList.add('hidden');
  document.getElementById('scanner-idle-badge')?.classList.remove('hidden');
}

/**
 * Proses Barcode / QR NIM yang Dipindai:
 * Validasi Mahasiswa, Verifikasi Token 30 Detik Anti-Screenshot, Catat Absensi, Tampilkan Kartu Hasil 2 Detik
 */
async function processScannedNim(rawInput) {
  if (!activeScannerSession) {
    showToast('warning', 'Pilih Sesi', 'Harap pilih sesi perkuliahan aktif terlebih dahulu.');
    return;
  }

  // 1. Validasi Token QR Dinamis (30 Detik) atau Barcode 1D
  const validation = validateDynamicQrPayload(rawInput);

  if (!validation.valid) {
    playScanSound(false);
    if (validation.isExpired) {
      showResultCard(false, '❌ QR CODE KADALUWARSA!', validation.reason);
    } else {
      showResultCard(false, 'Format Tidak Dikenali', validation.reason);
    }
    return;
  }

  // Enforce scan filter mode jika dipilih admin
  if (adminScanFilterMode === 'qr' && !validation.isDynamicQr) {
    playScanSound(false);
    showResultCard(false, 'Khusus QR Code Dinamis', 'Scanner diatur hanya menerima QR Code Dinamis 30 detik (Anti-Titip). Barcode 1D ditolak.');
    return;
  }

  if (adminScanFilterMode === 'barcode' && !validation.isBarcode1D) {
    playScanSound(false);
    showResultCard(false, 'Khusus Barcode 1D', 'Scanner diatur hanya menerima Barcode 1D. QR Code ditolak.');
    return;
  }

  const nim = validation.nim;

  try {
    // 2. Ambil data mahasiswa dari Firestore
    const studentSnap = await getDocs(query(
      collection(db, 'students'),
      where('nim', '==', nim),
      where('aktif', '==', true)
    ));

    if (studentSnap.empty) {
      showResultCard(false, 'Mahasiswa Tidak Terdaftar', `NIM ${nim} tidak ditemukan atau akun sedang dinonaktifkan.`);
      playScanSound(false);
      return;
    }

    const student = studentSnap.docs[0].data();

    // 3. Catat absensi via attendanceService
    const now = new Date();
    const timeFormatted = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

    const formatLabel = validation.isDynamicQr ? 'QR Dinamis 30s' : 'Barcode 1D';

    const newRecord = {
      uid: student.uid || studentSnap.docs[0].id,
      nim: student.nim,
      nama: student.nama,
      fakultas: student.fakultas,
      prodi: student.prodi,
      mataKuliah: activeScannerSession.namaMk,
      kodeMk: activeScannerSession.kodeMk,
      sesiId: activeScannerSession.id,
      pertemuan: activeScannerSession.pertemuan,
      tanggal: getTodayWIB(),
      waktu: timeFormatted,
      status: 'Hadir',
      metode: validation.isDynamicQr ? 'scan-qr-dinamis' : 'scan-barcode',
      keterangan: `Dipindai via ${formatLabel} di kelas`
    };

    await addManualAttendance(newRecord);
    playScanSound(true);

    // Tampilkan kartu hasil sukses selama 2 detik
    showResultCard(true, student.nama, `NIM: ${student.nim} • ${student.prodi} [${formatLabel}]`, student.fotoURL);

    // Masukkan ke riwayat scan terakhir
    recentScans.unshift({
      nama: student.nama,
      nim: student.nim,
      waktu: `${timeFormatted} (${formatLabel})`,
      status: 'Hadir'
    });
    renderRecentScansList();
  } catch (err) {
    playScanSound(false);
    showResultCard(false, 'Presensi Gagal / Duplikat', err.message);
  }
}

/**
 * Kartu Hasil Scan Besar (Flash 2 Detik)
 */
function showResultCard(isSuccess, title, subtitle, fotoURL = '') {
  const card = document.getElementById('scanner-result-overlay');
  if (!card) return;

  card.className = `scanner-result-overlay ${isSuccess ? 'result-success' : 'result-failed'}`;
  card.innerHTML = `
    <div class="result-avatar">
      ${fotoURL ? `<img src="${fotoURL}" alt="Foto">` : (title ? title.charAt(0).toUpperCase() : '!')}
    </div>
    <div class="result-title">${escapeHtml(title)}</div>
    <div class="result-subtitle">${escapeHtml(subtitle)}</div>
    <div class="result-badge">${isSuccess ? 'BERHASIL HADIR' : 'PRESENSI DITOLAK'}</div>
  `;

  card.classList.remove('hidden');
  setTimeout(() => {
    card.classList.add('hidden');
  }, 2200);
}

function renderRecentScansList() {
  const listEl = document.getElementById('scanner-recent-list');
  if (!listEl) return;

  listEl.innerHTML = recentScans.slice(0, 6).map(s => `
    <div class="recent-scan-item">
      <div style="font-weight: 700; color: var(--slate-900); font-size: 13px;">${escapeHtml(s.nama)}</div>
      <div style="font-size: 11px; color: var(--slate-500);"><span class="font-mono">${escapeHtml(s.nim)}</span> • ${escapeHtml(s.waktu)}</div>
      <span class="badge-status badge-hadir" style="margin-top: 4px; display: inline-block;">Hadir</span>
    </div>
  `).join('');
}

/**
 * Listener Barcode Scanner Fisik USB (Keyboard Wedge)
 * Menangkap ketikan cepat dari alat scanner USB yang diakhiri karakter Enter
 */
function setupUsbBarcodeWedgeListener() {
  let buffer = '';
  let lastKeyTime = Date.now();

  window.addEventListener('keydown', (e) => {
    // Jangan tangkap jika sedang mengetik di input form teks lain
    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
      return;
    }

    const currentTime = Date.now();
    // Scanner USB mengetik dengan jeda sangat cepat (< 40ms per huruf)
    if (currentTime - lastKeyTime > 60) {
      buffer = '';
    }
    lastKeyTime = currentTime;

    if (e.key === 'Enter') {
      if (buffer.length >= 8) {
        processScannedNim(buffer.trim());
      }
      buffer = '';
    } else if (e.key.length === 1) {
      buffer += e.key;
    }
  });
}
