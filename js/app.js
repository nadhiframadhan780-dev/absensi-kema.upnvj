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
  orderBy,
  onSnapshot,
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
  generateCsvContent,
  generateDynamicQrPayload,
  validateDynamicQrPayload,
  validateLeaveSubmission,
  getFileCategory,
  formatLeaveStatusBadge,
  ALLOWED_LEAVE_EXTENSIONS,
  MAX_LEAVE_FILE_SIZE_BYTES
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
  leaveRequests: [],
  selectedLeaveFile: null,
  selectedLeaveType: 'Sakit',
  leaveHistoryFilter: 'all',
  isLeaveInitialized: false,
  unsubscribeLeave: null,
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
  initPengajuanEventListeners();
  initRouter();
  populateCourseSuggestions();
});

/**
 * Setup Event Listeners Global
 */
function setupGlobalEventListeners() {
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleLogout();
    });
  }

  const profileLogoutBtn = document.getElementById('btn-profile-logout');
  if (profileLogoutBtn) {
    profileLogoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleLogout();
    });
  }

  const dashLogoutBtn = document.getElementById('btn-dash-logout');
  if (dashLogoutBtn) {
    dashLogoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleLogout();
    });
  }

  const confirmCancel = document.getElementById('confirm-modal-cancel');
  const confirmOk = document.getElementById('confirm-modal-ok');
  if (confirmCancel) confirmCancel.addEventListener('click', () => closeConfirmModal(false));
  if (confirmOk) confirmOk.addEventListener('click', () => closeConfirmModal(true));

  const closeProofBtn = document.getElementById('btn-close-proof');
  if (closeProofBtn) closeProofBtn.addEventListener('click', closeProofModal);

  const closeLeaveModalBtn = document.getElementById('btn-close-student-leave-modal');
  const closeLeaveModalFooterBtn = document.getElementById('btn-close-leave-modal-footer');
  if (closeLeaveModalBtn) closeLeaveModalBtn.addEventListener('click', closeStudentLeaveModal);
  if (closeLeaveModalFooterBtn) closeLeaveModalFooterBtn.addEventListener('click', closeStudentLeaveModal);

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
      const complete = isProfileComplete();

      if (!complete && route !== '#/profil') {
        navigateTo('#/profil');
        showToast('info', 'Lengkapi Profil', 'Harap lengkapi profil mahasiswa Anda untuk membuka akses presensi.');
      } else if (complete) {
        // Jika profil sudah 100% lengkap, langsung arahkan ke Dashboard (Beranda)
        if (['#/', '', '#/login', '#/prodi'].includes(route)) {
          navigateTo('#/beranda');
        }
      }
    } else {
      state.studentProfile = null;
      state.attendanceList = [];
      state.leaveRequests = [];
      if (state.unsubscribeLeave) {
        state.unsubscribeLeave();
        state.unsubscribeLeave = null;
      }
      updateNavbarUserInfo();

      const protectedRoutes = ['#/beranda', '#/absensi', '#/pengajuan', '#/riwayat', '#/profil'];
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
  if (state.studentProfile.profileComplete === true) return true;
  return calculateProfileProgress(state.studentProfile) >= 100;
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
  const brandLink = document.querySelector('.brand-wrapper');

  const avatarImg = document.getElementById('nav-user-avatar');
  const initialDiv = document.getElementById('nav-user-initial');
  const nameEl = document.getElementById('nav-user-name');
  const nimEl = document.getElementById('nav-user-nim');

  if (state.currentUser && state.studentProfile) {
    if (brandLink) {
      brandLink.setAttribute('href', isProfileComplete() ? '#/beranda' : '#/profil');
    }
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
    if (brandLink) {
      brandLink.setAttribute('href', '#/');
    }
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

  // Jika sudah login dan profil sudah 100% lengkap, jika membuka landing, prodi, atau login, langsung arahkan ke Dashboard (Beranda)
  if (state.currentUser && isProfileComplete()) {
    if (['#/', '', '#/login', '#/prodi'].includes(cleanHash)) {
      navigateTo('#/beranda');
      return;
    }
  }

  const protectedRoutes = ['#/beranda', '#/absensi', '#/pengajuan', '#/riwayat', '#/profil'];
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

  if (cleanHash !== '#/absensi') {
    if (state.isScanning) stopCameraScanner();
    if (typeof stopDynamicQrRotation === 'function') stopDynamicQrRotation();
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
    '#/pengajuan': 'view-pengajuan',
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
    case '#/pengajuan':
      renderPengajuanView();
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
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await loadStudentProfile(userCredential.user.uid);
      updateNavbarUserInfo();

      if (isProfileComplete()) {
        showToast('success', 'Berhasil Masuk', 'Selamat datang kembali di Sistem Absensi UPNVJ.');
        navigateTo('#/beranda');
      } else {
        showToast('info', 'Lengkapi Profil', 'Harap lengkapi profil mahasiswa Anda.');
        navigateTo('#/profil');
      }
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

    await loadStudentProfile(user.uid);
    updateNavbarUserInfo();

    if (isProfileComplete()) {
      showToast('success', 'Login Berhasil', `Selamat datang kembali, ${user.displayName || 'Mahasiswa'}.`);
      navigateTo('#/beranda');
    } else {
      showToast('info', 'Lengkapi Profil', 'Harap lengkapi profil mahasiswa Anda.');
      navigateTo('#/profil');
    }
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
  try {
    if (state.unsubscribeLeave) {
      state.unsubscribeLeave();
      state.unsubscribeLeave = null;
    }
    if (state.isScanning) {
      stopCameraScanner();
    }
    if (typeof stopDynamicQrRotation === 'function') {
      stopDynamicQrRotation();
    }
    await signOut(auth);
  } catch (e) {
    console.warn('Peringatan saat signOut auth:', e);
  } finally {
    state.currentUser = null;
    state.studentProfile = null;
    state.attendanceList = [];
    state.leaveRequests = [];
    sessionStorage.removeItem('upnvj_selected_faculty');
    sessionStorage.removeItem('upnvj_selected_prodi');
    state.selectedFaculty = null;
    state.selectedProdi = null;
    updateNavbarUserInfo();
    showToast('info', 'Telah Keluar', 'Anda telah berhasil keluar dari akun Sistem Absensi.');
    navigateTo('#/login');
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
// State for Dynamic QR Code & Anti-Cheat Guards
let dynamicQrInterval = null;
let watermarkClockInterval = null;
let qrExpiresAt = 0;
let currentKtmFormat = 'qr'; // 'qr' or 'barcode'
let antiScreenshotGuardsInitialized = false;
let scanFilterMode = 'all'; // 'all', 'qr', 'barcode'

/**
 * 5. CONTROLLER: ABSENSI
 */
function renderAbsensiView() {
  if (!state.currentUser) return;
  const prof = state.studentProfile || {};

  // Tab 1: Scan vs Manual Tab Switcher
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
      if (currentKtmFormat === 'qr') {
        startDynamicQrRotation(prof);
      }
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
      stopDynamicQrRotation();
    };
  }

  // Setup Scanner Format Filters (Semua / Fokus QR / Fokus Barcode)
  setupScanFilterControls();

  // Render Student ID Card (KTM)
  renderDigitalKtm(prof);

  // Setup Camera Scanner Controls
  const btnStartScanner = document.getElementById('btn-start-scanner');
  const btnStopScanner = document.getElementById('btn-stop-scanner');
  const btnSwitchCamera = document.getElementById('btn-switch-camera');

  if (btnStartScanner) btnStartScanner.onclick = startCameraScanner;
  if (btnStopScanner) btnStopScanner.onclick = stopCameraScanner;
  if (btnSwitchCamera) btnSwitchCamera.onclick = switchCamera;

  // Setup Manual Attendance Form
  setupManualAttendanceForm(prof);

  // Setup Anti-Screenshot & Screen Capture Guards
  setupAntiScreenshotGuards(prof);

  // Download KTM Listener
  const btnDownloadKtm = document.getElementById('btn-download-ktm');
  if (btnDownloadKtm) btnDownloadKtm.onclick = downloadKtmImage;

  if (window.lucide) window.lucide.createIcons();
}

/**
 * Pengaturan Filter Mode Scanner Kamera (Otomatis / Fokus QR / Fokus Barcode)
 */
function setupScanFilterControls() {
  const btnAll = document.getElementById('btn-scan-filter-all');
  const btnQr = document.getElementById('btn-scan-filter-qr');
  const btnBarcode = document.getElementById('btn-scan-filter-barcode');

  const setFilterActive = (activeBtn, mode) => {
    [btnAll, btnQr, btnBarcode].forEach(b => {
      if (b) {
        b.style.background = 'transparent';
        b.style.color = '#475569';
        b.classList.remove('active');
      }
    });
    if (activeBtn) {
      activeBtn.style.background = '#0b2341';
      activeBtn.style.color = '#ffffff';
      activeBtn.classList.add('active');
    }
    scanFilterMode = mode;
  };

  if (btnAll) btnAll.onclick = () => setFilterActive(btnAll, 'all');
  if (btnQr) btnQr.onclick = () => setFilterActive(btnQr, 'qr');
  if (btnBarcode) btnBarcode.onclick = () => setFilterActive(btnBarcode, 'barcode');
}

/**
 * Render Kartu Mahasiswa (KTM) & Inisialisasi Tab QR Dinamis vs Barcode
 */
function renderDigitalKtm(profile) {
  const ktmNama = document.getElementById('ktm-nama');
  const ktmNim = document.getElementById('ktm-nim');
  const ktmProdi = document.getElementById('ktm-prodi');
  const ktmFakultas = document.getElementById('ktm-fakultas');
  const ktmBarcodeText = document.getElementById('ktm-barcode-nim-text');
  const ktmWatermarkNim = document.getElementById('ktm-watermark-nim');
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
  if (ktmWatermarkNim) ktmWatermarkNim.textContent = nim;

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

  // Setup Tab Switcher Format Kode (QR Code Dinamis vs Barcode 1D)
  initKtmFormatTabs(profile);
}

/**
 * Inisialisasi Tab Switcher Pilihan Format: QR Code Dinamis (2D) vs Barcode (1D)
 */
function initKtmFormatTabs(profile) {
  const tabQr = document.getElementById('tab-ktm-qr');
  const tabBarcode = document.getElementById('tab-ktm-barcode');
  const boxQr = document.getElementById('ktm-qr-box');
  const boxBarcode = document.getElementById('ktm-barcode-box');
  const btnDownload = document.getElementById('btn-download-ktm');
  const securityNotice = document.getElementById('ktm-qr-security-notice');
  const badgeMode = document.getElementById('ktm-badge-mode');

  const btnRefresh = document.getElementById('btn-refresh-qr-now');
  if (btnRefresh) {
    btnRefresh.onclick = () => {
      generateFreshStudentQr(profile);
      showToast('info', 'QR Code Diperbarui', 'Token presensi baru berdurasi 30 detik telah aktif.');
    };
  }

  const selectQrMode = () => {
    currentKtmFormat = 'qr';
    if (tabQr) {
      tabQr.style.background = '#0b2341';
      tabQr.style.color = '#ffffff';
      tabQr.classList.add('active');
    }
    if (tabBarcode) {
      tabBarcode.style.background = 'transparent';
      tabBarcode.style.color = '#475569';
      tabBarcode.classList.remove('active');
    }
    if (boxQr) boxQr.classList.remove('hidden');
    if (boxBarcode) boxBarcode.classList.add('hidden');
    if (btnDownload) btnDownload.classList.add('hidden');
    if (securityNotice) securityNotice.classList.remove('hidden');
    if (badgeMode) {
      badgeMode.textContent = 'QR 30S LIVE';
      badgeMode.style.background = 'rgba(245, 158, 11, 0.2)';
      badgeMode.style.color = '#fde68a';
      badgeMode.style.borderColor = '#fbbf24';
    }
    startDynamicQrRotation(profile);
  };

  const selectBarcodeMode = () => {
    currentKtmFormat = 'barcode';
    if (tabBarcode) {
      tabBarcode.style.background = '#0b2341';
      tabBarcode.style.color = '#ffffff';
      tabBarcode.classList.add('active');
    }
    if (tabQr) {
      tabQr.style.background = 'transparent';
      tabQr.style.color = '#475569';
      tabQr.classList.remove('active');
    }
    if (boxBarcode) boxBarcode.classList.remove('hidden');
    if (boxQr) boxQr.classList.add('hidden');
    if (btnDownload) btnDownload.classList.remove('hidden');
    if (securityNotice) securityNotice.classList.add('hidden');
    if (badgeMode) {
      badgeMode.textContent = 'BARCODE 1D';
      badgeMode.style.background = 'rgba(148, 163, 184, 0.2)';
      badgeMode.style.color = '#cbd5e1';
      badgeMode.style.borderColor = '#94a3b8';
    }

    stopDynamicQrRotation();

    // Render Barcode via JsBarcode
    try {
      if (window.JsBarcode) {
        const nim = profile.nim || '2110511001';
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
      console.warn("Gagal membuat barcode:", err);
    }
  };

  if (tabQr) tabQr.onclick = selectQrMode;
  if (tabBarcode) tabBarcode.onclick = selectBarcodeMode;

  // Jalankan mode awal (default QR Code Dinamis)
  if (currentKtmFormat === 'qr') {
    selectQrMode();
  } else {
    selectBarcodeMode();
  }
}

/**
 * Memulai Rotasi QR Code Mahasiswa Setiap 30 Detik (Anti Titip Absen)
 */
function startDynamicQrRotation(profile) {
  stopDynamicQrRotation();

  // Generate QR Code baru sekarang
  generateFreshStudentQr(profile);

  // Timer loop setiap 200ms untuk smooth countdown progress bar
  dynamicQrInterval = setInterval(() => {
    const now = Date.now();
    const remainingMs = Math.max(0, qrExpiresAt - now);
    const remainingSec = Math.ceil(remainingMs / 1000);

    const countdownEl = document.getElementById('ktm-qr-countdown');
    const fillEl = document.getElementById('ktm-qr-progress-fill');

    if (countdownEl) {
      countdownEl.textContent = `${remainingSec}s`;
      if (remainingSec <= 5) {
        countdownEl.style.color = '#ef4444';
      } else if (remainingSec <= 15) {
        countdownEl.style.color = '#f59e0b';
      } else {
        countdownEl.style.color = '#059669';
      }
    }

    if (fillEl) {
      const pct = (remainingMs / 30000) * 100;
      fillEl.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    }

    // Jika waktu 30 detik habis, perbarui otomatis dengan token baru
    if (remainingMs <= 0) {
      generateFreshStudentQr(profile);
    }
  }, 200);

  // Jam Realtime WIB Berpresisi Milidetik (Security Moving Watermark)
  const watermarkClock = document.getElementById('ktm-watermark-clock');
  watermarkClockInterval = setInterval(() => {
    if (watermarkClock) {
      const d = new Date();
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      const s = String(d.getSeconds()).padStart(2, '0');
      const ms = String(d.getMilliseconds()).padStart(3, '0');
      watermarkClock.textContent = `${h}:${m}:${s}.${ms}`;
    }
  }, 50);
}

/**
 * Hentikan interval QR Dinamis & Watermark Clock
 */
function stopDynamicQrRotation() {
  if (dynamicQrInterval) {
    clearInterval(dynamicQrInterval);
    dynamicQrInterval = null;
  }
  if (watermarkClockInterval) {
    clearInterval(watermarkClockInterval);
    watermarkClockInterval = null;
  }
}

/**
 * Generate Token & Gambar QR Code Dinamis Baru (Valid 30 Detik)
 */
function generateFreshStudentQr(profile) {
  const nim = profile.nim || '2110511001';
  const nama = profile.nama || 'Mahasiswa UPNVJ';

  const { payloadString, exp } = generateDynamicQrPayload(nim, nama, Date.now(), 30000);
  qrExpiresAt = exp;

  const container = document.getElementById('ktm-qr-canvas');
  if (!container) return;

  container.innerHTML = '';

  try {
    if (window.QRCode) {
      new window.QRCode(container, {
        text: payloadString,
        width: 195,
        height: 195,
        colorDark: '#0b2341',
        colorLight: '#ffffff',
        correctLevel: window.QRCode.CorrectLevel.M
      });
    }
  } catch (err) {
    console.warn("Gagal membuat QR code via QRCodejs:", err);
  }
}

/**
 * Proteksi Anti-Screenshot, Anti-Screen Recording, & Window Blur Detection
 * Mencegah titip absen menggunakan screenshot atau foto layar lama
 */
function setupAntiScreenshotGuards(profile) {
  if (antiScreenshotGuardsInitialized) return;
  antiScreenshotGuardsInitialized = true;

  const shieldEl = document.getElementById('ktm-screenshot-shield');

  const triggerShieldWarning = (reason = 'Tangkapan Layar Ditolak') => {
    if (!shieldEl) return;
    shieldEl.classList.remove('hidden');

    // Jika pengguna mencoba screenshot, seketika hanguskan token lama & buat baru
    if (currentKtmFormat === 'qr' && state.currentRoute === '#/absensi') {
      generateFreshStudentQr(state.studentProfile || {});
    }

    setTimeout(() => {
      shieldEl.classList.add('hidden');
    }, 2400);
  };

  // 1. Deteksi Tombol Screenshot Keyboard (PrintScreen, Win+Shift+S, Cmd+Shift+3/4, Ctrl+P)
  window.addEventListener('keyup', (e) => {
    if (e.key === 'PrintScreen') {
      triggerShieldWarning('Tombol PrintScreen Terdeteksi');
      showToast('warning', 'Tangkapan Layar Ditolak', 'QR Code dilindungi token 30 detik untuk mencegah titip absen.');
    }
  });

  window.addEventListener('keydown', (e) => {
    // Cegah pintasan cetak / Print to PDF
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      triggerShieldWarning('Pintasan Cetak Dokumen Dicegah');
      showToast('warning', 'Pencetakan Ditolak', 'KTM QR Code dinamis tidak dapat dicetak.');
      return false;
    }

    // Deteksi kombinasi Snipping Tool (Windows: Win+Shift+S, Mac: Cmd+Shift+3/4/5)
    if (e.shiftKey && (e.metaKey || e.ctrlKey)) {
      triggerShieldWarning('Perekam Layar / Snipping Terdeteksi');
    }
  });

  // 2. Deteksi Beralih Aplikasi / Tab Inaktif (Window Blur & Visibility Change)
  // Saat pengguna berpindah jendela untuk membuka alat screenshot, QR seketika ditutup
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (shieldEl) shieldEl.classList.remove('hidden');
    } else {
      if (shieldEl) shieldEl.classList.add('hidden');
      // Saat kembali aktif, buat token baru seketika!
      if (currentKtmFormat === 'qr' && state.currentRoute === '#/absensi') {
        generateFreshStudentQr(state.studentProfile || {});
      }
    }
  });

  window.addEventListener('blur', () => {
    if (currentKtmFormat === 'qr' && state.currentRoute === '#/absensi') {
      if (shieldEl) shieldEl.classList.remove('hidden');
    }
  });

  window.addEventListener('focus', () => {
    if (shieldEl) shieldEl.classList.add('hidden');
    if (currentKtmFormat === 'qr' && state.currentRoute === '#/absensi') {
      generateFreshStudentQr(state.studentProfile || {});
    }
  });

  // 3. Disable Drag & Drop pada Frame QR
  const qrFrameArea = document.getElementById('ktm-qr-frame-area');
  if (qrFrameArea) {
    qrFrameArea.addEventListener('contextmenu', (e) => e.preventDefault());
    qrFrameArea.addEventListener('dragstart', (e) => e.preventDefault());
  }
}

/**
 * Unduh Gambar KTM (Hanya Tersedia untuk Mode Barcode 1D Statis)
 */
function downloadKtmImage() {
  if (currentKtmFormat === 'qr') {
    showToast('warning', 'Unduh Dilarang', 'Demi keamanan & mencegah titip absen, QR Code Dinamis 30 detik tidak dapat diunduh sebagai gambar.');
    return;
  }

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
  ctx.fillText('KARTU TANDA MAHASISWA DIGITAL (BARCODE)', 30, 65);

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
  const rawText = (decodedText || '').trim();
  const matkulInput = document.getElementById('scan-matkul-input');
  let matkul = matkulInput ? matkulInput.value.trim() : 'Mata Kuliah';

  await stopCameraScanner();

  // 1. Cek jika data adalah Sesi QR Perkuliahan dari Dosen (UPNVJ_ATTENDANCE_SESSION)
  if (rawText.startsWith('{') && rawText.includes('UPNVJ_ATTENDANCE_SESSION')) {
    try {
      const sessionData = JSON.parse(rawText);
      const now = Date.now();
      if (sessionData.exp && now > Number(sessionData.exp)) {
        showToast('error', 'Sesi QR Kadaluwarsa', 'QR Code sesi perkuliahan telah berganti. Silakan scan QR terbaru di layar proyektor.');
        return;
      }

      if (scanFilterMode === 'barcode') {
        showToast('warning', 'Filter Barcode Aktif', 'Kamera mendeteksi QR Code Sesi Dosen. Ubah filter ke "Semua" atau "Fokus QR Code".');
        return;
      }

      const currentNim = state.studentProfile ? state.studentProfile.nim : '';
      if (!currentNim) {
        showToast('error', 'Profil Belum Lengkap', 'NIM mahasiswa tidak ditemukan pada sesi login saat ini.');
        return;
      }

      await recordAttendance({
        nim: currentNim,
        mataKuliah: sessionData.kodeMk || matkul,
        sesiId: sessionData.sessionId || null,
        metode: 'scan-qr-sesi'
      });
      return;
    } catch (e) {
      console.warn('Gagal memproses QR Sesi:', e);
    }
  }

  // 2. Validasi menggunakan validateDynamicQrPayload (Dukungan QR Dinamis 30s & Barcode 1D)
  const validation = validateDynamicQrPayload(rawText);

  // Filter mode enforcement
  if (scanFilterMode === 'qr' && validation.isBarcode1D) {
    showToast('warning', 'Fokus QR Code Aktif', 'Kode yang terbaca adalah Barcode 1D. Silakan arahkan ke QR Code.');
    return;
  }
  if (scanFilterMode === 'barcode' && validation.isDynamicQr) {
    showToast('warning', 'Fokus Barcode Aktif', 'Kode yang terbaca adalah QR Code. Silakan arahkan ke Barcode 1D.');
    return;
  }

  // Jika QR Code Dinamis Kadaluwarsa (>30 detik / screenshot lama)
  if (!validation.valid) {
    if (validation.isExpired) {
      showToast('error', 'Absen Titipan Ditolak!', validation.reason);
    } else {
      showToast('error', 'Kode Tidak Dikenali', validation.reason);
    }
    return;
  }

  const scannedNim = validation.nim;
  const currentNim = state.studentProfile ? state.studentProfile.nim : '';
  if (currentNim && scannedNim !== currentNim) {
    showToast('warning', 'NIM Tidak Cocok', `Kode milik NIM ${scannedNim}, sedangkan Anda masuk sebagai NIM ${currentNim}.`);
    return;
  }

  await recordAttendance({
    nim: scannedNim,
    mataKuliah: matkul,
    metode: validation.isDynamicQr ? 'scan-qr-dinamis' : 'scan-barcode'
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

/**
 * ============================================================================
 * 8. CONTROLLER: PENGAJUAN SURAT SAKIT, IZIN, & DISPENSASI MAHASISWA
 * ============================================================================
 */
function renderPengajuanView() {
  initPengajuanEventListeners();
  setDefaultLeaveDates();
  listenStudentLeaveRequests();
}

/**
 * Inisialisasi event listener formulir pengajuan & tab
 */
function initPengajuanEventListeners() {
  if (state.isLeaveInitialized) return;
  state.isLeaveInitialized = true;

  // 1. Selector Jenis Pengajuan (Radio Card)
  document.querySelectorAll('.leave-type-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.leave-type-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      state.selectedLeaveType = card.dataset.type || 'Sakit';
    });
  });

  // 2. Tab Navigation (Form vs History)
  const tabBtnForm = document.getElementById('tab-btn-leave-form');
  const tabBtnHistory = document.getElementById('tab-btn-leave-history');
  const panelForm = document.getElementById('leave-tab-content-form');
  const panelHistory = document.getElementById('leave-tab-content-history');

  if (tabBtnForm && tabBtnHistory && panelForm && panelHistory) {
    tabBtnForm.addEventListener('click', () => {
      tabBtnForm.classList.add('active');
      tabBtnHistory.classList.remove('active');
      panelForm.classList.remove('hidden');
      panelHistory.classList.add('hidden');
    });

    tabBtnHistory.addEventListener('click', () => {
      tabBtnHistory.classList.add('active');
      tabBtnForm.classList.remove('active');
      panelHistory.classList.remove('hidden');
      panelForm.classList.add('hidden');
      renderLeaveHistoryList();
    });
  }

  // 3. Toggle "Hanya 1 Hari Perkuliahan"
  const checkOneDay = document.getElementById('leave-check-oneday');
  const endDateWrapper = document.getElementById('leave-end-date-wrapper');
  const startDateInput = document.getElementById('leave-input-start-date');
  const endDateInput = document.getElementById('leave-input-end-date');

  if (checkOneDay && endDateWrapper && startDateInput && endDateInput) {
    checkOneDay.addEventListener('change', () => {
      if (checkOneDay.checked) {
        endDateWrapper.style.opacity = '0.5';
        endDateWrapper.style.pointerEvents = 'none';
        endDateInput.value = startDateInput.value;
      } else {
        endDateWrapper.style.opacity = '1';
        endDateWrapper.style.pointerEvents = 'auto';
        if (!endDateInput.value) {
          endDateInput.value = startDateInput.value;
        }
      }
    });

    startDateInput.addEventListener('change', () => {
      if (checkOneDay.checked) {
        endDateInput.value = startDateInput.value;
      }
      if (endDateInput.value && endDateInput.value < startDateInput.value) {
        endDateInput.value = startDateInput.value;
      }
    });
  }

  // 4. Character Counter Alasan
  const reasonTextarea = document.getElementById('leave-input-reason');
  const reasonCountEl = document.getElementById('leave-reason-count');
  const reasonError = document.getElementById('error-leave-reason');

  if (reasonTextarea && reasonCountEl) {
    reasonTextarea.addEventListener('input', () => {
      const len = reasonTextarea.value.length;
      reasonCountEl.textContent = `${len} / 500 karakter (min. 10)`;
      if (len >= 10) {
        reasonCountEl.style.color = '#059669';
        if (reasonError) reasonError.classList.add('hidden');
      } else {
        reasonCountEl.style.color = '#64748b';
      }
    });
  }

  // 5. Berkas Bukti: Dropzone & File Input
  const fileInput = document.getElementById('leave-file-input');
  const dropzone = document.getElementById('leave-dropzone');
  const btnBrowse = document.getElementById('btn-browse-leave-file');
  const btnRemoveFile = document.getElementById('btn-remove-leave-file');

  if (btnBrowse && fileInput) {
    btnBrowse.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });
  }

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', (e) => {
      if (e.target.closest('#btn-remove-leave-file') || e.target.closest('#leave-file-preview-box')) return;
      fileInput.click();
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('drag-active');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('drag-active');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files[0]) {
        handleLeaveFileSelection(dt.files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        handleLeaveFileSelection(fileInput.files[0]);
      }
    });
  }

  if (btnRemoveFile) {
    btnRemoveFile.addEventListener('click', (e) => {
      e.stopPropagation();
      resetLeaveFileInput();
    });
  }

  // 6. Reset Form Button
  const btnReset = document.getElementById('btn-reset-leave-form');
  if (btnReset) {
    btnReset.addEventListener('click', resetLeaveForm);
  }

  // 7. Filter Riwayat Pengajuan
  document.querySelectorAll('.btn-filter-history').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-filter-history').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.leaveHistoryFilter = btn.dataset.filter || 'all';
      renderLeaveHistoryList();
    });
  });

  // 8. Submit Handler
  const form = document.getElementById('form-leave-request');
  if (form) {
    form.addEventListener('submit', handleLeaveFormSubmit);
  }
}

/**
 * Atur tanggal awal default ke hari ini
 */
function setDefaultLeaveDates() {
  const startDateInput = document.getElementById('leave-input-start-date');
  const endDateInput = document.getElementById('leave-input-end-date');
  if (startDateInput && !startDateInput.value) {
    const today = new Date().toISOString().split('T')[0];
    startDateInput.value = today;
    if (endDateInput && !endDateInput.value) {
      endDateInput.value = today;
    }
  }
}

/**
 * Handle seleksi berkas bukti dari input atau drag-and-drop
 */
function handleLeaveFileSelection(file) {
  if (!file) return;

  const fileName = file.name;
  const fileSize = file.size;
  const mimeType = file.type;
  const ext = (fileName.split('.').pop() || '').toLowerCase();

  const fileError = document.getElementById('error-leave-file');

  if (!ALLOWED_LEAVE_EXTENSIONS.includes(ext)) {
    if (fileError) {
      fileError.textContent = `Format berkas .${ext} tidak didukung. Harap unggah dokumen PDF, Word (.doc, .docx), atau Gambar (JPG, PNG, WEBP).`;
      fileError.classList.remove('hidden');
    }
    showToast('warning', 'Format Berkas Ditolak', `Format .${ext} tidak diizinkan. Gunakan PDF, Word, atau Gambar.`);
    resetLeaveFileInput();
    return;
  }

  if (fileSize > MAX_LEAVE_FILE_SIZE_BYTES) {
    const sizeMb = (fileSize / (1024 * 1024)).toFixed(1);
    if (fileError) {
      fileError.textContent = `Ukuran berkas (${sizeMb} MB) melebihi batas 10 MB.`;
      fileError.classList.remove('hidden');
    }
    showToast('warning', 'Ukuran Terlalu Besar', `Maksimal ukuran berkas adalah 10 MB (berkas Anda: ${sizeMb} MB).`);
    resetLeaveFileInput();
    return;
  }

  if (fileError) fileError.classList.add('hidden');
  state.selectedLeaveFile = file;

  // Perbarui UI preview box
  const promptBox = document.getElementById('leave-dropzone-prompt');
  const previewBox = document.getElementById('leave-file-preview-box');
  const fileNameEl = document.getElementById('preview-file-name');
  const fileSizeEl = document.getElementById('preview-file-size');
  const fileBadgeEl = document.getElementById('preview-file-badge');
  const genericIcon = document.getElementById('preview-generic-icon');
  const imageElement = document.getElementById('preview-image-element');

  if (promptBox) promptBox.classList.add('hidden');
  if (previewBox) previewBox.classList.remove('hidden');

  if (fileNameEl) fileNameEl.textContent = fileName;
  if (fileSizeEl) fileSizeEl.textContent = formatBytes(fileSize);

  const category = getFileCategory(fileName, mimeType);

  if (fileBadgeEl) {
    if (category === 'pdf') {
      fileBadgeEl.textContent = 'Dokumen PDF';
      fileBadgeEl.style.background = '#fee2e2';
      fileBadgeEl.style.color = '#dc2626';
    } else if (category === 'word') {
      fileBadgeEl.textContent = 'Dokumen Word';
      fileBadgeEl.style.background = '#dbeafe';
      fileBadgeEl.style.color = '#2563eb';
    } else {
      fileBadgeEl.textContent = 'Foto (Kompresi Otomatis Aktif)';
      fileBadgeEl.style.background = '#d1fae5';
      fileBadgeEl.style.color = '#059669';
    }
  }

  if (category === 'image') {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (imageElement) {
        imageElement.src = e.target.result;
        imageElement.classList.remove('hidden');
      }
      if (genericIcon) genericIcon.classList.add('hidden');
    };
    reader.readAsDataURL(file);
  } else {
    if (imageElement) imageElement.classList.add('hidden');
    if (genericIcon) {
      genericIcon.classList.remove('hidden');
      if (category === 'pdf') {
        genericIcon.setAttribute('data-lucide', 'file-text');
        genericIcon.style.color = '#dc2626';
      } else if (category === 'word') {
        genericIcon.setAttribute('data-lucide', 'file-check');
        genericIcon.style.color = '#2563eb';
      } else {
        genericIcon.setAttribute('data-lucide', 'file');
        genericIcon.style.color = '#475569';
      }
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

function resetLeaveFileInput() {
  state.selectedLeaveFile = null;
  const fileInput = document.getElementById('leave-file-input');
  if (fileInput) fileInput.value = '';

  const promptBox = document.getElementById('leave-dropzone-prompt');
  const previewBox = document.getElementById('leave-file-preview-box');
  const imageElement = document.getElementById('preview-image-element');
  const genericIcon = document.getElementById('preview-generic-icon');

  if (promptBox) promptBox.classList.remove('hidden');
  if (previewBox) previewBox.classList.add('hidden');
  if (imageElement) {
    imageElement.src = '';
    imageElement.classList.add('hidden');
  }
  if (genericIcon) genericIcon.classList.remove('hidden');
}

function resetLeaveForm() {
  const form = document.getElementById('form-leave-request');
  if (form) form.reset();

  state.selectedLeaveType = 'Sakit';
  document.querySelectorAll('.leave-type-card').forEach(c => {
    if (c.dataset.type === 'Sakit') c.classList.add('selected');
    else c.classList.remove('selected');
  });

  const checkOneDay = document.getElementById('leave-check-oneday');
  if (checkOneDay) checkOneDay.checked = true;

  const endDateWrapper = document.getElementById('leave-end-date-wrapper');
  if (endDateWrapper) {
    endDateWrapper.style.opacity = '0.5';
    endDateWrapper.style.pointerEvents = 'none';
  }

  const reasonCountEl = document.getElementById('leave-reason-count');
  if (reasonCountEl) reasonCountEl.textContent = '0 / 500 karakter (min. 10)';

  resetLeaveFileInput();
  setDefaultLeaveDates();
}

/**
 * Handle pengiriman formulir pengajuan surat izin / sakit / dispensasi
 */
async function handleLeaveFormSubmit(e) {
  e.preventDefault();

  if (!state.currentUser) {
    showToast('warning', 'Wajib Masuk', 'Silakan masuk dengan akun mahasiswa UPNVJ Anda terlebih dahulu.');
    navigateTo('#/login');
    return;
  }

  const jenis = state.selectedLeaveType || 'Sakit';
  const matkulInput = document.getElementById('leave-input-matkul');
  const dosenInput = document.getElementById('leave-input-dosen');
  const startDateInput = document.getElementById('leave-input-start-date');
  const endDateInput = document.getElementById('leave-input-end-date');
  const reasonInput = document.getElementById('leave-input-reason');
  const statementCheck = document.getElementById('leave-check-statement');
  const oneDayCheck = document.getElementById('leave-check-oneday');
  const btnSubmit = document.getElementById('btn-submit-leave');

  const mataKuliah = matkulInput ? matkulInput.value.trim() : '';
  const dosen = dosenInput ? dosenInput.value.trim() : '';
  const tanggalMulai = startDateInput ? startDateInput.value : '';
  const tanggalSelesai = (oneDayCheck && oneDayCheck.checked) ? tanggalMulai : (endDateInput ? endDateInput.value : tanggalMulai);
  const alasan = reasonInput ? reasonInput.value.trim() : '';

  // 1. Validasi via Pure Logic Helper
  const validation = validateLeaveSubmission({
    jenis,
    mataKuliah,
    tanggalMulai,
    tanggalSelesai,
    alasan,
    fileName: state.selectedLeaveFile ? state.selectedLeaveFile.name : '',
    fileSize: state.selectedLeaveFile ? state.selectedLeaveFile.size : 0,
    fileMimeType: state.selectedLeaveFile ? state.selectedLeaveFile.type : ''
  });

  if (!validation.valid) {
    showToast('warning', 'Validasi Pengajuan', validation.error);
    if (!state.selectedLeaveFile) {
      const fileError = document.getElementById('error-leave-file');
      if (fileError) fileError.classList.remove('hidden');
    }
    return;
  }

  // 2. Validasi Pernyataan Kejujuran
  if (!statementCheck || !statementCheck.checked) {
    showToast('warning', 'Persetujuan Wajib', 'Anda wajib menyetujui pernyataan integritas akademik sebelum mengirim.');
    return;
  }

  setButtonLoading(btnSubmit, true, 'Memproses & Menyimpan...');

  try {
    const file = state.selectedLeaveFile;

    // 3. Unggah Berkas Bukti dengan Proteksi Timeout & Kompresi Otomatis (Anti-Hang)
    const attachment = await prepareLeaveFileAttachment(file, validation.fileCategory);

    // 4. Siapkan Data Dokumen Koleksi `leaveRequests` di Firestore
    const studentNim = state.studentProfile?.nim || 
      (state.currentUser?.email ? state.currentUser.email.split('@')[0] : '') || 
      '-';

    const leaveDocData = {
      uid: state.currentUser.uid,
      nim: studentNim,
      nama: state.studentProfile?.nama || state.currentUser.displayName || 'Mahasiswa UPNVJ',
      fakultas: state.studentProfile?.fakultas || state.selectedFaculty || 'UPNVJ',
      prodi: state.studentProfile?.prodi || state.selectedProdi || 'Program Studi',
      jenis: validation.normalizedJenis,
      mataKuliah: mataKuliah,
      dosen: dosen || '',
      tanggalMulai: tanggalMulai,
      tanggalSelesai: tanggalSelesai || tanggalMulai,
      alasan: alasan,
      lampiran: attachment.url,
      lampiranNama: file.name,
      lampiranTipe: file.type || 'application/octet-stream',
      lampiranUkuran: attachment.size || file.size,
      lampiranKategori: validation.fileCategory,
      status: 'Menunggu',
      catatanAdmin: '',
      diprosesOleh: '',
      createdAt: new Date().toISOString()
    };

    // 5. Simpan ke Firestore dengan Timeout Proteksi 7 Detik
    const addPromise = addDoc(collection(db, 'leaveRequests'), leaveDocData);
    const firestoreTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Koneksi ke Firestore terputus atau timeout. Mohon periksa internet Anda.')), 7000)
    );

    await Promise.race([addPromise, firestoreTimeout]);

    showToast(
      'success',
      'Pengajuan Surat Berhasil Dikirim!',
      `Permohonan Surat ${validation.normalizedJenis} Anda berhasil disimpan dan langsung masuk ke antrean verifikasi.`
    );

    resetLeaveForm();

    // Otomatis beralih ke Tab Riwayat agar mahasiswa dapat langsung memantau status
    const tabBtnHistory = document.getElementById('tab-btn-leave-history');
    if (tabBtnHistory) {
      tabBtnHistory.click();
    }
  } catch (err) {
    console.error('Gagal mengirim pengajuan surat:', err);
    showToast('error', 'Gagal Mengirim Pengajuan', err.message || 'Terjadi kesalahan sistem saat menyimpan ke server.');
  } finally {
    setButtonLoading(btnSubmit, false);
  }
}

/**
 * Realtime Listener Pengajuan Surat Milik Mahasiswa yang Sedang Login
 */
function listenStudentLeaveRequests() {
  if (!state.currentUser) return;
  if (state.unsubscribeLeave) return; // Sudah mendengarkan

  try {
    const q = query(
      collection(db, 'leaveRequests'),
      where('uid', '==', state.currentUser.uid)
    );

    state.unsubscribeLeave = onSnapshot(q, (snapshot) => {
      const items = [];
      snapshot.forEach(docSnap => {
        items.push({ id: docSnap.id, ...docSnap.data() });
      });

      // Urutkan berdasarkan waktu pengajuan terbaru
      items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      state.leaveRequests = items;

      // Update badge jumlah di tab
      const badgeCount = document.getElementById('badge-leave-history-count');
      const totalCountEl = document.getElementById('history-total-count');
      if (badgeCount) {
        badgeCount.textContent = items.length;
        badgeCount.style.display = items.length > 0 ? 'inline-block' : 'none';
      }
      if (totalCountEl) {
        totalCountEl.textContent = items.length;
      }

      renderLeaveHistoryList();
    }, (error) => {
      console.warn('Gagal memantau pengajuan surat realtime:', error);
    });
  } catch (err) {
    console.warn('Inisialisasi listener surat izin:', err);
  }
}

/**
 * Render Kartu Riwayat Pengajuan Surat Mahasiswa
 */
function renderLeaveHistoryList() {
  const container = document.getElementById('leave-history-list');
  if (!container) return;

  const filter = state.leaveHistoryFilter || 'all';
  const list = state.leaveRequests.filter(item => {
    if (filter === 'all') return true;
    return (item.status || 'Menunggu').toLowerCase() === filter.toLowerCase();
  });

  if (list.length === 0) {
    container.innerHTML = `
      <div class="card-portal" style="padding: 48px 24px; text-align: center; background: #ffffff; box-shadow: var(--shadow-sm);">
        <div style="width: 56px; height: 56px; border-radius: 9999px; background: #f1f5f9; color: #94a3b8; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px;">
          <i data-lucide="inbox" style="width: 28px; height: 28px;"></i>
        </div>
        <h3 style="font-size: 16px; font-weight: 800; color: #0b2341; margin: 0 0 6px 0;">Belum Ada Pengajuan Surat</h3>
        <p style="font-size: 13px; color: #64748b; max-width: 420px; margin: 0 auto 20px;">
          ${filter === 'all' 
            ? 'Anda belum pernah mengirim pengajuan surat sakit, izin, atau dispensasi perkuliahan.' 
            : `Tidak ada permohonan dengan status "${filter}".`}
        </p>
        <button type="button" id="btn-goto-create-leave" class="btn-primary-block" style="width: auto; padding: 10px 22px; margin: 0 auto; display: inline-flex;">
          <i data-lucide="plus-circle" style="width: 15px; height: 15px;"></i>
          <span>Buat Pengajuan Baru</span>
        </button>
      </div>
    `;

    const gotoBtn = document.getElementById('btn-goto-create-leave');
    if (gotoBtn) {
      gotoBtn.addEventListener('click', () => {
        const tabBtnForm = document.getElementById('tab-btn-leave-form');
        if (tabBtnForm) tabBtnForm.click();
      });
    }

    if (window.lucide) window.lucide.createIcons();
    return;
  }

  container.innerHTML = list.map(item => {
    const badge = formatLeaveStatusBadge(item.status);
    const dateFormatted = formatWibTime(item.createdAt);
    const dateRange = item.tanggalMulai === item.tanggalSelesai 
      ? item.tanggalMulai 
      : `${item.tanggalMulai} s/d ${item.tanggalSelesai}`;

    const jenisClass = item.jenis === 'Sakit' 
      ? 'badge-leave-sakit' 
      : (item.jenis === 'Dispensasi' ? 'badge-leave-dispensasi' : 'badge-leave-izin');

    const ext = (item.lampiranNama?.split('.').pop() || '').toUpperCase();

    return `
      <div class="leave-history-card">
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="file-chip ${jenisClass}">
              ${escapeHtml(item.jenis)}
            </span>
            <span style="font-size: 11.5px; font-weight: 700; color: ${badge.color}; background: ${badge.bg}; border: 1px solid ${badge.borderColor}; padding: 3px 10px; border-radius: 9999px;">
              <i data-lucide="${badge.icon}" style="width: 11px; height: 11px; vertical-align: middle;"></i> ${badge.text}
            </span>
          </div>

          <div style="font-size: 12px; color: #64748b; font-weight: 500;">
            ${dateFormatted}
          </div>
        </div>

        <div style="margin-bottom: 12px;">
          <div style="font-size: 15.5px; font-weight: 800; color: #0b2341;">
            ${escapeHtml(item.mataKuliah || 'Semua Mata Kuliah')}
          </div>
          <div style="font-size: 12.5px; color: #475569; margin-top: 3px; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="calendar" style="width: 13px; height: 13px; color: #0284c7;"></i>
            <span>Jadwal Izin: <strong>${escapeHtml(dateRange)}</strong></span>
          </div>
        </div>

        <div style="padding: 10px 14px; background: #f8fafc; border-radius: 10px; font-size: 13px; color: #334155; margin-bottom: 14px; line-height: 1.5; border-left: 3px solid #cbd5e1;">
          ${escapeHtml(item.alasan)}
        </div>

        ${item.catatanAdmin ? `
          <div style="margin-bottom: 14px; padding: 10px 14px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; font-size: 12px; color: #166534;">
            <strong>Catatan Petugas:</strong> ${escapeHtml(item.catatanAdmin)} ${item.diprosesOleh ? `(${escapeHtml(item.diprosesOleh)})` : ''}
          </div>
        ` : ''}

        <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #f1f5f9; padding-top: 14px; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #64748b;">
            <i data-lucide="paperclip" style="width: 14px; height: 14px; color: #0b2341;"></i>
            <span style="font-weight: 600; color: #0b2341; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${escapeHtml(item.lampiranNama || 'Bukti Dokumen')}
            </span>
            <span style="font-size: 10.5px; font-weight: 800; background: #e2e8f0; color: #334155; padding: 1px 6px; border-radius: 4px;">
              ${escapeHtml(ext || 'FILE')}
            </span>
          </div>

          <button type="button" class="btn-view-leave-detail" data-id="${item.id}" style="padding: 8px 16px; border-radius: 10px; font-size: 12.5px; font-weight: 700; color: #0b2341; background: #f1f5f9; border: 1px solid #cbd5e1; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;">
            <i data-lucide="eye" style="width: 14px; height: 14px;"></i>
            <span>Lihat Bukti & Detail</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-view-leave-detail').forEach(btn => {
    btn.addEventListener('click', () => {
      openStudentLeaveModal(btn.dataset.id);
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

/**
 * Buka Modal Pratinjau Bukti Dokumen & Detail Pengajuan Mahasiswa
 */
function openStudentLeaveModal(leaveId) {
  const item = state.leaveRequests.find(l => l.id === leaveId);
  if (!item) return;

  const modal = document.getElementById('student-leave-modal');
  const modalTypeBadge = document.getElementById('modal-leave-type-badge');
  const modalCreated = document.getElementById('modal-leave-created');
  const modalBody = document.getElementById('student-leave-modal-body');

  if (!modal || !modalBody) return;

  const badge = formatLeaveStatusBadge(item.status);

  if (modalTypeBadge) {
    modalTypeBadge.textContent = `Surat ${item.jenis}`;
    if (item.jenis === 'Sakit') {
      modalTypeBadge.style.background = '#fee2e2';
      modalTypeBadge.style.color = '#dc2626';
    } else if (item.jenis === 'Dispensasi') {
      modalTypeBadge.style.background = '#f3e8ff';
      modalTypeBadge.style.color = '#7c3aed';
    } else {
      modalTypeBadge.style.background = '#e0f2fe';
      modalTypeBadge.style.color = '#0284c7';
    }
  }

  if (modalCreated) {
    modalCreated.textContent = `Diajukan pada: ${formatWibTime(item.createdAt)}`;
  }

  const dateRange = item.tanggalMulai === item.tanggalSelesai 
    ? item.tanggalMulai 
    : `${item.tanggalMulai} s/d ${item.tanggalSelesai}`;

  // Render attachment viewer according to file type
  let attachmentHtml = '';
  const fileName = item.lampiranNama || 'Dokumen_Bukti';
  const mime = (item.lampiranTipe || '').toLowerCase();
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const isPdf = ext === 'pdf' || mime === 'application/pdf' || (item.lampiran && item.lampiran.startsWith('data:application/pdf'));
  const isWord = ['doc', 'docx'].includes(ext) || mime.includes('word') || mime.includes('officedocument');
  const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) || mime.startsWith('image/') || (item.lampiran && item.lampiran.startsWith('data:image/'));

  if (isImage) {
    attachmentHtml = `
      <div style="border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; background: #0b1523; text-align: center; margin-top: 10px;">
        <img src="${item.lampiran}" alt="Bukti Surat ${escapeHtml(item.jenis)}" style="max-width: 100%; max-height: 360px; object-fit: contain; margin: 0 auto; display: block;" />
      </div>
      <div style="margin-top: 10px; display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size: 12px; color: #64748b;">
          <i data-lucide="image" style="width: 13px; height: 13px; vertical-align: middle;"></i> ${escapeHtml(fileName)}
        </span>
        <a href="${item.lampiran}" target="_blank" download="${escapeHtml(fileName)}" class="text-link-btn" style="font-size: 12.5px;">
          Buka Ukuran Penuh ↗
        </a>
      </div>
    `;
  } else if (isPdf) {
    attachmentHtml = `
      <div style="padding: 18px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; margin-top: 10px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 48px; height: 48px; border-radius: 12px; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i data-lucide="file-text" style="width: 26px; height: 26px;"></i>
          </div>
          <div style="min-width: 0; flex: 1;">
            <div style="font-weight: 700; color: #0b2341; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${escapeHtml(fileName)}
            </div>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
              Dokumen Resmi Format PDF
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 14px;">
          <a href="${item.lampiran}" target="_blank" class="btn-primary-block" style="flex: 1; padding: 10px; text-decoration: none; font-size: 13px;">
            <i data-lucide="eye" style="width: 14px; height: 14px;"></i>
            <span>Buka / Pratinjau PDF</span>
          </a>
          <a href="${item.lampiran}" download="${escapeHtml(fileName)}" style="padding: 10px 18px; border-radius: 12px; background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; font-weight: 700; font-size: 13px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
            <i data-lucide="download" style="width: 14px; height: 14px;"></i>
            <span>Unduh</span>
          </a>
        </div>
      </div>
    `;
  } else if (isWord) {
    attachmentHtml = `
      <div style="padding: 18px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; margin-top: 10px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 48px; height: 48px; border-radius: 12px; background: #dbeafe; color: #2563eb; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i data-lucide="file-check" style="width: 26px; height: 26px;"></i>
          </div>
          <div style="min-width: 0; flex: 1;">
            <div style="font-weight: 700; color: #0b2341; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${escapeHtml(fileName)}
            </div>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
              Dokumen Microsoft Word (.${ext})
            </div>
          </div>
        </div>
        <div style="margin-top: 14px;">
          <a href="${item.lampiran}" download="${escapeHtml(fileName)}" class="btn-primary-block" style="padding: 10px; text-decoration: none; font-size: 13px;">
            <i data-lucide="download" style="width: 14px; height: 14px;"></i>
            <span>Unduh Dokumen Word</span>
          </a>
        </div>
      </div>
    `;
  } else {
    attachmentHtml = `
      <div style="padding: 18px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; margin-top: 10px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 48px; height: 48px; border-radius: 12px; background: #f1f5f9; color: #475569; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i data-lucide="file" style="width: 26px; height: 26px;"></i>
          </div>
          <div style="min-width: 0; flex: 1;">
            <div style="font-weight: 700; color: #0b2341; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${escapeHtml(fileName)}
            </div>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
              Berkas Lampiran (${escapeHtml(ext.toUpperCase())})
            </div>
          </div>
        </div>
        <div style="margin-top: 14px;">
          <a href="${item.lampiran}" download="${escapeHtml(fileName)}" class="btn-primary-block" style="padding: 10px; text-decoration: none; font-size: 13px;">
            <i data-lucide="download" style="width: 14px; height: 14px;"></i>
            <span>Unduh Berkas Lampiran</span>
          </a>
        </div>
      </div>
    `;
  }

  modalBody.innerHTML = `
    <!-- Status Banner -->
    <div style="padding: 12px 16px; border-radius: 12px; background: ${badge.bg}; border: 1px solid ${badge.borderColor}; color: ${badge.color}; display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
      <div style="display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 13.5px;">
        <i data-lucide="${badge.icon}" style="width: 16px; height: 16px;"></i>
        <span>Status: ${badge.text}</span>
      </div>
      <span style="font-size: 11.5px; opacity: 0.9;">Sistem Presensi SIAKAD</span>
    </div>

    <!-- Metadata Grid -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px; font-size: 13px;">
      <div style="background: #f8fafc; padding: 10px 14px; border-radius: 10px; border: 1px solid #e2e8f0;">
        <span style="display: block; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Mata Kuliah:</span>
        <strong style="color: #0b2341;">${escapeHtml(item.mataKuliah || '-')}</strong>
      </div>
      <div style="background: #f8fafc; padding: 10px 14px; border-radius: 10px; border: 1px solid #e2e8f0;">
        <span style="display: block; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Rentang Tanggal:</span>
        <strong style="color: #0b2341;">${escapeHtml(dateRange)}</strong>
      </div>
      <div style="background: #f8fafc; padding: 10px 14px; border-radius: 10px; border: 1px solid #e2e8f0;">
        <span style="display: block; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">NIM Mahasiswa:</span>
        <strong style="color: #0b2341;">${escapeHtml(item.nim || '-')}</strong>
      </div>
      <div style="background: #f8fafc; padding: 10px 14px; border-radius: 10px; border: 1px solid #e2e8f0;">
        <span style="display: block; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Program Studi:</span>
        <strong style="color: #0b2341;">${escapeHtml(item.prodi || '-')}</strong>
      </div>
    </div>

    <!-- Alasan Pengajuan -->
    <div style="margin-bottom: 20px;">
      <label style="display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 6px;">
        Alasan / Keterangan Ketidakhadiran:
      </label>
      <div style="padding: 14px; background: #f8fafc; border-radius: 12px; font-size: 13.5px; color: #334155; line-height: 1.55; white-space: pre-wrap; border: 1px solid #e2e8f0;">
        ${escapeHtml(item.alasan)}
      </div>
    </div>

    ${item.catatanAdmin ? `
      <!-- Catatan Admin -->
      <div style="margin-bottom: 20px; padding: 14px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; font-size: 13px; color: #78350f;">
        <strong style="display: block; margin-bottom: 4px;">Catatan Dosen / Verifikator:</strong>
        <p style="margin: 0; line-height: 1.45;">${escapeHtml(item.catatanAdmin)}</p>
        ${item.diprosesOleh ? `<div style="font-size: 11px; margin-top: 6px; opacity: 0.8;">Diverifikasi oleh: ${escapeHtml(item.diprosesOleh)}</div>` : ''}
      </div>
    ` : ''}

    <!-- Dokumen Lampiran -->
    <div>
      <label style="display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 4px;">
        Dokumen Bukti yang Dilampirkan:
      </label>
      ${attachmentHtml}
    </div>
  `;

  modal.classList.remove('hidden');
  modal.style.display = 'flex';

  if (window.lucide) window.lucide.createIcons();
}

function closeStudentLeaveModal() {
  const modal = document.getElementById('student-leave-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

/**
 * Format bytes menjadi teks ramah (KB, MB)
 */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 KB';
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

/**
 * Konversi berkas menjadi Data URL string (Base64)
 */
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Kompresi berkas gambar dokumen/surat via Canvas agar selalu di bawah 250 KB
 */
function compressImageFile(file, maxWidth = 1200, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Gagal memproses gambar bukti'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar'));
    reader.readAsDataURL(file);
  });
}

/**
 * Persiapan Berkas Unggahan Bebas Hang (Anti-Loading Doang)
 * 1. Gambar dikompresi instan via canvas (<250 KB)
 * 2. Coba upload Storage dengan timeout super ketat (2000ms)
 * 3. Fallback instan ke Firestore-safe data URL tanpa membuat pengguna menunggu
 */
async function prepareLeaveFileAttachment(file, category) {
  let compressedDataUrl = '';
  let processedBlob = file;

  // Jika berkas adalah gambar, lakukan kompresi instan
  if (category === 'image' || (file.type && file.type.startsWith('image/'))) {
    compressedDataUrl = await compressImageFile(file, 1200, 0.72);
    try {
      processedBlob = await (await fetch(compressedDataUrl)).blob();
    } catch (_) {
      processedBlob = file;
    }
  }

  // Coba unggah ke Firebase Storage dengan batas timeout 2 detik (2000ms)
  try {
    const safeFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const storagePath = `leave_letters/${state.currentUser?.uid || 'guest'}/${safeFileName}`;
    const storageReference = ref(storage, storagePath);

    const uploadPromise = uploadBytes(storageReference, processedBlob).then(snap => getDownloadURL(snap.ref));
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Firebase Storage timeout (mengaktifkan fallback instan)')), 2000)
    );

    const downloadUrl = await Promise.race([uploadPromise, timeoutPromise]);
    return {
      url: downloadUrl,
      size: processedBlob.size || file.size,
      storageMethod: 'cloud_storage'
    };
  } catch (storageErr) {
    console.warn('Firebase Storage offline / timeout, beralih ke penyimpanan aman Firestore:', storageErr?.message || storageErr);

    // Fallback 1: Jika gambar yang sudah dikompresi, langsung gunakan Data URL
    if (compressedDataUrl) {
      return {
        url: compressedDataUrl,
        size: processedBlob.size || file.size,
        storageMethod: 'compressed_inline'
      };
    }

    // Fallback 2: Jika dokumen PDF atau Word di bawah batas aman Firestore (680 KB)
    if (file.size <= 680 * 1024) {
      const dataUrl = await readFileAsDataUrl(file);
      return {
        url: dataUrl,
        size: file.size,
        storageMethod: 'direct_inline'
      };
    }

    // Dokumen non-gambar > 680 KB saat Storage offline: tolak dengan instruksi jelas dan ramah
    throw new Error(
      `Dokumen "${file.name}" berukuran ${formatBytes(file.size)}. Karena server cloud eksternal sedang offline, dokumen PDF/Word dibatasi maksimal 680 KB. Solusi Cepat: Silakan ambil foto surat dokter/izin Anda (JPG/PNG) menggunakan kamera handphone agar sistem dapat mengompresinya secara otomatis, atau kompresi PDF ke bawah 680 KB.`
    );
  }
}

/**
 * Format Timestamp menjadi Waktu Indonesia Barat
 */
function formatWibTime(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) + ' WIB';
  } catch (e) {
    return isoString;
  }
}

