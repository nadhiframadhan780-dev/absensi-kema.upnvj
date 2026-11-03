/**
 * Page Controller: Pengumuman Terarah untuk Mahasiswa
 * Universitas Pembangunan Nasional "Veteran" Jakarta
 */
import { 
  fetchAnnouncements, 
  addAnnouncement, 
  updateAnnouncement, 
  deleteAnnouncement 
} from '../services/announcementService.js';
import { escapeHtml, formatDateWIB } from '../utils.js';
import { showToast, showConfirmDialog, setButtonLoading } from '../ui.js';
import { authState } from '../auth.js';

let announcementsList = [];

export async function renderPengumumanPage() {
  const container = document.getElementById('view-pengumuman');
  if (!container) return;

  setupPengumumanEventListeners();
  await loadAnnouncementsList();
}

function setupPengumumanEventListeners() {
  const btnAdd = document.getElementById('btn-add-announcement');
  if (btnAdd) btnAdd.onclick = openAddAnnouncementModal;
}

async function loadAnnouncementsList() {
  const grid = document.getElementById('announcements-grid');
  if (!grid) return;

  grid.innerHTML = `
    <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--slate-400);">
      <div class="spinner-border" style="width: 24px; height: 24px; margin: 0 auto 10px;"></div>
      <span>Memuat pengumuman kampus...</span>
    </div>
  `;

  try {
    announcementsList = await fetchAnnouncements();

    if (announcementsList.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 48px; text-align: center; color: var(--slate-400); background: #ffffff; border-radius: 16px; border: 1px dashed var(--slate-300);">
          <i data-lucide="megaphone" style="width: 36px; height: 36px; margin: 0 auto 10px; stroke-width: 1.5;"></i>
          <h4 style="font-size: 15px; font-weight: 700; color: var(--slate-700); margin: 0;">Belum Ada Pengumuman</h4>
          <p style="font-size: 12px; margin: 4px 0 0 0;">Klik "Buat Pengumuman Baru" untuk menyiarkan informasi ke mahasiswa.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    grid.innerHTML = announcementsList.map(a => `
      <div class="announcement-card announcement-${a.tipe || 'info'}">
        <div class="announcement-header">
          <span class="badge-announcement badge-${a.tipe || 'info'}">
            ${(a.tipe || 'INFO').toUpperCase()}
          </span>
          <span style="font-size: 11px; color: var(--slate-400);">
            Target: <strong>${escapeHtml(a.targetTipe || 'Semua')}</strong>
          </span>
        </div>
        <h3 class="announcement-title">${escapeHtml(a.judul)}</h3>
        <p class="announcement-body">${escapeHtml(a.isi)}</p>
        <div class="announcement-footer">
          <div style="font-size: 11px; color: var(--slate-400);">
            Tayang: ${formatDateWIB(a.mulai)} s/d ${formatDateWIB(a.berakhir)}
          </div>
          <button type="button" class="btn-action-icon btn-delete-announcement" data-id="${a.id}" title="Hapus Pengumuman">
            <i data-lucide="trash-2" style="width: 14px; height: 14px; color: var(--rose-500);"></i>
          </button>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.btn-delete-announcement').forEach(btn => {
      btn.onclick = () => handleDeleteAnnouncement(btn.dataset.id);
    });

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('Error loading announcements:', err);
    showToast('error', 'Gagal Memuat Pengumuman', err.message);
  }
}

function openAddAnnouncementModal() {
  const modal = document.getElementById('modal-add-announcement');
  if (!modal) return;
  modal.classList.remove('hidden');

  const form = document.getElementById('form-add-announcement');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-submit-announcement');
      setButtonLoading(btn, true, 'Menyiarkan...');

      try {
        const payload = {
          judul: document.getElementById('ann-input-judul').value.trim(),
          isi: document.getElementById('ann-input-isi').value.trim(),
          tipe: document.getElementById('ann-input-tipe').value || 'info',
          targetTipe: document.getElementById('ann-input-target').value || 'semua',
          mulai: document.getElementById('ann-input-mulai').value,
          berakhir: document.getElementById('ann-input-berakhir').value,
          aktif: true
        };

        await addAnnouncement(payload, {
          nama: authState.adminDoc?.nama || authState.user.email,
          role: authState.role
        });

        showToast('success', 'Pengumuman Diterbitkan', 'Pengumuman akan muncul di dashboard portal mahasiswa.');
        modal.classList.add('hidden');
        form.reset();
        await loadAnnouncementsList();
      } catch (err) {
        showToast('error', 'Gagal', err.message);
      } finally {
        setButtonLoading(btn, false);
      }
    };
  }
}

async function handleDeleteAnnouncement(id) {
  const confirmed = await showConfirmDialog({
    title: 'Hapus Pengumuman?',
    message: 'Pengumuman ini tidak akan lagi tampil di portal mahasiswa.',
    confirmText: 'Ya, Hapus',
    isDestructive: true
  });

  if (confirmed) {
    try {
      await deleteAnnouncement(id);
      showToast('success', 'Dihapus', 'Pengumuman berhasil dihapus.');
      await loadAnnouncementsList();
    } catch (err) {
      showToast('error', 'Gagal', err.message);
    }
  }
}
