/**
 * Logika Utama Aplikasi Sistem Absensi Mahasiswa UPNVJ
 * Mengatur Router SPA, Autentikasi Firebase, Cloud Firestore, Kamera Scanner, Barcode, & State
 */

import {
  auth,
  db,
  storage,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  ref,
  uploadBytes,
  getDownloadURL
} from './firebase.js';

import {
  FACULTIES,
  getFaculties,
  getFacultyById,
  getProdiList,
  FK_SPECIAL_NOTE
} from './data.js';

import {
  validateUpnvjEmail,
  validateNim,
  formatBirthdatePassword,
  extractJenjang,
  isBirthdateValid,
  validateIndonesianPhone,
  calculateProfileProgress,
  isDuplicateAttendance,
  generateCsvContent
} from './logic.js';

import {
  initUI,
  showToast,
  showConfirmDialog,
  showAttendanceProof,
  closeConfirmModal,
  closeProofModal,
  setButtonLoading,
  escapeHtml
} from './ui.js';

// Global Application State
const state = {
  currentRoute: '',
  selectedFaculty: sessionStorage.getItem('upnvj_selected_faculty') || '',
  selectedProdi: sessionStorage.getItem('upnvj_selected_prodi') || '',
  currentUser: null,
  studentProfile: null,
  attendanceList: [],
  isRegisterMode: false,
  html5QrCode: null,
  isScanning: false,
  currentCameraId: null,
  availableCameras: []
};

// Autocomplete daftar mata kuliah resmi
const DEFAULT_COURSES = [
  'Pemrograman Web',
  'Rekayasa Perangkat Lunak',
  'Basis Data Lanjut',
  'Kecerdasan Buatan',
  'Jaringan Komputer',
  'Sistem Operasi',
  'Metodologi Penelitian',
  'Pendidikan Kewarganegaraan',
  'Statistika dan Probabilitas',
  'Struktur Data dan Algoritma'
];

/**
 * Inisialisasi Aplikasi saat DOM siap
 */
document.addEventListener('DOMContentLoaded', () => {
  initUI();
  setupGlobalEventListeners();
  initAuthObserver();
  initRouter();
  populateCourseSuggestions();
});

/**
 * Setup Event Listeners Global
 */
function setupGlobalEventListeners() {
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  const confirmCancel = document.getElementById('confirm-modal-cancel');
  const confirmOk = document.getElementById('confirm-modal-ok');
  if (confirmCancel) confirmCancel.addEventListener('click', () => closeConfirmModal(false));
  if (confirmOk) confirmOk.addEventListener('click', () => closeConfirmModal(true));

  const closeProofBtn = document.getElementById('btn-close-proof');
  if (closeProofBtn) closeProofBtn.addEventListener('click', closeProofModal);

  window.addEventListener('hashchange', () => {
    handleNavigation(window.location.hash);
  });
}

/**
 * Pemantau Status Autentikasi Firebase
 */
function initAuthObserver() {
  onAuthStateChanged(auth, async (user) => {
    state.currentUser = user;

    if (user) {
      await loadStudentProfile(user.uid);
      updateNavbarUserInfo();

      const route = window.location.hash || '#/';
      if (!isProfileComplete() && route !== '#/profil') {
        navigateTo('#/profil');
        showToast('info', 'Lengkapi Profil', 'Harap lengkapi profil mahasiswa Anda untuk membuka akses presensi.');
      } else if (route === '#/login') {
        navigateTo('#/beranda');
      }
    } else {
      state.studentProfile = null;
      state.attendanceList = [];
      updateNavbarUserInfo();

      const protectedRoutes = ['#/beranda', '#/absensi', '#/riwayat', '#/profil'];
      if (protectedRoutes.includes(window.location.hash)) {
        navigateTo('#/login');
        showToast('warning', 'Akses Terbatas', 'Silakan masuk terlebih dahulu untuk mengakses fitur ini.');
      }
    }

    renderCurrentView();
  });
}

function isProfileComplete() {
  if (!state.studentProfile) return false;
  return Boolean(state.studentProfile.profileComplete);
}

async function loadStudentProfile(uid) {
  try {
    const docRef = doc(db, 'students', uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      state.studentProfile = docSnap.data();
    } else {
      const initialProfile = {
        uid: uid,
        nama: state.currentUser.displayName || '',
        email: state.currentUser.email || '',
        nim: state.currentUser.email ? state.currentUser.email.split('@')[0] : '',
        fakultas: state.selectedFaculty || '',
        prodi: state.selectedProdi || '',
        profileComplete: false,
        createdAt: new Date().toISOString()
      };
      state.studentProfile = initialProfile;
      await setDoc(docRef, initialProfile, { merge: true });
    }
  } catch (error) {
    console.warn('Gagal memuat profil mahasiswa dari Firestore:', error);
    if (!state.studentProfile && state.currentUser) {
      state.studentProfile = {
        uid: uid,
        nama: state.currentUser.displayName || 'Mahasiswa UPNVJ',
        email: state.currentUser.email || '',
        nim: state.currentUser.email ? state.currentUser.email.split('@')[0] : '',
        fakultas: state.selectedFaculty || '',
        prodi: state.selectedProdi || '',
        profileComplete: false
      };
    }
  }
}

function updateNavbarUserInfo() {
  const userSection = document.getElementById('nav-user-section');
  const guestSection = document.getElementById('nav-guest-section');
  const desktopLinks = document.getElementById('desktop-nav-links');
  const bottomNav = document.querySelector('.mobile-bottom-nav');

  const avatarImg = document.getElementById('nav-user-avatar');
  const initialDiv = document.getElementById('nav-user-initial');
  const nameEl = document.getElementById('nav-user-name');
  const nimEl = document.getElementById('nav-user-nim');

  if (state.currentUser && state.studentProfile) {
    if (userSection) {
      userSection.classList.remove('hidden');
      userSection.style.display = 'flex';
    }
    if (guestSection) guestSection.classList.add('hidden');
    if (desktopLinks) {
      desktopLinks.classList.remove('hidden');
      desktopLinks.style.display = 'flex';
    }
    if (bottomNav) bottomNav.style.display = 'flex';

    const displayName = state.studentProfile.nama || state.currentUser.displayName || 'Mahasiswa';
    const nim = state.studentProfile.nim || '-';

    if (nameEl) nameEl.textContent = displayName;
    if (nimEl) nimEl.textContent = nim;

    if (state.studentProfile.fotoURL) {
      if (avatarImg) {
        avatarImg.src = state.studentProfile.fotoURL;
        avatarImg.classList.remove('hidden');
      }
      if (initialDiv) initialDiv.classList.add('hidden');
    } else {
      if (avatarImg) avatarImg.classList.add('hidden');
      if (initialDiv) {
        initialDiv.classList.remove('hidden');
        initialDiv.textContent = displayName.charAt(0).toUpperCase();
      }
    }
  } else {
    if (userSection) {
      userSection.classList.add('hidden');
      userSection.style.display = 'none';
    }
    if (guestSection) guestSection.classList.remove('hidden');
    if (desktopLinks) {
      desktopLinks.classList.add('hidden');
      desktopLinks.style.display = 'none';
    }
    if (bottomNav) bottomNav.style.display = 'none';
  }
}

/**
 * ROUTER SPA Berbasis Hash
 */
function initRouter() {
  const currentHash = window.location.hash || '#/';
  handleNavigation(currentHash);
}

function navigateTo(hash) {
  window.location.hash = hash;
}

function handleNavigation(hash) {
  const cleanHash = hash.split('?')[0] || '#/';
  state.currentRoute = cleanHash;

  const protectedRoutes = ['#/beranda', '#/absensi', '#/riwayat', '#/profil'];
  if (protectedRoutes.includes(cleanHash) && !state.currentUser) {
    navigateTo('#/login');
    showToast('warning', 'Wajib Masuk', 'Silakan masuk dengan akun mahasiswa terlebih dahulu.');
    return;
  }

  if (state.currentUser && !isProfileComplete() && cleanHash !== '#/profil') {
    navigateTo('#/profil');
    showToast('info', 'Lengkapi Profil', 'Mohon lengkapi profil Anda terlebih dahulu.');
    return;
  }

  document.querySelectorAll('.app-view').forEach(view => {
    view.classList.add('hidden');
  });

  if (cleanHash !== '#/absensi' && state.isScanning) {
    stopCameraScanner();
  }

  updateActiveNav(cleanHash);
  renderCurrentView();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateActiveNav(hash) {
  document.querySelectorAll('.mobile-bottom-nav .nav-item').forEach(item => {
    const route = item.getAttribute('href');
    if (route === hash) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  document.querySelectorAll('.desktop-nav-btn').forEach(btn => {
    const route = btn.getAttribute('href');
    if (route === hash) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function renderCurrentView() {
  const route = state.currentRoute;
  const viewMap = {
    '#/': 'view-landing',
    '#/prodi': 'view-prodi',
    '#/login': 'view-login',
    '#/beranda': 'view-beranda',
    '#/absensi': 'view-absensi',
    '#/riwayat': 'view-riwayat',
    '#/profil': 'view-profil'
  };

  const targetViewId = viewMap[route] || 'view-notfound';
  const targetView = document.getElementById(targetViewId);

  if (targetView) {
    targetView.classList.remove('hidden');
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }

  switch (route) {
    case '#/':
      renderLandingView();
      break;
    case '#/prodi':
      renderProdiView();
      break;
    case '#/login':
      renderLoginView();
      break;
    case '#/beranda':
      renderDashboardView();
      break;
    case '#/absensi':
      renderAbsensiView();
      break;
    case '#/riwayat':
      renderRiwayatView();
      break;
    case '#/profil':
      renderProfilView();
      break;
  }
}

/**
 * 1. CONTROLLER: LANDING (Pilih Fakultas)
 */
function renderLandingView() {
  const grid = document.getElementById('faculty-grid');
  if (!grid) return;

  const faculties = getFaculties();
  grid.innerHTML = faculties.map(fac => {
    return `
      <div class="card-portal card-portal-hover faculty-card" data-faculty-id="${fac.id}">
        <div>
          <div class="faculty-card-top">
            <span class="faculty-code-chip">${fac.code}</span>
            <div class="faculty-icon-circle">
              <i data-lucide="${fac.icon}" style="width: 22px; height: 22px;"></i>
            </div>
          </div>
          <h3 class="faculty-name-title">${escapeHtml(fac.name)}</h3>
          <p class="faculty-prodi-counter">
            <i data-lucide="book-open" style="width: 14px; height: 14px; color: var(--gold-600);"></i>
            <span>Tersedia <strong>${fac.prodi.length} Program Studi</strong></span>
          </p>
        </div>
        <div class="faculty-card-footer">
          <span>Pilih Program Studi</span>
          <i data-lucide="arrow-right" style="width: 16px; height: 16px;"></i>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('[data-faculty-id]').forEach(card => {
    card.addEventListener('click', () => {
      const facId = card.getAttribute('data-faculty-id');
      state.selectedFaculty = facId;
      sessionStorage.setItem('upnvj_selected_faculty', facId);
      navigateTo('#/prodi');
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

/**
 * 2. CONTROLLER: PILIH PROGRAM STUDI
 */
function renderProdiView() {
  if (!state.selectedFaculty) {
    navigateTo('#/');
    return;
  }

  const faculty = getFacultyById(state.selectedFaculty);
  if (!faculty) {
    navigateTo('#/');
    return;
  }

  const codeEl = document.getElementById('prodi-faculty-code');
  const nameEl = document.getElementById('prodi-faculty-name');
  const countEl = document.getElementById('prodi-count-info');
  const badgeEl = document.getElementById('prodi-view-faculty-badge');
  const alertEl = document.getElementById('fk-info-alert');
  const alertTextEl = document.getElementById('fk-info-text');

  if (codeEl) codeEl.textContent = faculty.code;
  if (nameEl) nameEl.textContent = faculty.name;
  if (countEl) countEl.textContent = `${faculty.prodi.length} Program Studi Terakreditasi`;
  if (badgeEl) badgeEl.textContent = faculty.code;

  if (alertEl && alertTextEl) {
    if (faculty.specialNote) {
      alertEl.classList.remove('hidden');
      alertTextEl.textContent = faculty.specialNote;
    } else {
      alertEl.classList.add('hidden');
    }
  }

  const backBtn = document.getElementById('btn-back-faculty');
  if (backBtn) {
    backBtn.onclick = () => navigateTo('#/');
  }

  renderProdiItems(faculty.prodi);

  const searchInput = document.getElementById('search-prodi-input');
  if (searchInput) {
    searchInput.value = '';
    searchInput.oninput = (e) => {
      const query = e.target.value.toLowerCase().trim();
      const filtered = faculty.prodi.filter(p => p.toLowerCase().includes(query));
      renderProdiItems(filtered);
    };
  }

  if (window.lucide) window.lucide.createIcons();
}

function renderProdiItems(prodiList) {
  const container = document.getElementById('prodi-list-container');
  if (!container) return;

  if (prodiList.length === 0) {
    container.innerHTML = `
      <div class="card-portal" style="padding: 32px; text-align: center; color: var(--slate-500); font-size: 13px;">
        Tidak ada program studi yang cocok dengan pencarian Anda.
      </div>
    `;
    return;
  }

  container.innerHTML = prodiList.map(item => {
    const jenjang = extractJenjang(item);
    return `
      <div class="prodi-item-row" data-prodi-name="${escapeHtml(item)}">
        <div style="display: flex; align-items: center; gap: 14px; min-width: 0;">
          <span class="badge-jenjang badge-${jenjang}">${jenjang}</span>
          <span class="prodi-item-name">${escapeHtml(item)}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: #1e4b85; flex-shrink: 0;">
          <span class="hidden sm:inline">Pilih Program Studi</span>
          <i data-lucide="chevron-right" style="width: 16px; height: 16px;"></i>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-prodi-name]').forEach(card => {
    card.addEventListener('click', () => {
      const prodiName = card.getAttribute('data-prodi-name');
      state.selectedProdi = prodiName;
      sessionStorage.setItem('upnvj_selected_prodi', prodiName);
      navigateTo('#/login');
      showToast('success', 'Program Studi Dipilih', `${prodiName} terpilih. Silakan masuk akun.`);
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

/**
 * 3. CONTROLLER: LOGIN
 */
function renderLoginView() {
  const prodiBanner = document.getElementById('login-selected-prodi');
  const facBanner = document.getElementById('login-selected-faculty');
  const facObj = getFacultyById(state.selectedFaculty);

  if (prodiBanner) prodiBanner.textContent = state.selectedProdi || 'Belum Dipilih (Klik Ganti)';
  if (facBanner) facBanner.textContent = facObj ? facObj.name : 'Silakan pilih fakultas terlebih dahulu';

  const tabNim = document.getElementById('tab-login-nim');
  const tabGoogle = document.getElementById('tab-login-google');
  const formNimContainer = document.getElementById('login-form-nim-container');
  const formGoogleContainer = document.getElementById('login-form-google-container');

  if (tabNim && tabGoogle && formNimContainer && formGoogleContainer) {
    tabNim.onclick = () => {
      tabNim.classList.add('active');
      tabGoogle.classList.remove('active');
      formNimContainer.classList.remove('hidden');
      formGoogleContainer.classList.add('hidden');
    };

    tabGoogle.onclick = () => {
      tabGoogle.classList.add('active');
      tabNim.classList.remove('active');
      formGoogleContainer.classList.remove('hidden');
      formNimContainer.classList.add('hidden');
    };
  }

  const btnToggleAuthMode = document.getElementById('btn-toggle-auth-mode');
  const authModeLabel = document.getElementById('auth-mode-label');
  const registerNameField = document.getElementById('register-name-field');
  const btnSubmitNimText = document.getElementById('btn-submit-nim-text');

  if (btnToggleAuthMode) {
    btnToggleAuthMode.onclick = () => {
      state.isRegisterMode = !state.isRegisterMode;
      if (state.isRegisterMode) {
        if (authModeLabel) authModeLabel.textContent = 'Daftar Pertama Kali';
        if (btnToggleAuthMode) btnToggleAuthMode.textContent = 'Sudah Punya Akun? Masuk';
        if (registerNameField) registerNameField.classList.remove('hidden');
        if (btnSubmitNimText) btnSubmitNimText.textContent = 'Daftar & Masuk';
      } else {
        if (authModeLabel) authModeLabel.textContent = 'Mode Masuk Akun';
        if (btnToggleAuthMode) btnToggleAuthMode.textContent = 'Daftar Pertama Kali?';
        if (registerNameField) registerNameField.classList.add('hidden');
        if (btnSubmitNimText) btnSubmitNimText.textContent = 'Masuk ke Sistem Absensi';
      }
    };
  }

  const formNim = document.getElementById('form-nim-login');
  if (formNim) {
    formNim.onsubmit = async (e) => {
      e.preventDefault();
      await handleNimLoginSubmit();
    };
  }

  const btnGoogle = document.getElementById('btn-login-google');
  if (btnGoogle) btnGoogle.onclick = handleGoogleLogin;

  if (window.lucide) window.lucide.createIcons();
}

async function handleNimLoginSubmit() {
  const nimInput = document.getElementById('login-nim-input');
  const dobInput = document.getElementById('login-dob-input');
  const nameInput = document.getElementById('register-name-input');
  const submitBtn = document.getElementById('btn-submit-nim-login');

  const errorNim = document.getElementById('error-login-nim');
  const errorDob = document.getElementById('error-login-dob');
  const errorName = document.getElementById('error-register-name');

  if (errorNim) errorNim.classList.add('hidden');
  if (errorDob) errorDob.classList.add('hidden');
  if (errorName) errorName.classList.add('hidden');

  const nim = nimInput.value.trim();
  const dob = dobInput.value;
  const name = nameInput ? nameInput.value.trim() : '';

  let hasError = false;

  if (!validateNim(nim)) {
    if (errorNim) errorNim.classList.remove('hidden');
    hasError = true;
  }

  if (!isBirthdateValid(dob)) {
    if (errorDob) errorDob.classList.remove('hidden');
    hasError = true;
  }

  if (state.isRegisterMode && !name) {
    if (errorName) errorName.classList.remove('hidden');
    hasError = true;
  }

  if (hasError) return;

  const email = `${nim}@mahasiswa.upnvj.ac.id`;
  const password = formatBirthdatePassword(dob);

  setButtonLoading(submitBtn, true, 'Memverifikasi...');

  try {
    if (state.isRegisterMode) {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const newProfile = {
        uid: user.uid,
        nama: name,
        nim: nim,
        email: email,
        fakultas: state.selectedFaculty || '',
        prodi: state.selectedProdi || '',
        tanggalLahir: dob,
        profileComplete: false,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'students', user.uid), newProfile);
      state.studentProfile = newProfile;

      showToast('success', 'Pendaftaran Berhasil', `Selamat datang, ${name}. Harap lengkapi profil Anda.`);
      navigateTo('#/profil');
    } else {
      await signInWithEmailAndPassword(auth, email, password);
      showToast('success', 'Berhasil Masuk', 'Selamat datang di Sistem Absensi UPNVJ.');
      navigateTo('#/beranda');
    }
  } catch (error) {
    console.error('Error login/daftar NIM:', error);
    let msg = 'Terjadi kesalahan saat memverifikasi akun.';
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      msg = 'NIM atau Tanggal Lahir tidak cocok. Jika baru pertama kali, klik "Daftar Pertama Kali".';
    } else if (error.code === 'auth/email-already-in-use') {
      msg = 'Akun dengan NIM ini sudah terdaftar. Silakan beralih ke mode "Masuk Akun".';
    } else if (error.code === 'auth/network-request-failed') {
      msg = 'Koneksi jaringan terputus. Mohon periksa koneksi internet Anda.';
    }
    showToast('error', 'Gagal Masuk', msg);
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

async function handleGoogleLogin() {
  const btnGoogle = document.getElementById('btn-login-google');
  setButtonLoading(btnGoogle, true, 'Membuka Google...');

  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    if (!validateUpnvjEmail(user.email)) {
      await signOut(auth);
      showToast('error', 'Domain Ditolak', 'Gunakan email institusi @mahasiswa.upnvj.ac.id');
      return;
    }

    showToast('success', 'Login Berhasil', `Selamat datang, ${user.displayName || 'Mahasiswa'}.`);
    navigateTo('#/beranda');
  } catch (error) {
    console.error('Error Google Auth:', error);
    if (error.code === 'auth/popup-closed-by-user') {
      showToast('info', 'Login Dibatalkan', 'Jendela login Google ditutup sebelum selesai.');
    } else if (error.code === 'auth/unauthorized-domain') {
      showToast('warning', 'Domain Belum Terdaftar', 'Domain hosting ini perlu ditambahkan ke Authorized Domains di Firebase Console.');
    } else {
      showToast('error', 'Gagal Masuk Google', 'Terjadi gangguan saat menghubungkan ke akun Google.');
    }
  } finally {
    setButtonLoading(btnGoogle, false);
  }
}

async function handleLogout() {
  const confirmed = await showConfirmDialog({
    title: 'Keluar dari Sistem?',
    message: 'Apakah Anda yakin ingin keluar dari akun Sistem Absensi UPNVJ?',
    confirmText: 'Ya, Keluar',
    cancelText: 'Batal',
    isDestructive: true
  });

  if (confirmed) {
    try {
      await signOut(auth);
      state.currentUser = null;
      state.studentProfile = null;
      state.attendanceList = [];
      showToast('info', 'Telah Keluar', 'Anda telah berhasil keluar dari akun.');
      navigateTo('#/');
    } catch (e) {
      console.error('Error logout:', e);
      showToast('error', 'Error', 'Gagal keluar dari sesi.');
    }
  }
}

/**
 * 4. CONTROLLER: BERANDA (DASHBOARD)
 */
async function renderDashboardView() {
  if (!state.currentUser) return;

  const prof = state.studentProfile || {};
  const greetingEl = document.getElementById('dash-greeting');
  const prodiInfoEl = document.getElementById('dash-prodi-info');
  const dateTodayEl = document.getElementById('dash-date-today');

  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const formattedToday = now.toLocaleDateString('id-ID', options);

  if (greetingEl) greetingEl.textContent = `Halo, ${prof.nama || 'Mahasiswa UPNVJ'}`;
  if (prodiInfoEl) prodiInfoEl.textContent = `${prof.prodi || 'Program Studi'} • ${prof.fakultas || 'UPNVJ'}`;
  if (dateTodayEl) dateTodayEl.textContent = formattedToday;

  const cardNama = document.getElementById('dash-card-nama');
  const cardNim = document.getElementById('dash-card-nim');
  const cardProdi = document.getElementById('dash-card-prodi');
  const cardPhoto = document.getElementById('dash-card-photo');
  const cardInitial = document.getElementById('dash-card-initial');

  if (cardNama) cardNama.textContent = prof.nama || 'Mahasiswa';
  if (cardNim) cardNim.textContent = `NIM: ${prof.nim || '-'}`;
  if (cardProdi) cardProdi.textContent = prof.prodi || '-';

  if (prof.fotoURL) {
    if (cardPhoto) {
      cardPhoto.src = prof.fotoURL;
      cardPhoto.classList.remove('hidden');
    }
    if (cardInitial) cardInitial.classList.add('hidden');
  } else {
    if (cardPhoto) cardPhoto.classList.add('hidden');
    if (cardInitial) cardInitial.classList.remove('hidden');
  }

  await fetchAttendanceRecords();
  calculateDashboardStats();
  renderRecentDashboardList();

  if (window.lucide) window.lucide.createIcons();
}

async function fetchAttendanceRecords() {
  if (!state.currentUser) return;
  try {
    const q = query(
      collection(db, 'attendance'),
      where('uid', '==', state.currentUser.uid)
    );
    const snap = await getDocs(q);
    const list = [];
    snap.forEach(d => {
      const data = d.data();
      list.push({ id: d.id, ...data });
    });

    list.sort((a, b) => new Date(b.createdAt || b.tanggal) - new Date(a.createdAt || a.tanggal));
    state.attendanceList = list;
  } catch (error) {
    console.warn('Gagal memuat rekam kehadiran dari Firestore:', error);
  }
}

function calculateDashboardStats() {
  const statHadirBulan = document.getElementById('stat-hadir-bulan');
  const statAbsenHari = document.getElementById('stat-absen-hari');
  const statMatkulTerbanyak = document.getElementById('stat-matkul-terbanyak');

  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthStr = todayStr.substring(0, 7);

  let hadirBulan = 0;
  let absenHari = 0;
  const matkulCount = {};

  state.attendanceList.forEach(item => {
    if (item.tanggal && item.tanggal.startsWith(currentMonthStr)) hadirBulan++;
    if (item.tanggal === todayStr) absenHari++;
    const matkul = item.mataKuliah || 'Lainnya';
    matkulCount[matkul] = (matkulCount[matkul] || 0) + 1;
  });

  let topMatkul = '-';
  let maxCount = 0;
  for (const [m, count] of Object.entries(matkulCount)) {
    if (count > maxCount) {
      maxCount = count;
      topMatkul = m;
    }
  }

  if (statHadirBulan) statHadirBulan.textContent = hadirBulan;
  if (statAbsenHari) statAbsenHari.textContent = absenHari;
  if (statMatkulTerbanyak) statMatkulTerbanyak.textContent = topMatkul;
}

function renderRecentDashboardList() {
  const container = document.getElementById('dash-recent-list');
  if (!container) return;

  const recent = state.attendanceList.slice(0, 4);
  if (recent.length === 0) {
    container.innerHTML = `
      <div style="padding: 32px 16px; text-align: center; font-size: 13px; color: var(--slate-400);">
        Belum ada catatan presensi. Silakan lakukan presensi kuliah hari ini.
      </div>
    `;
    return;
  }

  container.innerHTML = recent.map(item => `
    <div style="padding: 12px 0; border-bottom: 1px solid var(--slate-100); display: flex; align-items: center; justify-content: space-between; font-size: 13px;">
      <div style="min-width: 0; padding-right: 12px;">
        <div style="font-weight: 700; color: var(--slate-900); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(item.mataKuliah)}</div>
        <div style="font-size: 11px; color: var(--slate-400); margin-top: 2px;">${escapeHtml(item.tanggal)} • ${escapeHtml(item.waktuFormatted || 'Tercatat')}</div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
        <span style="font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 6px; background: ${item.metode === 'scan' ? '#e0f2fe' : '#f1f5f9'}; color: ${item.metode === 'scan' ? '#0369a1' : '#475569'};">
          ${item.metode === 'scan' ? 'Barcode' : 'Manual'}
        </span>
        <span style="font-size: 11px; font-weight: 800; color: #059669; background: #d1fae5; padding: 3px 10px; border-radius: 9999px;">
          ${escapeHtml(item.status || 'Hadir')}
        </span>
      </div>
    </div>
  `).join('');
}

/**
 * 5. CONTROLLER: ABSENSI
 */
function renderAbsensiView() {
  if (!state.currentUser) return;
  const prof = state.studentProfile || {};

  const tabScan = document.getElementById('tab-absensi-scan');
  const tabManual = document.getElementById('tab-absensi-manual');
  const contentScan = document.getElementById('absensi-content-scan');
  const contentManual = document.getElementById('absensi-content-manual');

  if (tabScan && tabManual && contentScan && contentManual) {
    tabScan.onclick = () => {
      tabScan.style.background = '#ffffff';
      tabScan.style.color = '#0b2341';
      tabScan.style.boxShadow = 'var(--shadow-sm)';
      tabManual.style.background = 'transparent';
      tabManual.style.color = '#475569';
      tabManual.style.boxShadow = 'none';
      contentScan.classList.remove('hidden');
      contentManual.classList.add('hidden');
    };

    tabManual.onclick = () => {
      tabManual.style.background = '#ffffff';
      tabManual.style.color = '#0b2341';
      tabManual.style.boxShadow = 'var(--shadow-sm)';
      tabScan.style.background = 'transparent';
      tabScan.style.color = '#475569';
      tabScan.style.boxShadow = 'none';
      contentManual.classList.remove('hidden');
      contentScan.classList.add('hidden');
      if (state.isScanning) stopCameraScanner();
    };
  }

  renderDigitalKtm(prof);

  const btnStartScanner = document.getElementById('btn-start-scanner');
  const btnStopScanner = document.getElementById('btn-stop-scanner');
  const btnSwitchCamera = document.getElementById('btn-switch-camera');

  if (btnStartScanner) btnStartScanner.onclick = startCameraScanner;
  if (btnStopScanner) btnStopScanner.onclick = stopCameraScanner;
  if (btnSwitchCamera) btnSwitchCamera.onclick = switchCamera;

  setupManualAttendanceForm(prof);

  const btnDownloadKtm = document.getElementById('btn-download-ktm');
  if (btnDownloadKtm) btnDownloadKtm.onclick = downloadKtmImage;

  if (window.lucide) window.lucide.createIcons();
}

function renderDigitalKtm(profile) {
  const ktmNama = document.getElementById('ktm-nama');
  const ktmNim = document.getElementById('ktm-nim');
  const ktmProdi = document.getElementById('ktm-prodi');
  const ktmFakultas = document.getElementById('ktm-fakultas');
  const ktmBarcodeText = document.getElementById('ktm-barcode-nim-text');
  const ktmPhoto = document.getElementById('ktm-photo');
  const ktmPhotoPlaceholder = document.getElementById('ktm-photo-placeholder');

  const nim = profile.nim || '2110511001';
  const nama = profile.nama || 'Mahasiswa UPNVJ';
  const prodi = profile.prodi || 'Program Studi';
  const facObj = getFacultyById(profile.fakultas);
  const fakultas = facObj ? facObj.name : (profile.fakultas || 'UPN "Veteran" Jakarta');

  if (ktmNama) ktmNama.textContent = nama;
  if (ktmNim) ktmNim.textContent = nim;
  if (ktmProdi) ktmProdi.textContent = prodi;
  if (ktmFakultas) ktmFakultas.textContent = fakultas;
  if (ktmBarcodeText) ktmBarcodeText.textContent = nim;

  if (profile.fotoURL) {
    if (ktmPhoto) {
      ktmPhoto.src = profile.fotoURL;
      ktmPhoto.classList.remove('hidden');
    }
    if (ktmPhotoPlaceholder) ktmPhotoPlaceholder.classList.add('hidden');
  } else {
    if (ktmPhoto) ktmPhoto.classList.add('hidden');
    if (ktmPhotoPlaceholder) ktmPhotoPlaceholder.classList.remove('hidden');
  }

  try {
    if (window.JsBarcode) {
      window.JsBarcode("#ktm-barcode-canvas", nim, {
        format: "CODE128",
        lineColor: "#0b2341",
        width: 1.8,
        height: 50,
        displayValue: false,
        margin: 4
      });
    }
  } catch (err) {
    console.warn("Gagal membuat barcode via JsBarcode:", err);
  }
}

function downloadKtmImage() {
  const nim = state.studentProfile ? state.studentProfile.nim : 'KTM_UPNVJ';
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 600, 360);
  grad.addColorStop(0, '#07172c');
  grad.addColorStop(0.5, '#0b2341');
  grad.addColorStop(1, '#163a69');
  ctx.fillStyle = grad;
  ctx.roundRect ? ctx.roundRect(0, 0, 600, 360, 20) : ctx.rect(0, 0, 600, 360);
  ctx.fill();

  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 352, 600, 8);

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 16px Outfit, sans-serif';
  ctx.fillText('UPN "VETERAN" JAKARTA', 30, 45);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '11px Plus Jakarta Sans, sans-serif';
  ctx.fillText('KARTU TANDA MAHASISWA DIGITAL', 30, 65);

  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.moveTo(30, 80);
  ctx.lineTo(570, 80);
  ctx.stroke();

  const prof = state.studentProfile || {};
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px Outfit, sans-serif';
  ctx.fillText(prof.nama || 'Nama Mahasiswa', 140, 125);

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 15px monospace';
  ctx.fillText(`NIM: ${prof.nim || '2110511001'}`, 140, 155);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '13px Plus Jakarta Sans, sans-serif';
  ctx.fillText(prof.prodi || 'Program Studi', 140, 185);
  ctx.fillText(prof.fakultas || 'Fakultas', 140, 210);

  ctx.fillStyle = '#ffffff';
  ctx.roundRect ? ctx.roundRect(30, 240, 540, 90, 12) : ctx.rect(30, 240, 540, 90);
  ctx.fill();

  const barcodeSvg = document.getElementById('ktm-barcode-canvas');
  if (barcodeSvg) {
    const xml = new XMLSerializer().serializeToString(barcodeSvg);
    const svg64 = btoa(xml);
    const b64Start = 'data:image/svg+xml;base64,';
    const image64 = b64Start + svg64;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 50, 245, 500, 50);
      ctx.fillStyle = '#0b2341';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(prof.nim || '2110511001', 300, 318);

      const link = document.createElement('a');
      link.download = `KTM_UPNVJ_${nim}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('success', 'KTM Berhasil Diunduh', 'Kartu tanda mahasiswa tersimpan sebagai gambar.');
    };
    img.src = image64;
  }
}

async function startCameraScanner() {
  const matkulInput = document.getElementById('scan-matkul-input');
  const matkul = matkulInput ? matkulInput.value.trim() : '';

  if (!matkul) {
    showToast('warning', 'Mata Kuliah Wajib Diisi', 'Silakan isi mata kuliah sebelum membuka kamera scanner.');
    if (matkulInput) matkulInput.focus();
    return;
  }

  const btnStart = document.getElementById('btn-start-scanner');
  const btnStop = document.getElementById('btn-stop-scanner');
  const btnSwitch = document.getElementById('btn-switch-camera');
  const placeholder = document.getElementById('scanner-idle-placeholder');
  const overlay = document.getElementById('scanner-overlay');
  const statusBadge = document.getElementById('scanner-status-badge');

  if (!window.Html5Qrcode) {
    showToast('error', 'Library Belum Siap', 'Pustaka pemindai barcode sedang dimuat. Coba beberapa saat lagi.');
    return;
  }

  try {
    if (!state.html5QrCode) {
      state.html5QrCode = new window.Html5Qrcode("scanner-reader");
    }

    const devices = await window.Html5Qrcode.getCameras();
    if (!devices || devices.length === 0) {
      showToast('error', 'Kamera Tidak Ditemukan', 'Perangkat tidak memiliki kamera atau izin belum diberikan.');
      return;
    }
    state.availableCameras = devices;

    const backCam = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('belakang'));
    const selectedCamId = backCam ? backCam.id : devices[0].id;
    state.currentCameraId = selectedCamId;

    const qrConfig = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.333334
    };

    await state.html5QrCode.start(
      selectedCamId,
      qrConfig,
      onBarcodeScanSuccess,
      onBarcodeScanFailure
    );

    state.isScanning = true;
    if (btnStart) btnStart.classList.add('hidden');
    if (btnStop) {
      btnStop.classList.remove('hidden');
      btnStop.style.display = 'inline-flex';
    }
    if (btnSwitch && devices.length > 1) {
      btnSwitch.classList.remove('hidden');
      btnSwitch.style.display = 'inline-flex';
    }
    if (placeholder) placeholder.classList.add('hidden');
    if (overlay) overlay.classList.remove('hidden');
    if (statusBadge) {
      statusBadge.textContent = 'Memindai...';
      statusBadge.style.background = '#fef3c7';
      statusBadge.style.color = '#92400e';
    }
    showToast('info', 'Kamera Aktif', 'Arahkan kamera ke barcode atau QR code pada KTM.');
  } catch (err) {
    console.error('Gagal memulai scanner kamera:', err);
    let msg = 'Izin kamera ditolak atau kamera tidak dapat diakses.';
    if (err.name === 'NotAllowedError') {
      msg = 'Izin kamera ditolak oleh browser. Mohon izinkan akses kamera di pengaturan browser.';
    }
    showToast('error', 'Gagal Membuka Kamera', msg);
  }
}

async function stopCameraScanner() {
  if (state.html5QrCode && state.isScanning) {
    try {
      await state.html5QrCode.stop();
      state.isScanning = false;
    } catch (e) {
      console.warn('Gagal menghentikan scanner:', e);
    }
  }

  const btnStart = document.getElementById('btn-start-scanner');
  const btnStop = document.getElementById('btn-stop-scanner');
  const btnSwitch = document.getElementById('btn-switch-camera');
  const placeholder = document.getElementById('scanner-idle-placeholder');
  const overlay = document.getElementById('scanner-overlay');
  const statusBadge = document.getElementById('scanner-status-badge');

  if (btnStart) btnStart.classList.remove('hidden');
  if (btnStop) {
    btnStop.classList.add('hidden');
    btnStop.style.display = 'none';
  }
  if (btnSwitch) {
    btnSwitch.classList.add('hidden');
    btnSwitch.style.display = 'none';
  }
  if (placeholder) placeholder.classList.remove('hidden');
  if (overlay) overlay.classList.add('hidden');
  if (statusBadge) {
    statusBadge.textContent = 'Siap';
    statusBadge.style.background = '#f1f5f9';
    statusBadge.style.color = '#475569';
  }
}

async function switchCamera() {
  if (!state.isScanning || state.availableCameras.length < 2) return;
  const currentIndex = state.availableCameras.findIndex(c => c.id === state.currentCameraId);
  const nextIndex = (currentIndex + 1) % state.availableCameras.length;
  state.currentCameraId = state.availableCameras[nextIndex].id;

  await stopCameraScanner();
  await startCameraScanner();
}

async function onBarcodeScanSuccess(decodedText) {
  const scannedNim = decodedText.trim();
  const matkulInput = document.getElementById('scan-matkul-input');
  const matkul = matkulInput ? matkulInput.value.trim() : 'Mata Kuliah';

  await stopCameraScanner();

  if (!validateNim(scannedNim)) {
    showToast('error', 'Barcode Tidak Valid', `Data terbaca ("${scannedNim}") bukan format 10 digit NIM UPNVJ.`);
    return;
  }

  const currentNim = state.studentProfile ? state.studentProfile.nim : '';
  if (currentNim && scannedNim !== currentNim) {
    showToast('warning', 'NIM Tidak Cocok', `Barcode milik NIM ${scannedNim}, sedangkan Anda masuk sebagai NIM ${currentNim}.`);
    return;
  }

  await recordAttendance({
    nim: scannedNim,
    mataKuliah: matkul,
    metode: 'scan'
  });
}

function onBarcodeScanFailure() {}

function setupManualAttendanceForm(profile) {
  const manualNim = document.getElementById('manual-nim-input');
  const manualNama = document.getElementById('manual-display-nama');
  const manualProdi = document.getElementById('manual-display-prodi');
  const formManual = document.getElementById('form-manual-attendance');

  if (manualNim) manualNim.value = profile.nim || '';
  if (manualNama) manualNama.textContent = profile.nama || '-';
  if (manualProdi) manualProdi.textContent = profile.prodi || '-';

  if (formManual) {
    formManual.onsubmit = async (e) => {
      e.preventDefault();
      const matkulInput = document.getElementById('manual-matkul-input');
      const errMatkul = document.getElementById('error-manual-matkul');
      const errNim = document.getElementById('error-manual-nim');
      const submitBtn = document.getElementById('btn-submit-manual-absen');

      if (errMatkul) errMatkul.classList.add('hidden');
      if (errNim) errNim.classList.add('hidden');

      const matkul = matkulInput ? matkulInput.value.trim() : '';
      const nim = manualNim ? manualNim.value.trim() : '';

      if (!matkul) {
        if (errMatkul) errMatkul.classList.remove('hidden');
        return;
      }

      if (!validateNim(nim)) {
        if (errNim) errNim.classList.remove('hidden');
        return;
      }

      setButtonLoading(submitBtn, true, 'Merekam Presensi...');
      try {
        await recordAttendance({
          nim: nim,
          mataKuliah: matkul,
          metode: 'manual'
        });
        if (matkulInput) matkulInput.value = '';
      } finally {
        setButtonLoading(submitBtn, false);
      }
    };
  }
}

async function recordAttendance({ nim, mataKuliah, metode = 'manual' }) {
  if (!state.currentUser) {
    showToast('error', 'Gagal', 'Anda harus masuk akun terlebih dahulu.');
    return;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date();
  const timeFormatted = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

  const isDuplicate = isDuplicateAttendance(state.attendanceList, nim, mataKuliah, todayStr);
  if (isDuplicate) {
    showToast('warning', 'Presensi Sudah Ada', `Anda sudah melakukan presensi untuk mata kuliah "${mataKuliah}" hari ini (${todayStr}).`);
    return;
  }

  const prof = state.studentProfile || {};
  const newAttendance = {
    uid: state.currentUser.uid,
    nim: nim,
    nama: prof.nama || state.currentUser.displayName || 'Mahasiswa UPNVJ',
    fakultas: prof.fakultas || state.selectedFaculty || 'UPNVJ',
    prodi: prof.prodi || state.selectedProdi || 'Program Studi',
    mataKuliah: mataKuliah,
    metode: metode,
    tanggal: todayStr,
    waktuFormatted: timeFormatted,
    status: 'Hadir',
    createdAt: new Date().toISOString()
  };

  try {
    const docRef = await addDoc(collection(db, 'attendance'), {
      ...newAttendance,
      waktu: serverTimestamp()
    });

    newAttendance.id = docRef.id;
    state.attendanceList.unshift(newAttendance);

    showAttendanceProof(newAttendance);
    showToast('success', 'Presensi Berhasil', `Kehadiran untuk mata kuliah ${mataKuliah} berhasil dicatat.`);
  } catch (error) {
    console.warn('Gagal menyimpan ke Firestore online:', error);
    newAttendance.id = 'local_' + Date.now();
    state.attendanceList.unshift(newAttendance);
    showAttendanceProof(newAttendance);
    showToast('success', 'Presensi Tercatat (Lokal)', 'Data tersimpan di perangkat.');
  }
}

/**
 * 6. CONTROLLER: RIWAYAT
 */
async function renderRiwayatView() {
  if (!state.currentUser) return;
  await fetchAttendanceRecords();

  const searchInput = document.getElementById('filter-riwayat-search');
  const metodeSelect = document.getElementById('filter-riwayat-metode');
  const tanggalInput = document.getElementById('filter-riwayat-tanggal');
  const btnExport = document.getElementById('btn-export-csv');

  const applyFilters = () => {
    const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const m = metodeSelect ? metodeSelect.value : 'all';
    const d = tanggalInput ? tanggalInput.value : '';

    const filtered = state.attendanceList.filter(item => {
      const matchMatkul = !q || (item.mataKuliah || '').toLowerCase().includes(q);
      const matchMetode = m === 'all' || item.metode === m;
      const matchTanggal = !d || item.tanggal === d;
      return matchMatkul && matchMetode && matchTanggal;
    });

    renderRiwayatTable(filtered);
  };

  if (searchInput) searchInput.oninput = applyFilters;
  if (metodeSelect) metodeSelect.onchange = applyFilters;
  if (tanggalInput) tanggalInput.onchange = applyFilters;

  if (btnExport) {
    btnExport.onclick = () => {
      const nim = state.studentProfile ? state.studentProfile.nim : 'Mahasiswa';
      const csvData = generateCsvContent(state.attendanceList, state.studentProfile);
      downloadCsvFile(csvData, `Riwayat_Absensi_UPNVJ_${nim}.csv`);
      showToast('success', 'Ekspor Selesai', 'File CSV riwayat absensi berhasil diunduh.');
    };
  }

  applyFilters();
  if (window.lucide) window.lucide.createIcons();
}

function renderRiwayatTable(records) {
  const tbody = document.getElementById('riwayat-table-body');
  const emptyState = document.getElementById('riwayat-empty-state');
  if (!tbody) return;

  if (records.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  tbody.innerHTML = records.map(item => `
    <tr style="border-bottom: 1px solid var(--slate-100); transition: background 0.15s ease;">
      <td style="padding: 14px 20px;">
        <div style="font-weight: 700; color: var(--slate-900);">${escapeHtml(item.tanggal)}</div>
        <div style="font-size: 11px; color: var(--slate-400); margin-top: 2px;">${escapeHtml(item.waktuFormatted || 'Tercatat')}</div>
      </td>
      <td style="padding: 14px 20px; font-weight: 700; color: var(--navy-900);">
        ${escapeHtml(item.mataKuliah)}
      </td>
      <td style="padding: 14px 20px; color: var(--slate-600);">
        ${escapeHtml(item.prodi)}
      </td>
      <td style="padding: 14px 20px; text-align: center;">
        <span style="font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 9999px; background: ${item.metode === 'scan' ? '#e0f2fe' : '#f1f5f9'}; color: ${item.metode === 'scan' ? '#0369a1' : '#475569'};">
          ${item.metode === 'scan' ? 'Barcode / QR' : 'Manual'}
        </span>
      </td>
      <td style="padding: 14px 20px; text-align: center;">
        <span style="font-size: 11px; font-weight: 800; color: #059669; background: #d1fae5; padding: 4px 12px; border-radius: 9999px;">
          ${escapeHtml(item.status || 'Hadir')}
        </span>
      </td>
    </tr>
  `).join('');
}

function downloadCsvFile(content, fileName) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
}

/**
 * 7. CONTROLLER: PROFIL
 */
function renderProfilView() {
  if (!state.currentUser) return;
  const prof = state.studentProfile || {};

  initChainedFacultyDropdown(prof.fakultas, prof.prodi);

  const namaInput = document.getElementById('prof-nama');
  const nimInput = document.getElementById('prof-nim');
  const emailInput = document.getElementById('prof-email');
  const angkatanInput = document.getElementById('prof-angkatan');
  const semesterInput = document.getElementById('prof-semester');
  const dobInput = document.getElementById('prof-dob');
  const pobInput = document.getElementById('prof-pob');
  const genderInput = document.getElementById('prof-gender');
  const phoneInput = document.getElementById('prof-phone');
  const addressInput = document.getElementById('prof-address');

  if (namaInput) namaInput.value = prof.nama || '';
  if (nimInput) nimInput.value = prof.nim || '';
  if (emailInput) emailInput.value = state.currentUser.email || '';
  if (angkatanInput) angkatanInput.value = prof.angkatan || '2022';
  if (semesterInput) semesterInput.value = prof.semester || '4';
  if (dobInput) dobInput.value = prof.tanggalLahir || '';
  if (pobInput) pobInput.value = prof.tempatLahir || '';
  if (genderInput) genderInput.value = prof.jenisKelamin || '';
  if (phoneInput) phoneInput.value = prof.noHp || '';
  if (addressInput) addressInput.value = prof.alamat || '';

  const photoPreview = document.getElementById('profile-photo-preview');
  const photoPlaceholder = document.getElementById('profile-photo-placeholder');
  if (prof.fotoURL) {
    if (photoPreview) {
      photoPreview.src = prof.fotoURL;
      photoPreview.classList.remove('hidden');
    }
    if (photoPlaceholder) photoPlaceholder.classList.add('hidden');
  }

  updateProfileProgressMeter();

  const photoInput = document.getElementById('profile-photo-input');
  if (photoInput) photoInput.onchange = handleProfilePhotoSelected;

  const formProfile = document.getElementById('form-student-profile');
  if (formProfile) formProfile.onsubmit = handleProfileSave;

  formProfile.querySelectorAll('input, select, textarea').forEach(el => {
    el.oninput = updateProfileProgressMeter;
  });

  if (window.lucide) window.lucide.createIcons();
}

function initChainedFacultyDropdown(selectedFacId, selectedProdiName) {
  const facSelect = document.getElementById('prof-fakultas');
  const prodiSelect = document.getElementById('prof-prodi');
  if (!facSelect || !prodiSelect) return;

  const faculties = getFaculties();
  facSelect.innerHTML = '<option value="">Pilih Fakultas</option>' +
    faculties.map(f => `<option value="${f.id}" ${f.id === selectedFacId ? 'selected' : ''}>${f.code} - ${f.name}</option>`).join('');

  const updateProdiDropdown = (facId) => {
    const prodiList = getProdiList(facId);
    prodiSelect.innerHTML = '<option value="">Pilih Program Studi</option>' +
      prodiList.map(p => `<option value="${p}" ${p === selectedProdiName ? 'selected' : ''}>${p}</option>`).join('');
  };

  updateProdiDropdown(selectedFacId || facSelect.value);

  facSelect.onchange = () => {
    updateProdiDropdown(facSelect.value);
    updateProfileProgressMeter();
  };
}

function updateProfileProgressMeter() {
  const currentFormData = getProfileFormData();
  const percent = calculateProfileProgress(currentFormData);

  const fillEl = document.getElementById('profile-progress-fill');
  const textEl = document.getElementById('profile-progress-percent');
  const hintEl = document.getElementById('profile-progress-hint');

  if (fillEl) fillEl.style.width = `${percent}%`;
  if (textEl) textEl.textContent = `${percent}%`;

  if (hintEl) {
    if (percent === 100) {
      hintEl.textContent = 'Profil Anda telah terisi 100% dan terverifikasi untuk presensi perkuliahan.';
      hintEl.style.color = '#059669';
    } else {
      hintEl.textContent = 'Lengkapi semua field bertanda bintang (*) untuk membuka seluruh fungsi presensi.';
      hintEl.style.color = '#64748b';
    }
  }
}

function getProfileFormData() {
  return {
    nama: (document.getElementById('prof-nama')?.value || '').trim(),
    nim: (document.getElementById('prof-nim')?.value || '').trim(),
    email: (document.getElementById('prof-email')?.value || '').trim(),
    fakultas: (document.getElementById('prof-fakultas')?.value || '').trim(),
    prodi: (document.getElementById('prof-prodi')?.value || '').trim(),
    angkatan: (document.getElementById('prof-angkatan')?.value || '').trim(),
    semester: (document.getElementById('prof-semester')?.value || '').trim(),
    tanggalLahir: (document.getElementById('prof-dob')?.value || '').trim(),
    tempatLahir: (document.getElementById('prof-pob')?.value || '').trim(),
    jenisKelamin: (document.getElementById('prof-gender')?.value || '').trim(),
    noHp: (document.getElementById('prof-phone')?.value || '').trim(),
    alamat: (document.getElementById('prof-address')?.value || '').trim(),
    fotoURL: state.studentProfile ? state.studentProfile.fotoURL : ''
  };
}

async function handleProfilePhotoSelected(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('error', 'Format Tidak Didukung', 'Harap pilih file gambar (JPG, PNG, atau WEBP).');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');

      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;

      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 400, 400);

      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);

      const photoPreview = document.getElementById('profile-photo-preview');
      const photoPlaceholder = document.getElementById('profile-photo-placeholder');
      if (photoPreview) {
        photoPreview.src = compressedDataUrl;
        photoPreview.classList.remove('hidden');
      }
      if (photoPlaceholder) photoPlaceholder.classList.add('hidden');

      if (!state.studentProfile) state.studentProfile = {};
      state.studentProfile.fotoURL = compressedDataUrl;
      updateProfileProgressMeter();
      showToast('info', 'Foto Diproses', 'Foto profil telah dipotong bulat dan dioptimalkan.');
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

async function handleProfileSave(e) {
  e.preventDefault();
  if (!state.currentUser) return;

  const errNama = document.getElementById('error-prof-nama');
  const errNim = document.getElementById('error-prof-nim');
  const errPhone = document.getElementById('error-prof-phone');
  const btnSave = document.getElementById('btn-save-profile');

  if (errNama) errNama.classList.add('hidden');
  if (errNim) errNim.classList.add('hidden');
  if (errPhone) errPhone.classList.add('hidden');

  const formData = getProfileFormData();
  let hasError = false;

  if (!formData.nama) {
    if (errNama) errNama.classList.remove('hidden');
    hasError = true;
  }
  if (!validateNim(formData.nim)) {
    if (errNim) errNim.classList.remove('hidden');
    hasError = true;
  }
  if (!validateIndonesianPhone(formData.noHp)) {
    if (errPhone) errPhone.classList.remove('hidden');
    hasError = true;
  }
  if (!formData.fakultas || !formData.prodi) {
    showToast('warning', 'Fakultas & Prodi Wajib', 'Silakan pilih fakultas dan program studi Anda.');
    hasError = true;
  }

  if (hasError) return;

  setButtonLoading(btnSave, true, 'Menyimpan Profil...');

  try {
    const uid = state.currentUser.uid;
    let finalPhotoURL = formData.fotoURL;

    if (formData.fotoURL && formData.fotoURL.startsWith('data:image')) {
      try {
        const photoRef = ref(storage, `profile_photos/${uid}.jpg`);
        const blob = await (await fetch(formData.fotoURL)).blob();
        
        // Timeout 3.5 detik: jika Firebase Storage belum diaktifkan di console, langsung fallback ke base64 tanpa hang
        const uploadPromise = uploadBytes(photoRef, blob);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Storage timeout (bucket belum diaktifkan di Firebase Console)')), 3500)
        );

        await Promise.race([uploadPromise, timeoutPromise]);
        finalPhotoURL = await getDownloadURL(photoRef);
      } catch (storageErr) {
        console.warn('Firebase Storage tidak tersedia, menggunakan fallback base64 di Firestore:', storageErr?.message || storageErr);
      }
    }

    const updatedProfile = {
      ...formData,
      fotoURL: finalPhotoURL,
      uid: uid,
      profileComplete: true,
      updatedAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'students', uid), updatedProfile, { merge: true });

    state.studentProfile = updatedProfile;
    updateNavbarUserInfo();

    showToast('success', 'Profil Berhasil Disimpan', 'Identitas mahasiswa Anda telah diperbarui.');
    navigateTo('#/beranda');
  } catch (error) {
    console.error('Gagal menyimpan profil mahasiswa:', error);
    showToast('error', 'Gagal Menyimpan', 'Terjadi gangguan saat menyimpan ke database Firestore.');
  } finally {
    setButtonLoading(btnSave, false);
  }
}

function populateCourseSuggestions() {
  const datalist = document.getElementById('course-suggestions');
  if (!datalist) return;
  datalist.innerHTML = DEFAULT_COURSES.map(course => `<option value="${escapeHtml(course)}">`).join('');
}
