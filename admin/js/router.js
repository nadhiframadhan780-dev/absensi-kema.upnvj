/**
 * Hash Router & RBAC Route Guard
 * Universitas Pembangunan Nasional "Veteran" Jakarta
 */
import { authState } from './auth.js';
import { showToast } from './ui.js';

// Route permissions mapping
const ROUTE_PERMISSIONS = {
  '#/dashboard': ['superadmin', 'admin_fakultas', 'admin_prodi', 'dosen'],
  '#/mahasiswa': ['superadmin', 'admin_fakultas', 'admin_prodi'],
  '#/matakuliah': ['superadmin', 'admin_fakultas', 'admin_prodi', 'dosen'],
  '#/sesi': ['superadmin', 'admin_fakultas', 'admin_prodi', 'dosen'],
  '#/absensi': ['superadmin', 'admin_fakultas', 'admin_prodi', 'dosen'],
  '#/scanner': ['superadmin', 'admin_fakultas', 'admin_prodi', 'dosen'],
  '#/izin': ['superadmin', 'admin_fakultas', 'admin_prodi', 'dosen'],
  '#/laporan': ['superadmin', 'admin_fakultas', 'admin_prodi', 'dosen'],
  '#/pengumuman': ['superadmin', 'admin_fakultas', 'admin_prodi'],
  '#/admin': ['superadmin'],
  '#/auditlog': ['superadmin'],
  '#/pengaturan': ['superadmin'],
  '#/profil': ['superadmin', 'admin_fakultas', 'admin_prodi', 'dosen']
};

export class AdminRouter {
  constructor(routes = {}) {
    this.routes = routes;
    this.currentHash = '';
    this.init();
  }

  init() {
    window.addEventListener('hashchange', () => this.handleRoute());
  }

  navigate(hash) {
    window.location.hash = hash;
  }

  handleRoute() {
    const rawHash = window.location.hash || '#/dashboard';
    const cleanHash = rawHash.split('?')[0];
    this.currentHash = cleanHash;

    // 1. Jika belum login dan bukan di halaman login
    if (!authState.user) {
      if (cleanHash !== '#/login') {
        this.navigate('#/login');
        return;
      }
      this.renderView('#/login');
      return;
    }

    // 2. Jika sudah login tetapi mencoba akses halaman login
    if (cleanHash === '#/login') {
      this.navigate('#/dashboard');
      return;
    }

    // 3. RBAC Route Guard
    const allowedRoles = ROUTE_PERMISSIONS[cleanHash];
    if (allowedRoles && !allowedRoles.includes(authState.role)) {
      showToast('error', 'Akses Ditolak', 'Peran akun Anda tidak memiliki izin untuk membuka halaman ini.');
      this.renderView('#/akses-ditolak');
      return;
    }

    // 4. Render halaman yang sesuai
    if (this.routes[cleanHash]) {
      this.renderView(cleanHash);
    } else {
      this.renderView('#/404');
    }
  }

  renderView(hash) {
    const appLayout = document.getElementById('admin-app-layout');
    const loginView = document.getElementById('admin-login-view');
    const views = document.querySelectorAll('.admin-page-view');

    if (hash === '#/login') {
      if (appLayout) appLayout.classList.add('hidden');
      if (loginView) loginView.classList.remove('hidden');
      return;
    }

    if (appLayout) appLayout.classList.remove('hidden');
    if (loginView) loginView.classList.add('hidden');

    // Sembunyikan semua views
    views.forEach(v => v.classList.add('hidden'));

    // Tampilkan view aktif
    const targetId = `view-${hash.replace('#/', '')}`;
    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      targetEl.classList.remove('hidden');
    }

    // Update active state di sidebar
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
      if (item.getAttribute('href') === hash) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Panggil handler halaman
    const handler = this.routes[hash];
    if (typeof handler === 'function') {
      handler();
    }

    if (window.lucide) window.lucide.createIcons();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
