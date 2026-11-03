/**
 * Page Controller: Rekam Data & Koreksi Presensi
 * Universitas Pembangunan Nasional "Veteran" Jakarta
 */
import { 
  fetchAttendanceList, 
  updateAttendanceStatus, 
  deleteAttendanceRecord, 
  addManualAttendance 
} from '../services/attendanceService.js';
import { getFacultyList } from '../data.js';
import { 
  escapeHtml, 
  formatDateWIB, 
  formatTimeWIB, 
  exportToExcel, 
  debounce 
} from '../utils.js';
import { showToast, showConfirmDialog, setButtonLoading } from '../ui.js';
import { authState } from '../auth.js';

let attendanceList = [];
let lastVisibleDoc = null;
let currentFilters = {
  startDate: '',
  endDate: '',
  fakultas: 'all',
  prodi: 'all',
  status: 'all',
  metode: 'all',
  nimQuery: ''
};

export async function renderAbsensiPage() {
  const container = document.getElementById('view-absensi');
  if (!container) return;

  setupAbsensiFilters();
  setupAbsensiEventListeners();
  await loadAttendanceTable(true);
}

function setupAbsensiFilters() {
  const facSelect = document.getElementById('filter-abs-fakultas');
  const prodiSelect = document.getElementById('filter-abs-prodi');
  const statusSelect = document.getElementById('filter-abs-status');
  const searchInput = document.getElementById('filter-abs-search');
  const dateStart = document.getElementById('filter-abs-start-date');
  const dateEnd = document.getElementById('filter-abs-end-date');

  const faculties = getFacultyList();
  if (facSelect) {
    facSelect.innerHTML = '<option value="all">Semua Fakultas</option>' +
      faculties.map(f => `<option value="${f.kode}">${f.kode} - ${f.nama}</option>`).join('');

    facSelect.onchange = () => {
      currentFilters.fakultas = facSelect.value;
      if (prodiSelect) {
        if (facSelect.value === 'all') {
          prodiSelect.innerHTML = '<option value="all">Semua Program Studi</option>';
        } else {
          const f = faculties.find(fac => fac.kode === facSelect.value);
          prodiSelect.innerHTML = '<option value="all">Semua Program Studi</option>' +
            (f ? f.prodi.map(p => `<option value="${p.nama}">${p.nama}</option>`).join('') : '');
        }
      }
      currentFilters.prodi = 'all';
      loadAttendanceTable(true);
    };
  }

  if (prodiSelect) {
    prodiSelect.onchange = () => {
      currentFilters.prodi = prodiSelect.value;
      loadAttendanceTable(true);
    };
  }

  if (statusSelect) {
    statusSelect.onchange = () => {
      currentFilters.status = statusSelect.value;
      loadAttendanceTable(true);
    };
  }

  if (dateStart) {
    dateStart.onchange = () => {
      currentFilters.startDate = dateStart.value;
      loadAttendanceTable(true);
    };
  }

  if (dateEnd) {
    dateEnd.onchange = () => {
      currentFilters.endDate = dateEnd.value;
      loadAttendanceTable(true);
    };
  }

  if (searchInput) {
    searchInput.oninput = debounce(() => {
      currentFilters.nimQuery = searchInput.value;
      loadAttendanceTable(true);
    }, 350);
  }
}

function setupAbsensiEventListeners() {
  const btnExport = document.getElementById('btn-export-absensi');
  if (btnExport) {
    btnExport.onclick = () => {
      if (attendanceList.length === 0) {
        showToast('warning', 'Tidak Ada Data', 'Tidak ada data presensi yang sesuai untuk diekspor.');
        return;
      }
      const data = attendanceList.map((a, i) => ({
        No: i + 1,
        Tanggal: a.tanggal || '',
        Waktu: a.waktu || '',
        NIM: a.nim || '',
        Nama: a.nama || '',
        Fakultas: a.fakultas || '',
        Prodi: a.prodi || '',
        MataKuliah: a.mataKuliah || '',
        Pertemuan: a.pertemuan || '-',
        Metode: a.metode || 'manual',
        Status: a.status || 'Hadir',
        Keterangan: a.keterangan || a.alasanUbah || ''
      }));
      exportToExcel(data, `Presensi_UPNVJ_${new Date().toISOString().split('T')[0]}.xlsx`, 'Presensi');
      showToast('success', 'Ekspor Selesai', 'Data presensi berhasil diunduh dalam format Excel.');
    };
  }
}

async function loadAttendanceTable(isReset = false) {
  const tbody = document.getElementById('table-absensi-body');
  if (!tbody) return;

  if (isReset) {
    lastVisibleDoc = null;
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="padding: 40px; text-align: center; color: var(--slate-400);">
          <div class="spinner-border" style="width: 24px; height: 24px; margin: 0 auto 10px;"></div>
          <span>Memuat rekaman presensi...</span>
        </td>
      </tr>
    `;
  }

  try {
    const res = await fetchAttendanceList({
      ...currentFilters,
      lastVisibleDoc: lastVisibleDoc,
      pageSize: 25
    });

    attendanceList = res.records;
    lastVisibleDoc = res.lastVisible;

    if (attendanceList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="padding: 48px; text-align: center; color: var(--slate-400);">
            <i data-lucide="inbox" style="width: 36px; height: 36px; margin: 0 auto 10px; stroke-width: 1.5;"></i>
            <p style="font-weight: 600; font-size: 14px; margin: 0; color: var(--slate-600);">Tidak Ada Rekaman Presensi</p>
            <p style="font-size: 12px; margin: 4px 0 0 0;">Coba atur rentang tanggal atau filter fakultas.</p>
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    tbody.innerHTML = attendanceList.map(a => `
      <tr class="table-row-hover">
        <td>
          <div style="font-weight: 700; color: var(--slate-900); font-size: 13px;">${escapeHtml(a.tanggal || '-')}</div>
          <div style="font-size: 11px; color: var(--slate-400); margin-top: 2px;">${escapeHtml(a.waktu || '-')}</div>
        </td>
        <td class="font-mono text-bold">${escapeHtml(a.nim || '-')}</td>
        <td style="font-weight: 600; color: var(--slate-900);">${escapeHtml(a.nama || '-')}</td>
        <td>
          <div style="font-weight: 600; color: var(--navy-900);">${escapeHtml(a.mataKuliah || '-')}</div>
          <div style="font-size: 11px; color: var(--slate-400);">Pertemuan ${escapeHtml(a.pertemuan || 1)} • ${escapeHtml(a.prodi || '-')}</div>
        </td>
        <td>
          <span class="badge-method badge-${(a.metode || 'manual').replace(/[^a-z]/g, '')}">
            ${escapeHtml(a.metode || 'manual')}
          </span>
        </td>
        <td>
          <span class="badge-status badge-${(a.status || 'Hadir').toLowerCase()}">
            ${escapeHtml(a.status || 'Hadir')}
          </span>
          ${a.diubahOleh ? `<div style="font-size: 10px; color: var(--gold-600); margin-top: 2px;">(Dikoreksi)</div>` : ''}
        </td>
        <td style="font-size: 11px; color: var(--slate-500); max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${escapeHtml(a.keterangan || a.alasanUbah || '-')}
        </td>
        <td style="text-align: right;">
          <div class="action-btn-group">
            <button type="button" class="btn-action-icon btn-edit-attendance" data-id="${a.id}" title="Koreksi Status Presensi">
              <i data-lucide="edit-2" style="width: 15px; height: 15px;"></i>
            </button>
            <button type="button" class="btn-action-icon btn-delete-attendance" data-id="${a.id}" title="Hapus Data">
              <i data-lucide="trash-2" style="width: 15px; height: 15px; color: var(--rose-500);"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-edit-attendance').forEach(btn => {
      btn.onclick = () => openCorrectionModal(btn.dataset.id);
    });

    tbody.querySelectorAll('.btn-delete-attendance').forEach(btn => {
      btn.onclick = () => handleDeleteAttendance(btn.dataset.id);
    });

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('Error loading attendance table:', err);
    showToast('error', 'Gagal Memuat Data', err.message);
  }
}

/**
 * Modal Koreksi Status Presensi dengan Wajib Mencatat Alasan
 */
function openCorrectionModal(docId) {
  const item = attendanceList.find(a => a.id === docId);
  if (!item) return;

  const modal = document.getElementById('modal-correct-attendance');
  if (!modal) return;

  document.getElementById('correct-att-mhs').textContent = `${item.nama} (${item.nim})`;
  document.getElementById('correct-att-course').textContent = `${item.mataKuliah} - Pertemuan ${item.pertemuan || 1}`;
  
  const statusSelect = document.getElementById('correct-att-status-select');
  const reasonInput = document.getElementById('correct-att-reason');

  if (statusSelect) statusSelect.value = item.status || 'Hadir';
  if (reasonInput) reasonInput.value = '';

  modal.classList.remove('hidden');

  const form = document.getElementById('form-correct-attendance');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const newStatus = statusSelect.value;
      const reason = reasonInput.value.trim();

      if (!reason) {
        showToast('warning', 'Alasan Wajib Diisi', 'Alasan koreksi status presensi wajib diisi untuk rekam audit.');
        return;
      }

      const btn = document.getElementById('btn-submit-correction');
      setButtonLoading(btn, true, 'Menyimpan...');

      try {
        await updateAttendanceStatus(docId, newStatus, reason, {
          nama: authState.adminDoc?.nama || authState.user.email,
          role: authState.role
        });

        showToast('success', 'Status Dikoreksi', `Status presensi ${item.nama} diubah menjadi ${newStatus}.`);
        modal.classList.add('hidden');
        await loadAttendanceTable(true);
      } catch (err) {
        showToast('error', 'Gagal Mengubah Status', err.message);
      } finally {
        setButtonLoading(btn, false);
      }
    };
  }
}

async function handleDeleteAttendance(docId) {
  const confirmed = await showConfirmDialog({
    title: 'Hapus Catatan Presensi?',
    message: 'Catatan presensi ini akan dihapus dari rekap kehadiran mahasiswa.',
    confirmText: 'Ya, Hapus',
    isDestructive: true
  });

  if (confirmed) {
    try {
      await deleteAttendanceRecord(docId);
      showToast('success', 'Dihapus', 'Catatan presensi berhasil dihapus.');
      await loadAttendanceTable(true);
    } catch (err) {
      showToast('error', 'Gagal Menghapus', err.message);
    }
  }
}
