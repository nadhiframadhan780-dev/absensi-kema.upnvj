/**
 * Page Controller: Manajemen Akun Administrator & Dosen (Superadmin Only)
 * Dikelola via Secondary Firebase App Instance agar Sesi Superadmin Tidak Ter-logout
 */
import { 
  fetchAdminAccounts, 
  createAdminAccount, 
  updateAdminStatus, 
  updateAdminRoleAndScope, 
  resendAdminPasswordReset 
} from '../services/adminService.js';
import { getFacultyList, ROLE_LABELS, ADMIN_ROLES } from '../data.js';
import { escapeHtml, formatDateWIB } from '../utils.js';
import { showToast, showConfirmDialog, setButtonLoading } from '../ui.js';
import { authState } from '../auth.js';

let adminsList = [];

export async function renderAdminManagePage() {
  const container = document.getElementById('view-admin');
  if (!container) return;

  setupAdminManageEventListeners();
  await loadAdminsTable();
}

function setupAdminManageEventListeners() {
  const btnAdd = document.getElementById('btn-add-admin-account');
  if (btnAdd) btnAdd.onclick = openAddAdminModal;
}

async function loadAdminsTable() {
  const tbody = document.getElementById('table-admins-body');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="6" style="padding: 40px; text-align: center; color: var(--slate-400);">
        <div class="spinner-border" style="width: 24px; height: 24px; margin: 0 auto 10px;"></div>
        <span>Memuat data pengelola akademik...</span>
      </td>
    </tr>
  `;

  try {
    adminsList = await fetchAdminAccounts();

    tbody.innerHTML = adminsList.map(adm => {
      const isSelf = adm.uid === authState.user.uid;
      const roleName = ROLE_LABELS[adm.role] || adm.role;

      return `
        <tr class="table-row-hover">
          <td>
            <div class="user-cell">
              <div class="user-avatar-small" style="background: var(--navy-900); color: #ffffff;">
                ${escapeHtml(adm.nama ? adm.nama.charAt(0).toUpperCase() : 'A')}
              </div>
              <div>
                <div class="user-name">
                  ${escapeHtml(adm.nama)}
                  ${isSelf ? '<span class="badge-status badge-active" style="font-size: 10px; margin-left: 6px;">Anda</span>' : ''}
                </div>
                <div class="user-email">${escapeHtml(adm.email)}</div>
              </div>
            </div>
          </td>
          <td>
            <span class="badge-role badge-role-${adm.role}">
              ${escapeHtml(roleName)}
            </span>
          </td>
          <td>
            <div style="font-size: 12px; color: var(--slate-700);">
              ${adm.fakultas ? `Fakultas ${escapeHtml(adm.fakultas)}` : 'Semua Fakultas'}
            </div>
            ${adm.prodi ? `<div style="font-size: 11px; color: var(--slate-400);">${escapeHtml(adm.prodi)}</div>` : ''}
          </td>
          <td>
            <span class="badge-status ${adm.aktif !== false ? 'badge-active' : 'badge-inactive'}">
              ${adm.aktif !== false ? 'Aktif' : 'Nonaktif'}
            </span>
          </td>
          <td style="font-size: 12px; color: var(--slate-500);">
            ${adm.lastLogin ? formatDateWIB(adm.lastLogin.toDate ? adm.lastLogin.toDate() : adm.lastLogin) : 'Belum pernah'}
          </td>
          <td style="text-align: right;">
            <div class="action-btn-group">
              <button type="button" class="btn-action-icon btn-reset-password" data-email="${adm.email}" title="Kirim Ulang Link Reset Password">
                <i data-lucide="key" style="width: 14px; height: 14px;"></i>
              </button>
              ${!isSelf ? `
                <button type="button" class="btn-action-icon btn-toggle-status" data-uid="${adm.uid}" data-active="${adm.aktif !== false}" title="${adm.aktif !== false ? 'Nonaktifkan' : 'Aktifkan'} Akun">
                  <i data-lucide="${adm.aktif !== false ? 'user-x' : 'user-check'}" style="width: 14px; height: 14px; color: ${adm.aktif !== false ? 'var(--rose-500)' : 'var(--emerald-600)'};"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-reset-password').forEach(btn => {
      btn.onclick = async () => {
        try {
          await resendAdminPasswordReset(btn.dataset.email);
          showToast('success', 'Email Terkirim', `Tautan atur ulang kata sandi dikirimkan ke ${btn.dataset.email}.`);
        } catch (e) {
          showToast('error', 'Gagal', e.message);
        }
      };
    });

    tbody.querySelectorAll('.btn-toggle-status').forEach(btn => {
      btn.onclick = async () => {
        const uid = btn.dataset.uid;
        const currentActive = btn.dataset.active === 'true';
        const newStatus = !currentActive;

        const confirm = await showConfirmDialog({
          title: `${newStatus ? 'Aktifkan' : 'Nonaktifkan'} Akun?`,
          message: `Akun ini ${newStatus ? 'akan dapat masuk kembali' : 'tidak akan bisa mengakses Admin Panel'}.`,
          confirmText: newStatus ? 'Aktifkan' : 'Nonaktifkan',
          isDestructive: !newStatus
        });

        if (confirm) {
          try {
            await updateAdminStatus(uid, newStatus, authState.user.uid);
            showToast('success', 'Status Diperbarui', `Akun berhasil ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}.`);
            await loadAdminsTable();
          } catch (e) {
            showToast('error', 'Gagal', e.message);
          }
        }
      };
    });

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('Error loading admins table:', err);
    showToast('error', 'Gagal Memuat Akun', err.message);
  }
}

function openAddAdminModal() {
  const modal = document.getElementById('modal-add-admin');
  if (!modal) return;
  modal.classList.remove('hidden');

  const facSelect = document.getElementById('admin-input-fakultas');
  const prodiSelect = document.getElementById('admin-input-prodi');
  const faculties = getFacultyList();

  if (facSelect) {
    facSelect.innerHTML = '<option value="">Semua Fakultas (Nasional)</option>' +
      faculties.map(f => `<option value="${f.kode}">${f.kode} - ${f.nama}</option>`).join('');

    facSelect.onchange = () => {
      const selected = faculties.find(f => f.kode === facSelect.value);
      if (prodiSelect) {
        prodiSelect.innerHTML = '<option value="">Semua Program Studi</option>' +
          (selected ? selected.prodi.map(p => `<option value="${p.nama}">${p.nama}</option>`).join('') : '');
      }
    };
  }

  const form = document.getElementById('form-add-admin');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-submit-add-admin');
      setButtonLoading(btn, true, 'Membuat Akun via Secondary Auth...');

      try {
        const payload = {
          nama: document.getElementById('admin-input-nama').value.trim(),
          email: document.getElementById('admin-input-email').value.trim(),
          role: document.getElementById('admin-input-role').value,
          fakultas: document.getElementById('admin-input-fakultas').value || null,
          prodi: document.getElementById('admin-input-prodi').value || null
        };

        await createAdminAccount(payload, {
          nama: authState.adminDoc?.nama || 'Superadmin',
          email: authState.user.email
        });

        showToast('success', 'Akun Berhasil Dibuat', `Akun ${payload.email} berhasil dibuat. Email reset sandi otomatis dikirimkan ke alamat tersebut.`);
        modal.classList.add('hidden');
        form.reset();
        await loadAdminsTable();
      } catch (err) {
        showToast('error', 'Gagal Menambah Akun', err.message);
      } finally {
        setButtonLoading(btn, false);
      }
    };
  }
}
