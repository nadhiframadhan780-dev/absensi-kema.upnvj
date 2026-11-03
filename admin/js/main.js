/**
 * Admin Panel Entry Point & Main Application Orchestrator
 * Universitas Pembangunan Nasional "Veteran" Jakarta
 */
import { initAuthListener, authState, loginAdmin, logoutAdmin, requestPasswordReset } from './auth.js';
import { AdminRouter } from './router.js';
import { showToast, initGlobalUiListeners, setButtonLoading } from './ui.js';
import { listenPendingLeaveRequestsCount } from './services/leaveService.js';
import { ROLE_LABELS } from './data.js';

// Page Controllers
import { renderDashboardPage } from './pages/dashboard.js';
import { renderMahasiswaPage } from './pages/mahasiswa.js';
import { renderMatakuliahPage } from './pages/matakuliah.js';
import { renderSesiPage } from './pages/sesi.js';
import { renderAbsensiPage } from './pages/absensi.js';
import { renderScannerPage } from './pages/scanner.js';
import { renderIzinPage } from './pages/izin.js';
import { renderLaporanPage } from './pages/laporan.js';
import { renderPengumumanPage } from './pages/pengumuman.js';
import { renderAdminManagePage } from './pages/adminManage.js';
import { renderAuditLogPage } from './pages/auditLog.js';
import { renderPengaturanPage } from './pages/pengaturan.js';
import { renderProfilPage } from './pages/profil.js';

// Setup routes dictionary
const routes = {
  '#/dashboard': renderDashboardPage,
  '#/mahasiswa': renderMahasiswaPage,
  '#/matakuliah': renderMatakuliahPage,
  '#/sesi': renderSesiPage,
  '#/absensi': renderAbsensiPage,
  '#/scanner': renderScannerPage,
  '#/izin': renderIzinPage,
  '#/laporan': renderLaporanPage,
  '#/pengumuman': renderPengumumanPage,
  '#/admin': renderAdminManagePage,
  '#/auditlog': renderAuditLogPage,
  '#/pengaturan': renderPengaturanPage,
  '#/profil': renderProfilPage
};

const router = new AdminRouter(routes);

// Dark Mode Toggle dengan localStorage
function initDarkMode() {
  const isDark = localStorage.getItem('upnvj_admin_theme') === 'dark';
  if (isDark) {
    document.documentElement.classList.add('dark');
  }

  const toggleBtn = document.getElementById('btn-toggle-dark-mode');
  if (toggleBtn) {
    toggleBtn.onclick = () => {
      const currentlyDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('upnvj_admin_theme', currentlyDark ? 'dark' : 'light');
      showToast('info', currentlyDark ? 'Mode Gelap Aktif' : 'Mode Terang Aktif');
    };
  }
}

// Sidebar Drawer Toggle untuk Mobile & Desktop Collapse
function initSidebarToggle() {
  const sidebar = document.getElementById('admin-sidebar');
  const toggleBtn = document.getElementById('btn-sidebar-toggle');
  const backdrop = document.getElementById('sidebar-mobile-backdrop');

  if (toggleBtn && sidebar) {
    toggleBtn.onclick = () => {
      sidebar.classList.toggle('sidebar-collapsed');
      sidebar.classList.toggle('sidebar-mobile-open');
      if (backdrop) backdrop.classList.toggle('hidden');
    };
  }

  if (backdrop) {
    backdrop.onclick = () => {
      sidebar.classList.remove('sidebar-mobile-open');
      backdrop.classList.add('hidden');
    };
  }

  // Tutup drawer di mobile saat item diklik
  document.querySelectorAll('.sidebar-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth < 1024) {
        sidebar.classList.remove('sidebar-mobile-open');
        if (backdrop) backdrop.classList.add('hidden');
      }
    });
  });
}

// Inisialisasi Auth Form & UI
function setupLoginForm() {
  const form = document.getElementById('form-admin-login');
  const btnTogglePass = document.getElementById('btn-toggle-login-pass');
  const passInput = document.getElementById('admin-login-password');
  const btnForgot = document.getElementById('btn-forgot-password');

  if (btnTogglePass && passInput) {
    btnTogglePass.onclick = () => {
      const isPass = passInput.type === 'password';
      passInput.type = isPass ? 'text' : 'password';
      btnTogglePass.innerHTML = `<i data-lucide="${isPass ? 'eye-off' : 'eye'}" style="width: 16px; height: 16px;"></i>`;
      if (window.lucide) window.lucide.createIcons();
    };
  }

  if (btnForgot) {
    btnForgot.onclick = async () => {
      const emailInput = document.getElementById('admin-login-email');
      const email = emailInput ? emailInput.value.trim() : '';
      if (!email) {
        showToast('warning', 'Masukkan Email', 'Ketik alamat email administrator Anda pada form login terlebih dahulu.');
        return;
      }

      try {
        await requestPasswordReset(email);
        showToast('success', 'Email Terkirim', `Tautan atur ulang kata sandi telah dikirimkan ke ${email}.`);
      } catch (err) {
        showToast('error', 'Gagal', err.message);
      }
    };
  }

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const email = document.getElementById('admin-login-email').value;
      const pass = document.getElementById('admin-login-password').value;
      const btn = document.getElementById('btn-submit-admin-login');

      setButtonLoading(btn, true, 'Memverifikasi Akses Admin...');
      try {
        await loginAdmin(email, pass);
        showToast('success', 'Selamat Datang', 'Autentikasi administrator UPNVJ berhasil.');
      } catch (err) {
        let msg = err.message;
        if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          msg = 'Email atau kata sandi yang Anda masukkan tidak sesuai.';
        } else if (err.code === 'auth/user-not-found') {
          msg = 'Akun administrator dengan email ini tidak ditemukan.';
        }
        showToast('error', 'Gagal Masuk', msg);
      } finally {
        setButtonLoading(btn, false);
      }
    };
  }
}

// Sesuaikan Menu Sidebar Berdasarkan Role Pengguna
function applyRoleBasedSidebar(role) {
  const superadminOnlyNav = document.querySelectorAll('.nav-superadmin-only');
  const studentNav = document.querySelectorAll('.nav-student-manage');

  if (role === 'superadmin') {
    superadminOnlyNav.forEach(el => el.classList.remove('hidden'));
    studentNav.forEach(el => el.classList.remove('hidden'));
  } else if (role === 'admin_fakultas' || role === 'admin_prodi') {
    superadminOnlyNav.forEach(el => el.classList.add('hidden'));
    studentNav.forEach(el => el.classList.remove('hidden'));
  } else if (role === 'dosen') {
    superadminOnlyNav.forEach(el => el.classList.add('hidden'));
    studentNav.forEach(el => el.classList.add('hidden'));
  }
}

// Inisialisasi Aplikasi Saat Halaman Selesai Dimuat
document.addEventListener('DOMContentLoaded', () => {
  initDarkMode();
  initSidebarToggle();
  initGlobalUiListeners();
  setupLoginForm();

  const logoutBtn = document.getElementById('btn-admin-logout');
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await logoutAdmin();
      showToast('info', 'Telah Keluar', 'Sesi administrator Anda telah ditutup.');
    };
  }

  // Pantau status login
  initAuthListener((state) => {
    if (state && state.user) {
      // Update data di topbar & sidebar
      const name = state.adminDoc?.nama || state.user.email;
      const roleLabel = ROLE_LABELS[state.role] || state.role;

      document.getElementById('topbar-admin-name').textContent = name;
      document.getElementById('topbar-admin-role').textContent = roleLabel;
      document.getElementById('sidebar-admin-name').textContent = name;
      document.getElementById('sidebar-admin-role').textContent = roleLabel;

      applyRoleBasedSidebar(state.role);

      // Pantau jumlah pengajuan izin yang menunggu
      listenPendingLeaveRequestsCount((count) => {
        const badge = document.getElementById('badge-leave-pending');
        if (badge) {
          if (count > 0) {
            badge.textContent = count;
            badge.classList.remove('hidden');
          } else {
            badge.classList.add('hidden');
          }
        }
      });

      router.handleRoute();
    } else {
      router.handleRoute();
    }
  });
});
