/**
 * Page Controller: Pengajuan Izin & Sakit Mahasiswa
 * Universitas Pembangunan Nasional "Veteran" Jakarta
 */
import { 
  fetchLeaveRequests, 
  approveLeaveRequest, 
  rejectLeaveRequest 
} from '../services/leaveService.js';
import { escapeHtml, formatDateWIB } from '../utils.js';
import { 
  showToast, 
  showConfirmDialog, 
  openDrawer, 
  closeDrawer, 
  setButtonLoading 
} from '../ui.js';
import { authState } from '../auth.js';

let leaveList = [];

export async function renderIzinPage() {
  const container = document.getElementById('view-izin');
  if (!container) return;

  setupIzinFilters();
  await loadLeaveTable();
}

function setupIzinFilters() {
  const statusFilter = document.getElementById('filter-izin-status');
  if (statusFilter) {
    statusFilter.onchange = () => loadLeaveTable();
  }
}

async function loadLeaveTable() {
  const tbody = document.getElementById('table-izin-body');
  if (!tbody) return;

  const statusVal = document.getElementById('filter-izin-status')?.value || 'all';

  tbody.innerHTML = `
    <tr>
      <td colspan="7" style="padding: 40px; text-align: center; color: var(--slate-400);">
        <div class="spinner-border" style="width: 24px; height: 24px; margin: 0 auto 10px;"></div>
        <span>Memuat pengajuan izin & sakit...</span>
      </td>
    </tr>
  `;

  try {
    leaveList = await fetchLeaveRequests({
      status: statusVal,
      fakultas: authState.fakultas || 'all',
      prodi: authState.prodi || 'all'
    });

    if (leaveList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="padding: 48px; text-align: center; color: var(--slate-400);">
            <i data-lucide="check-check" style="width: 36px; height: 36px; margin: 0 auto 10px; stroke-width: 1.5; color: #10b981;"></i>
            <p style="font-weight: 600; font-size: 14px; margin: 0; color: var(--slate-600);">Tidak Ada Pengajuan Menunggu</p>
            <p style="font-size: 12px; margin: 4px 0 0 0;">Semua permohonan izin dan sakit telah diproses.</p>
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    tbody.innerHTML = leaveList.map(item => `
      <tr class="table-row-hover">
        <td>
          <div style="font-weight: 700; color: var(--slate-900); font-size: 13px;">${formatDateWIB(item.createdAt)}</div>
          <div style="font-size: 11px; color: var(--slate-400);">${escapeHtml(item.tanggalMulai || '-')}</div>
        </td>
        <td class="font-mono text-bold">${escapeHtml(item.nim || '-')}</td>
        <td style="font-weight: 600; color: var(--slate-900);">${escapeHtml(item.nama || '-')}</td>
        <td>
          <span class="badge-status ${item.jenis === 'Sakit' ? 'badge-sakit' : 'badge-izin'}">
            ${escapeHtml(item.jenis || 'Izin')}
          </span>
        </td>
        <td style="font-weight: 600; color: var(--navy-900);">${escapeHtml(item.mataKuliah || 'Semua Kuliah')}</td>
        <td>
          <span class="badge-status status-${(item.status || 'menunggu').toLowerCase()}">
            ${escapeHtml(item.status || 'Menunggu')}
          </span>
        </td>
        <td style="text-align: right;">
          <div class="action-btn-group">
            <button type="button" class="btn-portal btn-secondary btn-sm btn-view-leave" data-id="${item.id}">
              <i data-lucide="file-text" style="width: 14px; height: 14px;"></i>
              <span>Detail & Bukti</span>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-view-leave').forEach(btn => {
      btn.onclick = () => openLeaveDetailDrawer(btn.dataset.id);
    });

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('Error loading leave table:', err);
    showToast('error', 'Gagal Memuat Pengajuan', err.message);
  }
}

/**
 * Drawer Detail Pengajuan Izin/Sakit & Pratinjau Surat Dokter
 */
function openLeaveDetailDrawer(requestId) {
  const item = leaveList.find(l => l.id === requestId);
  if (!item) return;

  const contentHtml = `
    <div style="padding: 16px 0;">
      <div style="margin-bottom: 20px;">
        <span class="badge-status ${item.jenis === 'Sakit' ? 'badge-sakit' : 'badge-izin'}" style="font-size: 13px; padding: 4px 14px;">
          ${escapeHtml(item.jenis)}
        </span>
        <span class="badge-status status-${(item.status || 'menunggu').toLowerCase()}" style="font-size: 13px; padding: 4px 14px; margin-left: 8px;">
          ${escapeHtml(item.status || 'Menunggu')}
        </span>
      </div>

      <div class="detail-grid" style="margin-bottom: 20px;">
        <div class="detail-item"><span class="detail-label">Mahasiswa:</span><span class="detail-value">${escapeHtml(item.nama)} (${escapeHtml(item.nim)})</span></div>
        <div class="detail-item"><span class="detail-label">Program Studi:</span><span class="detail-value">${escapeHtml(item.prodi || '-')} (${escapeHtml(item.fakultas || '-')})</span></div>
        <div class="detail-item"><span class="detail-label">Mata Kuliah:</span><span class="detail-value">${escapeHtml(item.mataKuliah || 'Kuliah Reguler')}</span></div>
        <div class="detail-item"><span class="detail-label">Tanggal Izin:</span><span class="detail-value">${formatDateWIB(item.tanggalMulai)} ${item.tanggalSelesai ? `s/d ${formatDateWIB(item.tanggalSelesai)}` : ''}</span></div>
      </div>

      <div style="margin-bottom: 20px;">
        <h4 style="font-size: 13px; font-weight: 700; color: var(--slate-900); margin: 0 0 6px 0;">Alasan Pengajuan:</h4>
        <div style="padding: 12px 16px; background: var(--slate-100); border-radius: 10px; font-size: 13px; color: var(--slate-700); line-height: 1.5;">
          ${escapeHtml(item.alasan || 'Tidak ada keterangan tambahan.')}
        </div>
      </div>

      <!-- Lampiran Surat Sakit / Bukti Foto -->
      <div>
        <h4 style="font-size: 13px; font-weight: 700; color: var(--slate-900); margin: 0 0 8px 0;">Lampiran Surat Keterangan / Bukti:</h4>
        ${item.lampiran ? `
          <div style="border-radius: 12px; overflow: hidden; border: 1px solid var(--slate-200); background: #000000; text-align: center; max-height: 380px;">
            <img src="${item.lampiran}" alt="Bukti Surat Izin" style="max-width: 100%; max-height: 380px; object-fit: contain; margin: 0 auto; display: block;">
          </div>
          <div style="margin-top: 8px; text-align: right;">
            <a href="${item.lampiran}" target="_blank" class="text-sm font-semibold text-primary" style="text-decoration: underline;">Buka Ukuran Penuh ↗</a>
          </div>
        ` : `
          <div style="padding: 24px; text-align: center; color: var(--slate-400); background: var(--slate-50); border-radius: 10px;">
            <span>Tidak ada lampiran dokumen foto.</span>
          </div>
        `}
      </div>

      ${item.catatanAdmin ? `
        <div style="margin-top: 20px; padding: 12px; border-left: 4px solid var(--navy-800); background: var(--navy-50);">
          <div style="font-size: 11px; font-weight: 700; color: var(--navy-900);">Catatan Verifikasi Admin:</div>
          <div style="font-size: 12px; color: var(--slate-700); margin-top: 2px;">${escapeHtml(item.catatanAdmin)} (${escapeHtml(item.diprosesOleh || 'Admin')})</div>
        </div>
      ` : ''}
    </div>
  `;

  let footerHtml = '';
  if (item.status === 'Menunggu') {
    footerHtml = `
      <div style="display: flex; gap: 10px; width: 100%;">
        <button type="button" class="btn-portal btn-danger" id="drawer-btn-reject" style="flex: 1;">
          <i data-lucide="x-circle" style="width: 16px; height: 16px;"></i>
          <span>Tolak Pengajuan</span>
        </button>
        <button type="button" class="btn-portal btn-primary" id="drawer-btn-approve" style="flex: 1;">
          <i data-lucide="check-circle" style="width: 16px; height: 16px;"></i>
          <span>Setujui Izin</span>
        </button>
      </div>
    `;
  }

  openDrawer(`Pengajuan ${item.jenis}: ${item.nama}`, contentHtml, footerHtml);

  if (item.status === 'Menunggu') {
    const btnApprove = document.getElementById('drawer-btn-approve');
    const btnReject = document.getElementById('drawer-btn-reject');

    if (btnApprove) {
      btnApprove.onclick = async () => {
        const confirm = await showConfirmDialog({
          title: `Setujui Pengajuan ${item.jenis}?`,
          message: `Sistem akan otomatis mencatat presensi mahasiswa ${item.nama} sebagai "${item.jenis}".`,
          confirmText: 'Ya, Setujui'
        });

        if (confirm) {
          try {
            await approveLeaveRequest(requestId, 'Disetujui oleh pengelola akademik', {
              nama: authState.adminDoc?.nama || authState.user.email,
              role: authState.role
            });
            showToast('success', 'Disetujui', `Pengajuan ${item.jenis} mahasiswa ${item.nama} berhasil disetujui.`);
            closeDrawer();
            await loadLeaveTable();
          } catch (err) {
            showToast('error', 'Gagal Menyetujui', err.message);
          }
        }
      };
    }

    if (btnReject) {
      btnReject.onclick = async () => {
        const reason = prompt('Masukkan alasan penolakan izin:') || '';
        if (!reason.trim()) {
          showToast('warning', 'Dibatalkan', 'Alasan penolakan wajib dicatat.');
          return;
        }

        try {
          await rejectLeaveRequest(requestId, reason.trim(), {
            nama: authState.adminDoc?.nama || authState.user.email,
            role: authState.role
          });
          showToast('info', 'Ditolak', `Pengajuan ${item.jenis} telah ditolak.`);
          closeDrawer();
          await loadLeaveTable();
        } catch (err) {
          showToast('error', 'Gagal Menolak', err.message);
        }
      };
    }
  }
}
