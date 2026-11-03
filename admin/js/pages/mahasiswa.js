/**
 * Page Controller: Manajemen Mahasiswa
 * Tabel, Filter, Drawer Detail, Digital KTM, Import/Export Excel, & Aksi Massal
 */
import { 
  fetchStudents, 
  addStudentManual, 
  updateStudent, 
  deleteStudent,
  batchUpdateStudentStatus,
  batchDeleteStudents,
  importStudentsBatch
} from '../services/studentService.js';
import { getFacultyList, getAllProdiList } from '../data.js';
import { 
  escapeHtml, 
  formatDateWIB, 
  exportToExcel, 
  exportToCSV, 
  exportToPDF, 
  debounce,
  downloadFile
} from '../utils.js';
import { 
  showToast, 
  showConfirmDialog, 
  showDestructiveSecureDialog, 
  openDrawer, 
  closeDrawer,
  openProgressModal,
  updateProgressModal,
  closeProgressModal,
  setButtonLoading
} from '../ui.js';
import { authState } from '../auth.js';

let currentStudentsList = [];
let selectedStudentIds = new Set();
let lastVisibleDoc = null;
let currentFilters = {
  fakultas: 'all',
  prodi: 'all',
  angkatan: 'all',
  status: 'all',
  searchQuery: ''
};

export async function renderMahasiswaPage() {
  const container = document.getElementById('view-mahasiswa');
  if (!container) return;

  setupMahasiswaFilters();
  setupMahasiswaEventListeners();
  await loadStudentsTable(true);
}

function setupMahasiswaFilters() {
  const facSelect = document.getElementById('filter-mhs-fakultas');
  const prodiSelect = document.getElementById('filter-mhs-prodi');
  if (!facSelect || !prodiSelect) return;

  const faculties = getFacultyList();
  facSelect.innerHTML = '<option value="all">Semua Fakultas</option>' + 
    faculties.map(f => `<option value="${f.kode}">${f.kode} - ${f.nama}</option>`).join('');

  const updateProdi = (facKode) => {
    if (facKode === 'all') {
      prodiSelect.innerHTML = '<option value="all">Semua Program Studi</option>';
      return;
    }
    const faculty = faculties.find(f => f.kode === facKode);
    const prodis = faculty ? faculty.prodi : [];
    prodiSelect.innerHTML = '<option value="all">Semua Program Studi</option>' + 
      prodis.map(p => `<option value="${p.nama}">${p.nama}</option>`).join('');
  };

  facSelect.onchange = () => {
    currentFilters.fakultas = facSelect.value;
    updateProdi(facSelect.value);
    currentFilters.prodi = 'all';
    loadStudentsTable(true);
  };

  prodiSelect.onchange = () => {
    currentFilters.prodi = prodiSelect.value;
    loadStudentsTable(true);
  };

  const statusSelect = document.getElementById('filter-mhs-status');
  if (statusSelect) {
    statusSelect.onchange = () => {
      currentFilters.status = statusSelect.value;
      loadStudentsTable(true);
    };
  }

  const searchInput = document.getElementById('filter-mhs-search');
  if (searchInput) {
    searchInput.oninput = debounce(() => {
      currentFilters.searchQuery = searchInput.value;
      loadStudentsTable(true);
    }, 350);
  }
}

function setupMahasiswaEventListeners() {
  const btnAdd = document.getElementById('btn-add-mahasiswa');
  if (btnAdd) btnAdd.onclick = openAddStudentModal;

  const btnImport = document.getElementById('btn-import-mahasiswa');
  if (btnImport) btnImport.onclick = openImportStudentModal;

  const btnExport = document.getElementById('btn-export-mahasiswa');
  if (btnExport) btnExport.onclick = handleExportStudents;

  // Select all checkbox
  const checkAll = document.getElementById('check-all-students');
  if (checkAll) {
    checkAll.onchange = () => {
      const isChecked = checkAll.checked;
      document.querySelectorAll('.check-student-row').forEach(cb => {
        cb.checked = isChecked;
        const uid = cb.dataset.uid;
        if (isChecked) selectedStudentIds.add(uid);
        else selectedStudentIds.delete(uid);
      });
      updateBatchActionsBar();
    };
  }

  // Batch action buttons
  const btnBatchActive = document.getElementById('btn-batch-activate');
  const btnBatchDeactive = document.getElementById('btn-batch-deactivate');
  const btnBatchDelete = document.getElementById('btn-batch-delete');

  if (btnBatchActive) btnBatchActive.onclick = () => handleBatchStatus(true);
  if (btnBatchDeactive) btnBatchDeactive.onclick = () => handleBatchStatus(false);
  if (btnBatchDelete) btnBatchDelete.onclick = handleBatchDelete;
}

async function loadStudentsTable(isReset = false) {
  const tbody = document.getElementById('table-mahasiswa-body');
  if (!tbody) return;

  if (isReset) {
    lastVisibleDoc = null;
    selectedStudentIds.clear();
    updateBatchActionsBar();
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="padding: 40px; text-align: center; color: var(--slate-400);">
          <div class="spinner-border" style="width: 24px; height: 24px; margin: 0 auto 10px;"></div>
          <span>Memuat data mahasiswa UPNVJ...</span>
        </td>
      </tr>
    `;
  }

  try {
    const res = await fetchStudents({
      ...currentFilters,
      lastVisibleDoc: lastVisibleDoc,
      pageSize: 20
    });

    currentStudentsList = res.students;
    lastVisibleDoc = res.lastVisible;

    if (currentStudentsList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="padding: 48px 20px; text-align: center; color: var(--slate-400);">
            <i data-lucide="user-x" style="width: 36px; height: 36px; margin: 0 auto 10px; stroke-width: 1.5;"></i>
            <p style="font-weight: 600; font-size: 14px; margin: 0; color: var(--slate-600);">Tidak Ada Data Mahasiswa</p>
            <p style="font-size: 12px; margin: 4px 0 0 0;">Coba sesuaikan filter pencarian atau tambahkan mahasiswa baru.</p>
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    tbody.innerHTML = currentStudentsList.map(s => `
      <tr class="table-row-hover">
        <td style="width: 44px; text-align: center;">
          <input type="checkbox" class="form-checkbox check-student-row" data-uid="${s.uid || s.id}" ${selectedStudentIds.has(s.uid || s.id) ? 'checked' : ''}>
        </td>
        <td>
          <div class="user-cell">
            <div class="user-avatar-small">
              ${s.fotoURL ? `<img src="${s.fotoURL}" alt="Foto">` : (s.nama ? s.nama.charAt(0).toUpperCase() : 'M')}
            </div>
            <div>
              <div class="user-name">${escapeHtml(s.nama || 'Mahasiswa')}</div>
              <div class="user-email">${escapeHtml(s.email || '-')}</div>
            </div>
          </div>
        </td>
        <td class="font-mono text-bold">${escapeHtml(s.nim || '-')}</td>
        <td>
          <div style="font-weight: 600; color: var(--slate-900);">${escapeHtml(s.prodi || '-')}</div>
          <div style="font-size: 11px; color: var(--slate-400);">${escapeHtml(s.fakultas || '-')}</div>
        </td>
        <td>
          <span style="font-size: 12px; font-weight: 600;">Angkatan ${escapeHtml(s.angkatan || '-')}</span>
          <div style="font-size: 11px; color: var(--slate-400);">Semester ${escapeHtml(s.semester || '1')} (Kls ${escapeHtml(s.kelas || 'A')})</div>
        </td>
        <td>
          <span class="badge-status ${s.aktif !== false ? 'badge-active' : 'badge-inactive'}">
            ${s.aktif !== false ? 'Aktif' : 'Nonaktif'}
          </span>
        </td>
        <td style="text-align: right;">
          <div class="action-btn-group">
            <button type="button" class="btn-action-icon btn-view-student" data-uid="${s.uid || s.id}" title="Lihat Detail & KTM">
              <i data-lucide="eye" style="width: 15px; height: 15px;"></i>
            </button>
            <button type="button" class="btn-action-icon btn-edit-student" data-uid="${s.uid || s.id}" title="Edit Mahasiswa">
              <i data-lucide="edit-3" style="width: 15px; height: 15px;"></i>
            </button>
            <button type="button" class="btn-action-icon btn-delete-student" data-uid="${s.uid || s.id}" data-nim="${s.nim}" title="Hapus Data">
              <i data-lucide="trash-2" style="width: 15px; height: 15px; color: var(--rose-500);"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    // Pasang listener pada baris
    tbody.querySelectorAll('.check-student-row').forEach(cb => {
      cb.onchange = () => {
        const uid = cb.dataset.uid;
        if (cb.checked) selectedStudentIds.add(uid);
        else selectedStudentIds.delete(uid);
        updateBatchActionsBar();
      };
    });

    tbody.querySelectorAll('.btn-view-student').forEach(btn => {
      btn.onclick = () => openStudentDetailDrawer(btn.dataset.uid);
    });

    tbody.querySelectorAll('.btn-edit-student').forEach(btn => {
      btn.onclick = () => openEditStudentModal(btn.dataset.uid);
    });

    tbody.querySelectorAll('.btn-delete-student').forEach(btn => {
      btn.onclick = () => handleDeleteStudent(btn.dataset.uid, btn.dataset.nim);
    });

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('Error loading students table:', err);
    showToast('error', 'Gagal Memuat Mahasiswa', 'Terjadi gangguan saat mengambil data dari Firestore.');
  }
}

function updateBatchActionsBar() {
  const bar = document.getElementById('batch-actions-bar');
  const countEl = document.getElementById('batch-selected-count');
  if (!bar) return;

  if (selectedStudentIds.size > 0) {
    bar.classList.remove('hidden');
    if (countEl) countEl.textContent = `${selectedStudentIds.size} mahasiswa terpilih`;
  } else {
    bar.classList.add('hidden');
  }
}

/**
 * Drawer Detail Mahasiswa & Kartu Tanda Mahasiswa (KTM) Digital
 */
function openStudentDetailDrawer(uid) {
  const student = currentStudentsList.find(s => (s.uid || s.id) === uid);
  if (!student) return;

  const contentHtml = `
    <div style="padding: 16px 0;">
      <!-- KTM Digital Card -->
      <div class="ktm-card-render" style="margin-bottom: 24px;">
        <div class="ktm-header">
          <img src="assets/logo-upnvj.png" alt="Logo UPNVJ" style="width: 32px; height: 32px;" onerror="this.onerror=null; this.src='../assets/logo-upnvj.png';">
          <div>
            <div style="font-size: 11px; font-weight: 800; color: #ffffff; letter-spacing: 0.04em;">UPN "VETERAN" JAKARTA</div>
            <div style="font-size: 9px; color: #fbbf24;">KARTU TANDA MAHASISWA DIGITAL</div>
          </div>
        </div>
        <div class="ktm-body" style="display: flex; gap: 16px; margin: 14px 0;">
          <div class="ktm-photo-box" style="width: 72px; height: 90px; border-radius: 8px; background: #ffffff; overflow: hidden; display: flex; align-items: center; justify-content: center;">
            ${student.fotoURL ? `<img src="${student.fotoURL}" style="width: 100%; height: 100%; object-fit: cover;">` : `<span style="font-size: 24px; font-weight: 800; color: #0b2341;">${(student.nama || 'M').charAt(0)}</span>`}
          </div>
          <div style="flex: 1; color: #ffffff; font-size: 11px; line-height: 1.5;">
            <div style="font-size: 14px; font-weight: 800; color: #ffffff; margin-bottom: 2px;">${escapeHtml(student.nama)}</div>
            <div><strong>NIM:</strong> <span class="font-mono">${escapeHtml(student.nim)}</span></div>
            <div><strong>Fakultas:</strong> ${escapeHtml(student.fakultas)}</div>
            <div><strong>Program Studi:</strong> ${escapeHtml(student.prodi)}</div>
            <div><strong>Status:</strong> ${student.aktif !== false ? 'Aktif' : 'Nonaktif'}</div>
          </div>
        </div>
        <div class="ktm-barcode-container" style="background: #ffffff; padding: 6px; border-radius: 6px; text-align: center;">
          <svg id="drawer-ktm-barcode" style="width: 100%; height: 44px;"></svg>
        </div>
      </div>

      <!-- Detail Biodata -->
      <h4 style="font-size: 14px; font-weight: 700; color: var(--slate-900); margin: 0 0 12px 0;">Informasi Lengkap</h4>
      <div class="detail-grid">
        <div class="detail-item"><span class="detail-label">Email Institusi:</span><span class="detail-value">${escapeHtml(student.email || '-')}</span></div>
        <div class="detail-item"><span class="detail-label">Nomor WhatsApp:</span><span class="detail-value">${escapeHtml(student.noHp || '-')}</span></div>
        <div class="detail-item"><span class="detail-label">Semester / Kelas:</span><span class="detail-value">Semester ${escapeHtml(student.semester || '1')} (${escapeHtml(student.kelas || 'A')})</span></div>
        <div class="detail-item"><span class="detail-label">Tempat, Tgl Lahir:</span><span class="detail-value">${escapeHtml(student.tempatLahir || '-')}, ${formatDateWIB(student.tanggalLahir)}</span></div>
        <div class="detail-item"><span class="detail-label">Alamat Domisili:</span><span class="detail-value">${escapeHtml(student.alamat || '-')}</span></div>
        <div class="detail-item"><span class="detail-label">Kelengkapan Profil:</span><span class="detail-value">${student.profileComplete ? 'Lengkap (100%)' : 'Belum Lengkap'}</span></div>
      </div>
    </div>
  `;

  const footerHtml = `
    <button type="button" class="btn-portal btn-secondary" onclick="window.print()">
      <i data-lucide="printer" style="width: 15px; height: 15px;"></i>
      <span>Cetak KTM</span>
    </button>
  `;

  openDrawer(`Mahasiswa: ${student.nama}`, contentHtml, footerHtml);

  // Render Barcode via JsBarcode
  setTimeout(() => {
    if (window.JsBarcode && student.nim) {
      try {
        window.JsBarcode('#drawer-ktm-barcode', student.nim, {
          format: 'CODE128',
          lineColor: '#0b2341',
          width: 2,
          height: 38,
          displayValue: true,
          fontSize: 11,
          font: 'monospace'
        });
      } catch (e) {
        console.warn('Gagal render barcode di drawer:', e);
      }
    }
  }, 100);
}

/**
 * Modal Tambah Mahasiswa Manual
 */
function openAddStudentModal() {
  const modal = document.getElementById('modal-add-student');
  if (!modal) return;

  const facSelect = document.getElementById('add-mhs-fakultas');
  const prodiSelect = document.getElementById('add-mhs-prodi');
  const faculties = getFacultyList();

  if (facSelect) {
    facSelect.innerHTML = '<option value="">Pilih Fakultas</option>' + 
      faculties.map(f => `<option value="${f.kode}">${f.kode} - ${f.nama}</option>`).join('');

    facSelect.onchange = () => {
      const selected = faculties.find(f => f.kode === facSelect.value);
      if (prodiSelect) {
        prodiSelect.innerHTML = '<option value="">Pilih Program Studi</option>' +
          (selected ? selected.prodi.map(p => `<option value="${p.nama}">${p.nama}</option>`).join('') : '');
      }
    };
  }

  modal.classList.remove('hidden');

  const form = document.getElementById('form-add-student');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-submit-add-mhs');
      setButtonLoading(btn, true, 'Menyimpan...');

      try {
        const payload = {
          nama: document.getElementById('add-mhs-nama').value,
          nim: document.getElementById('add-mhs-nim').value,
          fakultas: document.getElementById('add-mhs-fakultas').value,
          prodi: document.getElementById('add-mhs-prodi').value,
          angkatan: document.getElementById('add-mhs-angkatan').value,
          semester: document.getElementById('add-mhs-semester').value,
          kelas: document.getElementById('add-mhs-kelas').value
        };

        await addStudentManual(payload);
        showToast('success', 'Berhasil', `Mahasiswa ${payload.nama} (${payload.nim}) berhasil ditambahkan.`);
        modal.classList.add('hidden');
        form.reset();
        await loadStudentsTable(true);
      } catch (err) {
        showToast('error', 'Gagal Menambah Mahasiswa', err.message);
      } finally {
        setButtonLoading(btn, false);
      }
    };
  }
}

/**
 * Modal Import Excel/CSV dengan Validasi Baris & Unduhan Laporan Gagal
 */
function openImportStudentModal() {
  const modal = document.getElementById('modal-import-student');
  if (!modal) return;
  modal.classList.remove('hidden');

  const fileInput = document.getElementById('import-student-file');
  const btnProcess = document.getElementById('btn-process-import');
  const templateBtn = document.getElementById('btn-download-import-template');

  if (templateBtn) {
    templateBtn.onclick = () => {
      const templateData = [
        { NIM: "2110511001", Nama: "Ahmad Fauzan", Fakultas: "FIK", Prodi: "S1 Sistem Informasi", Angkatan: "2022", Semester: "6", Kelas: "A" },
        { NIM: "2110511002", Nama: "Nabila Putri", Fakultas: "FEB", Prodi: "S1 Manajemen", Angkatan: "2023", Semester: "4", Kelas: "B" },
        { NIM: "2110511003", Nama: "Budi Santoso", Fakultas: "FK", Prodi: "S1 Kedokteran", Angkatan: "2021", Semester: "8", Kelas: "A" }
      ];
      exportToExcel(templateData, 'Template_Import_Mahasiswa_UPNVJ.xlsx', 'Template');
      showToast('info', 'Template Diunduh', 'File Excel template import mahasiswa berhasil diunduh.');
    };
  }

  if (btnProcess) {
    btnProcess.onclick = async () => {
      const file = fileInput.files[0];
      if (!file) {
        showToast('warning', 'Pilih File', 'Silakan unggah file Excel (.xlsx) atau CSV terlebih dahulu.');
        return;
      }

      setButtonLoading(btnProcess, true, 'Membaca File...');
      openProgressModal('Memproses Import Mahasiswa...');

      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = window.XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawRows = window.XLSX.utils.sheet_to_json(firstSheet);

            if (rawRows.length === 0) {
              closeProgressModal();
              showToast('error', 'File Kosong', 'File yang diunggah tidak memiliki data baris.');
              return;
            }

            const result = await importStudentsBatch(rawRows, (percent, status) => {
              updateProgressModal(percent, status);
            });

            closeProgressModal();
            modal.classList.add('hidden');

            if (result.failedCount > 0) {
              showToast('warning', 'Import Selesai dengan Catatan', `${result.successCount} berhasil, ${result.failedCount} gagal.`);
              // Unduh laporan baris gagal
              exportToExcel(result.failedRows, 'Laporan_Gagal_Import_Mahasiswa.xlsx', 'Baris Gagal');
            } else {
              showToast('success', 'Import Berhasil Sempurna', `Sebanyak ${result.successCount} mahasiswa berhasil disimpan.`);
            }

            await loadStudentsTable(true);
          } catch (readErr) {
            closeProgressModal();
            showToast('error', 'Format File Rusak', readErr.message);
          } finally {
            setButtonLoading(btnProcess, false);
          }
        };
        reader.readAsArrayBuffer(file);
      } catch (err) {
        closeProgressModal();
        setButtonLoading(btnProcess, false);
        showToast('error', 'Gagal Import', err.message);
      }
    };
  }
}

async function handleDeleteStudent(uid, nim) {
  const confirmed = await showDestructiveSecureDialog({
    title: 'Hapus Data Mahasiswa?',
    message: `Mahasiswa dengan NIM ${nim} akan dihapus secara permanen dari basis data kampus.`,
    targetKeyword: 'HAPUS'
  });

  if (confirmed) {
    try {
      await deleteStudent(uid, nim);
      showToast('success', 'Dihapus', `Data mahasiswa NIM ${nim} berhasil dihapus.`);
      await loadStudentsTable(true);
    } catch (err) {
      showToast('error', 'Gagal Menghapus', err.message);
    }
  }
}

async function handleBatchStatus(isActive) {
  if (selectedStudentIds.size === 0) return;
  const label = isActive ? 'mengaktifkan' : 'menonaktifkan';
  const confirm = await showConfirmDialog({
    title: `Ubah Status Massal?`,
    message: `Apakah Anda yakin ingin ${label} ${selectedStudentIds.size} mahasiswa yang dipilih?`,
    confirmText: 'Ya, Terapkan'
  });

  if (confirm) {
    try {
      await batchUpdateStudentStatus(Array.from(selectedStudentIds), isActive);
      showToast('success', 'Status Diperbarui', `Berhasil ${label} mahasiswa terpilih.`);
      await loadStudentsTable(true);
    } catch (err) {
      showToast('error', 'Gagal', err.message);
    }
  }
}

async function handleBatchDelete() {
  if (selectedStudentIds.size === 0) return;
  const confirm = await showDestructiveSecureDialog({
    title: `Hapus Massal ${selectedStudentIds.size} Mahasiswa?`,
    message: 'Tindakan ini akan menghapus data profil dan indeks NIM secara permanen.',
    targetKeyword: 'HAPUS'
  });

  if (confirm) {
    try {
      const selectedStudents = currentStudentsList.filter(s => selectedStudentIds.has(s.uid || s.id));
      await batchDeleteStudents(selectedStudents);
      showToast('success', 'Dihapus', `${selectedStudents.length} mahasiswa berhasil dihapus permanen.`);
      await loadStudentsTable(true);
    } catch (err) {
      showToast('error', 'Gagal', err.message);
    }
  }
}

function handleExportStudents() {
  if (currentStudentsList.length === 0) {
    showToast('warning', 'Tidak Ada Data', 'Tidak ada data mahasiswa untuk diekspor.');
    return;
  }

  const exportData = currentStudentsList.map((s, idx) => ({
    No: idx + 1,
    NIM: s.nim || '',
    Nama: s.nama || '',
    Email: s.email || '',
    Fakultas: s.fakultas || '',
    Prodi: s.prodi || '',
    Angkatan: s.angkatan || '',
    Semester: s.semester || '',
    Kelas: s.kelas || '',
    Status: s.aktif !== false ? 'Aktif' : 'Nonaktif'
  }));

  exportToExcel(exportData, `Daftar_Mahasiswa_UPNVJ_${new Date().toISOString().split('T')[0]}.xlsx`, 'Mahasiswa');
  showToast('success', 'Ekspor Selesai', 'Data mahasiswa berhasil diekspor ke Excel.');
}
