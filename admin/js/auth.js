/**
 * Modul Autentikasi Admin, RBAC, dan Session Timeout
 * Universitas Pembangunan Nasional "Veteran" Jakarta
 */
import { 
  auth, 
  db, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail, 
  onAuthStateChanged,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from './firebase.js';
import { showToast, showConfirmDialog } from './ui.js';
import { logAdminAction } from './services/auditService.js';

export const authState = {
  user: null,
  adminDoc: null,
  role: null,
  fakultas: null,
  prodi: null,
  isInitialized: false
};

// Inactivity Session Timeout (30 Menit tidak aktif, peringatan pada menit ke-29)
let inactivityTimer = null;
let warningTimer = null;
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 Menit
const WARNING_BEFORE_MS = 1 * 60 * 1000;    // 1 Menit sebelum logout

export function initAuthListener(onAuthChangedCallback) {
  onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        const adminRef = doc(db, 'admins', firebaseUser.uid);
        const adminSnap = await getDoc(adminRef);

        if (!adminSnap.exists()) {
          // Bukan admin (misal akun mahasiswa yang mencoba login)
          await signOut(auth);
          resetAuthState();
          showToast('error', 'Akses Ditolak', 'Akun ini terdaftar sebagai mahasiswa dan tidak memiliki akses ke Admin Panel.');
          if (onAuthChangedCallback) onAuthChangedCallback(null);
          return;
        }

        const adminData = adminSnap.data();
        if (adminData.aktif === false) {
          await signOut(auth);
          resetAuthState();
          showToast('error', 'Akun Dinonaktifkan', 'Akun administrator Anda telah dinonaktifkan oleh Superadmin.');
          if (onAuthChangedCallback) onAuthChangedCallback(null);
          return;
        }

        // Catat login terakhir
        updateDoc(adminRef, {
          lastLogin: serverTimestamp()
        }).catch(() => {});

        authState.user = firebaseUser;
        authState.adminDoc = adminData;
        authState.role = adminData.role || 'dosen';
        authState.fakultas = adminData.fakultas || null;
        authState.prodi = adminData.prodi || null;
        authState.isInitialized = true;

        startInactivityWatcher();

        if (onAuthChangedCallback) onAuthChangedCallback(authState);
      } catch (err) {
        console.error('Error memverifikasi data admin:', err);
        await signOut(auth);
        resetAuthState();
        showToast('error', 'Gagal Verifikasi', 'Gagal memverifikasi hak akses administrator.');
        if (onAuthChangedCallback) onAuthChangedCallback(null);
      }
    } else {
      resetAuthState();
      stopInactivityWatcher();
      if (onAuthChangedCallback) onAuthChangedCallback(null);
    }
  });
}

function resetAuthState() {
  authState.user = null;
  authState.adminDoc = null;
  authState.role = null;
  authState.fakultas = null;
  authState.prodi = null;
  authState.isInitialized = true;
}

/**
 * Login dengan Pembatasan Percobaan (Cooldown 30 detik setelah 5 kegagalan)
 */
let failedAttempts = 0;
let lockoutUntil = 0;

export async function loginAdmin(email, password) {
  const now = Date.now();
  if (now < lockoutUntil) {
    const sisaDetik = Math.ceil((lockoutUntil - now) / 1000);
    throw new Error(`Terlalu banyak percobaan gagal. Silakan tunggu ${sisaDetik} detik lagi.`);
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    failedAttempts = 0;
    
    // Verifikasi role dari Firestore
    const adminRef = doc(db, 'admins', cred.user.uid);
    const snap = await getDoc(adminRef);

    if (!snap.exists() || snap.data().aktif === false) {
      await signOut(auth);
      throw new Error('Akun ini tidak memiliki hak akses administrator aktif.');
    }

    logAdminAction({
      adminUser: { uid: cred.user.uid, nama: snap.data().nama, role: snap.data().role },
      aksi: 'LOGIN',
      targetKoleksi: 'auth'
    });

    return cred.user;
  } catch (error) {
    failedAttempts++;
    if (failedAttempts >= 5) {
      lockoutUntil = Date.now() + 30000; // 30 detik cooldown
    }
    throw error;
  }
}

export async function logoutAdmin() {
  if (authState.user) {
    logAdminAction({
      adminUser: { uid: authState.user.uid, nama: authState.adminDoc?.nama, role: authState.role },
      aksi: 'LOGOUT',
      targetKoleksi: 'auth'
    });
  }
  stopInactivityWatcher();
  await signOut(auth);
}

export async function requestPasswordReset(email) {
  if (!email || !email.includes('@')) {
    throw new Error('Masukkan alamat email yang valid.');
  }
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Pemantau Inaktivitas Pengguna (Auto-Logout 30 Menit)
 */
function resetInactivityTimer() {
  if (!authState.user) return;
  clearTimeout(inactivityTimer);
  clearTimeout(warningTimer);

  // 1 menit sebelum batas akhir (Menit ke-29)
  warningTimer = setTimeout(async () => {
    const confirm = await showConfirmDialog({
      title: 'Peringatan Sesi Berakhir',
      message: 'Sesi Anda akan segera berakhir dalam 1 menit karena tidak ada aktivitas. Klik Lanjutkan untuk memperpanjang sesi.',
      confirmText: 'Tetap Masuk',
      cancelText: 'Keluar Sekarang'
    });
    if (confirm) {
      resetInactivityTimer();
    } else {
      logoutAdmin();
    }
  }, INACTIVITY_LIMIT_MS - WARNING_BEFORE_MS);

  // Batas 30 menit
  inactivityTimer = setTimeout(() => {
    showToast('warning', 'Sesi Berakhir', 'Anda telah otomatis keluar demi keamanan sistem.');
    logoutAdmin();
  }, INACTIVITY_LIMIT_MS);
}

function startInactivityWatcher() {
  const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
  events.forEach(ev => window.addEventListener(ev, resetInactivityTimer, { passive: true }));
  resetInactivityTimer();
}

function stopInactivityWatcher() {
  clearTimeout(inactivityTimer);
  clearTimeout(warningTimer);
  const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
  events.forEach(ev => window.removeEventListener(ev, resetInactivityTimer));
}

/**
 * Pemeriksa Hak Akses (RBAC Scope Checker)
 */
export function hasRole(allowedRoles = []) {
  if (!authState.role) return false;
  if (authState.role === 'superadmin') return true;
  return allowedRoles.includes(authState.role);
}

export function canAccessFaculty(facultyIdOrCode) {
  if (authState.role === 'superadmin') return true;
  if (!authState.fakultas) return false;
  return authState.fakultas.toLowerCase() === String(facultyIdOrCode || '').toLowerCase();
}

export function canAccessProdi(prodiName) {
  if (authState.role === 'superadmin') return true;
  if (authState.role === 'admin_fakultas') return true;
  if (!authState.prodi) return false;
  return authState.prodi.toLowerCase() === String(prodiName || '').toLowerCase();
}
