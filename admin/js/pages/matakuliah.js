/**
 * Page Controller: Manajemen Mata Kuliah
 * Universitas Pembangunan Nasional "Veteran" Jakarta
 */
import { 
  fetchCourses, 
  addCourse, 
  updateCourse, 
  deleteCourse, 
  getCourseStudentsRoster 
} from '../services/courseService.js';
import { getFacultyList } from '../data.js';
import { escapeHtml, exportToExcel } from '../utils.js';
import { showToast, showConfirmDialog, openDrawer, setButtonLoading } from '../ui.js';
import { authState } from '../auth.js';

let coursesList = [];

export async function renderMatakuliahPage() {
  const container = document.getElementById('view-matakuliah');
  if (!container) return;

  setupMatakuliahEventListeners();
  await loadCoursesTable();
}

function setupMatakuliahEventListeners() {
  const btnAdd = document.getElementById('btn-add-course');
  if (btnAdd) btnAdd.onclick = openAddCourseModal;

  const btnExport = document.getElementById('btn-export-courses');
  if (btnExport) {
    btnExport.onclick = () => {
      if (coursesList.length === 0) return;
      const exportData = coursesList.map((c, i) => ({
        No: i + 1,
        Kode: c.kode,
        Nama: c.nama,
        SKS: c.sks,
        Fakultas: c.fakultas,
        Prodi: c.prodi,
        Semester: c.semester,
        Kelas: c.kelas || 'A',
        Dosen: c.dosenNama || '-',
        Jadwal: `${c.hari || ''} ${c.jamMulai || ''}-${c.jamSelesai || ''}`,
        Ruang: c.ruangan || '-'
      }));
      exportToExcel(exportData, `Mata_Kuliah_UPNVJ_${new Date().toISOString().split('T')[0]}.xlsx`, 'Mata Kuliah');
      showToast('success', 'Ekspor Selesai', 'Data mata kuliah berhasil diunduh.');
    };
  }
}

async function loadCoursesTable() {
  const tbody = document.getElementById('table-courses-body');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="7" style="padding: 40px; text-align: center; color: var(--slate-400);">
        <div class="spinner-border" style="width: 24px; height: 24px; margin: 0 auto 10px;"></div>
        <span>Memuat kurikulum mata kuliah...</span>
      </td>
    </tr>
  `;

  try {
    coursesList = await fetchCourses({
      fakultas: authState.fakultas || 'all',
      prodi: authState.prodi || 'all',
      dosenUid: authState.role === 'dosen' ? authState.user.uid : null
    });

    if (coursesList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="padding: 48px; text-align: center; color: var(--slate-400);">
            <i data-lucide="book-open" style="width: 36px; height: 36px; margin: 0 auto 10px; stroke-width: 1.5;"></i>
            <p style="font-weight: 600; font-size: 14px; margin: 0; color: var(--slate-600);">Belum Ada Mata Kuliah</p>
            <p style="font-size: 12px; margin: 4px 0 0 0;">Klik "Tambah Mata Kuliah" untuk menjadwalkan kelas.</p>
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    tbody.innerHTML = coursesList.map(c => `
      <tr class="table-row-hover">
        <td class="font-mono text-bold">${escapeHtml(c.kode)}</td>
        <td>
          <div style="font-weight: 700; color: var(--slate-900);">${escapeHtml(c.nama)}</div>
          <div style="font-size: 11px; color: var(--slate-400);">${escapeHtml(c.sks || 2)} SKS • Semester ${escapeHtml(c.semester || '1')} (Kls ${escapeHtml(c.kelas || 'A')})</div>
        </td>
        <td>
          <div style="font-weight: 600; color: var(--navy-900);">${escapeHtml(c.prodi)}</div>
          <div style="font-size: 11px; color: var(--slate-400);">${escapeHtml(c.fakultas)}</div>
        </td>
        <td style="font-size: 12px; color: var(--slate-700);">
          ${escapeHtml(c.dosenNama || 'Dosen Pengampu')}
        </td>
        <td style="font-size: 12px;">
          <div><strong>${escapeHtml(c.hari || 'Senin')},</strong> ${escapeHtml(c.jamMulai || '08:00')} - ${escapeHtml(c.jamSelesai || '09:40')}</div>
          <div style="font-size: 11px; color: var(--slate-400);">Ruang ${escapeHtml(c.ruangan || 'Gd. Wahidin')}</div>
        </td>
        <td>
          <span class="badge-status ${c.aktif !== false ? 'badge-active' : 'badge-inactive'}">
            ${c.aktif !== false ? 'Aktif' : 'Nonaktif'}
          </span>
        </td>
        <td style="text-align: right;">
          <div class="action-btn-group">
            <button type="button" class="btn-action-icon btn-view-roster" data-id="${c.id}" title="Lihat Daftar Peserta">
              <i data-lucide="users" style="width: 15px; height: 15px;"></i>
            </button>
            <button type="button" class="btn-action-icon btn-delete-course" data-id="${c.id}" title="Hapus Mata Kuliah">
              <i data-lucide="trash-2" style="width: 15px; height: 15px; color: var(--rose-500);"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-view-roster').forEach(btn => {
      btn.onclick = () => openCourseRosterDrawer(btn.dataset.id);
    });

    tbody.querySelectorAll('.btn-delete-course').forEach(btn => {
      btn.onclick = () => handleDeleteCourse(btn.dataset.id);
    });

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('Error loading courses table:', err);
    showToast('error', 'Gagal Memuat Mata Kuliah', err.message);
  }
}

/**
 * Drawer Daftar Peserta Mahasiswa
 */
async function openCourseRosterDrawer(courseId) {
  const course = coursesList.find(c => c.id === courseId);
  if (!course) return;

  openDrawer(`Peserta: ${course.nama}`, '<div style="padding: 24px; text-align: center;"><div class="spinner-border"></div> Memuat peserta...</div>');

  try {
    const students = await getCourseStudentsRoster(course);

    const contentHtml = `
      <div style="padding: 16px 0;">
        <div style="background: var(--navy-50); padding: 12px 16px; border-radius: 10px; margin-bottom: 16px; font-size: 12px; color: var(--navy-900);">
          <strong>${course.nama}</strong> (${course.kode})<br>
          ${course.prodi} • Semester ${course.semester} (Kelas ${course.kelas || 'A'})<br>
          Total Peserta Terdaftar: <strong>${students.length} Mahasiswa</strong>
        </div>

        ${students.length === 0 ? `
          <div style="padding: 32px; text-align: center; color: var(--slate-400);">Belum ada mahasiswa yang cocok dengan kriteria semester/kelas ini.</div>
        ` : `
          <div style="max-height: 480px; overflow-y: auto;">
            <table class="table-portal" style="font-size: 12px;">
              <thead>
                <tr>
                  <th>No</th>
                  <th>NIM</th>
                  <th>Nama Mahasiswa</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${students.map((s, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td class="font-mono text-bold">${escapeHtml(s.nim)}</td>
                    <td style="font-weight: 600;">${escapeHtml(s.nama)}</td>
                    <td><span class="badge-status badge-active">Terdaftar</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;

    openDrawer(`Peserta: ${course.nama}`, contentHtml);
  } catch (err) {
    showToast('error', 'Gagal Memuat Peserta', err.message);
  }
}

function openAddCourseModal() {
  const modal = document.getElementById('modal-add-course');
  if (!modal) return;
  modal.classList.remove('hidden');

  const facSelect = document.getElementById('course-input-fakultas');
  const prodiSelect = document.getElementById('course-input-prodi');
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

  const form = document.getElementById('form-add-course');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-submit-add-course');
      setButtonLoading(btn, true, 'Menyimpan...');

      try {
        const payload = {
          kode: document.getElementById('course-input-kode').value.trim(),
          nama: document.getElementById('course-input-nama').value.trim(),
          sks: Number(document.getElementById('course-input-sks').value || 2),
          fakultas: document.getElementById('course-input-fakultas').value,
          prodi: document.getElementById('course-input-prodi').value,
          semester: document.getElementById('course-input-semester').value,
          kelas: document.getElementById('course-input-kelas').value || 'A',
          dosenNama: document.getElementById('course-input-dosen').value || 'Dosen Pengampu',
          hari: document.getElementById('course-input-hari').value || 'Senin',
          jamMulai: document.getElementById('course-input-jammulai').value || '08:00',
          jamSelesai: document.getElementById('course-input-jamselesai').value || '09:40',
          ruangan: document.getElementById('course-input-ruangan').value || 'Gd. Wahidin 302',
          tahunAkademik: '2026/2027',
          aktif: true
        };

        await addCourse(payload);
        showToast('success', 'Mata Kuliah Ditambahkan', `${payload.kode} - ${payload.nama} berhasil dijadwalkan.`);
        modal.classList.add('hidden');
        form.reset();
        await loadCoursesTable();
      } catch (err) {
        showToast('error', 'Gagal Menambah Mata Kuliah', err.message);
      } finally {
        setButtonLoading(btn, false);
      }
    };
  }
}

async function handleDeleteCourse(courseId) {
  const confirmed = await showConfirmDialog({
    title: 'Hapus Mata Kuliah?',
    message: 'Mata kuliah ini akan dihapus dari kurikulum aktif.',
    confirmText: 'Ya, Hapus',
    isDestructive: true
  });

  if (confirmed) {
    try {
      await deleteCourse(courseId);
      showToast('success', 'Dihapus', 'Mata kuliah berhasil dihapus.');
      await loadCoursesTable();
    } catch (err) {
      showToast('error', 'Gagal Menghapus', err.message);
    }
  }
}
