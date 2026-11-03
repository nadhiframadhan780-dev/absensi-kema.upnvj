/**
 * Page Controller: Laporan & Rekapitulasi Presensi Akademik UPNVJ
 * Matriks Mahasiswa x Pertemuan 1-16, Ambang UAS < 75%, Ekspor PDF Resmi & Excel
 */
import { fetchCourses, getCourseStudentsRoster } from '../services/courseService.js';
import { db, collection, getDocs, query, where } from '../firebase.js';
import { 
  escapeHtml, 
  exportToExcel, 
  exportToCSV, 
  exportToPDF, 
  formatDateTimeWIB 
} from '../utils.js';
import { showToast, setButtonLoading } from '../ui.js';
import { authState } from '../auth.js';

let availableCourses = [];
let currentMatrixData = [];

export async function renderLaporanPage() {
  const container = document.getElementById('view-laporan');
  if (!container) return;

  setupLaporanEventListeners();
  await loadCoursesForLaporan();
}

async function loadCoursesForLaporan() {
  try {
    availableCourses = await fetchCourses({
      fakultas: authState.fakultas || 'all',
      prodi: authState.prodi || 'all',
      dosenUid: authState.role === 'dosen' ? authState.user.uid : null
    });

    const select = document.getElementById('laporan-course-select');
    if (select) {
      select.innerHTML = '<option value="">-- Pilih Mata Kuliah untuk Rekap Matriks --</option>' +
        availableCourses.map(c => `<option value="${c.id}">${c.kode} - ${c.nama} (Kelas ${c.kelas || 'A'})</option>`).join('');

      select.onchange = () => {
        if (select.value) generateCourseMatrix(select.value);
      };
    }
  } catch (e) {
    console.warn('Gagal memuat mata kuliah di laporan:', e);
  }
}

function setupLaporanEventListeners() {
  const btnExcel = document.getElementById('btn-export-laporan-excel');
  const btnPdf = document.getElementById('btn-export-laporan-pdf');
  const btnPrint = document.getElementById('btn-print-laporan');
  const filterUas = document.getElementById('filter-laporan-uas-threshold');

  if (btnExcel) btnExcel.onclick = handleExportExcel;
  if (btnPdf) btnPdf.onclick = handleExportPdf;
  if (btnPrint) btnPrint.onclick = () => window.print();

  if (filterUas) {
    filterUas.onchange = () => {
      renderMatrixTable(currentMatrixData, filterUas.checked);
    };
  }
}

/**
 * Generate Matriks Kehadiran: Mahasiswa x Pertemuan 1 s/d 16
 */
async function generateCourseMatrix(courseId) {
  const course = availableCourses.find(c => c.id === courseId);
  if (!course) return;

  const tbody = document.getElementById('table-matrix-body');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="21" style="padding: 40px; text-align: center; color: var(--slate-400);">
        <div class="spinner-border" style="width: 24px; height: 24px; margin: 0 auto 10px;"></div>
        <span>Menghitung rekap presensi pertemuan 1 - 16...</span>
      </td>
    </tr>
  `;

  try {
    // 1. Ambil roster mahasiswa
    const roster = await getCourseStudentsRoster(course);

    // 2. Ambil seluruh data absensi untuk mata kuliah ini
    const attSnap = await getDocs(query(
      collection(db, 'attendance'),
      where('kodeMk', '==', course.kode)
    ));
    const attList = attSnap.docs.map(d => d.data());

    // 3. Susun matriks
    currentMatrixData = roster.map(student => {
      const studentAtts = attList.filter(a => a.nim === student.nim);

      const meetings = {};
      let totalHadir = 0;

      for (let m = 1; m <= 16; m++) {
        const found = studentAtts.find(a => Number(a.pertemuan) === m);
        if (found) {
          const s = found.status || 'Hadir';
          meetings[m] = s;
          if (s === 'Hadir' || s === 'Terlambat') totalHadir++;
        } else {
          meetings[m] = '-';
        }
      }

      const percentage = Math.round((totalHadir / 16) * 100);
      const isEligibleUas = percentage >= 75;

      return {
        nim: student.nim,
        nama: student.nama,
        prodi: student.prodi,
        meetings,
        totalHadir,
        percentage,
        isEligibleUas
      };
    });

    renderMatrixTable(currentMatrixData, false);
  } catch (err) {
    console.error('Error generating course matrix:', err);
    showToast('error', 'Gagal Membuat Matriks', err.message);
  }
}

function renderMatrixTable(matrixData, showOnlyFailedUas = false) {
  const tbody = document.getElementById('table-matrix-body');
  if (!tbody) return;

  let displayData = matrixData;
  if (showOnlyFailedUas) {
    displayData = matrixData.filter(d => !d.isEligibleUas);
  }

  if (displayData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="21" style="padding: 40px; text-align: center; color: var(--slate-400);">
          <i data-lucide="award" style="width: 32px; height: 32px; margin: 0 auto 8px; color: #10b981;"></i>
          <p style="font-size: 13px; font-weight: 600; margin: 0;">Semua Mahasiswa Memenuhi Syarat UAS</p>
        </td>
      </tr>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  tbody.innerHTML = displayData.map((row, idx) => {
    let meetingCells = '';
    for (let m = 1; m <= 16; m++) {
      const val = row.meetings[m] || '-';
      let badgeClass = 'matrix-empty';
      let symbol = '-';

      if (val === 'Hadir') { badgeClass = 'matrix-h'; symbol = 'H'; }
      else if (val === 'Terlambat') { badgeClass = 'matrix-t'; symbol = 'T'; }
      else if (val === 'Izin') { badgeClass = 'matrix-i'; symbol = 'I'; }
      else if (val === 'Sakit') { badgeClass = 'matrix-s'; symbol = 'S'; }
      else if (val === 'Alpa') { badgeClass = 'matrix-a'; symbol = 'A'; }

      meetingCells += `<td class="text-center matrix-cell"><span class="${badgeClass}">${symbol}</span></td>`;
    }

    return `
      <tr class="table-row-hover">
        <td class="text-center" style="font-size: 12px; color: var(--slate-400);">${idx + 1}</td>
        <td class="font-mono text-bold">${escapeHtml(row.nim)}</td>
        <td style="font-weight: 700; color: var(--slate-900);">${escapeHtml(row.nama)}</td>
        ${meetingCells}
        <td class="text-center font-bold" style="color: var(--navy-900);">${row.totalHadir}/16</td>
        <td class="text-center">
          <span class="badge-status ${row.percentage >= 75 ? 'badge-hadir' : 'badge-alpa'}">
            ${row.percentage}%
          </span>
        </td>
        <td class="text-center">
          <span style="font-size: 11px; font-weight: 700; color: ${row.isEligibleUas ? '#059669' : '#dc2626'};">
            ${row.isEligibleUas ? 'Memenuhi' : 'Tidak Memenuhi UAS'}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

function handleExportExcel() {
  if (currentMatrixData.length === 0) {
    showToast('warning', 'Pilih Mata Kuliah', 'Silakan pilih mata kuliah dan buat matriks terlebih dahulu.');
    return;
  }

  const exportRows = currentMatrixData.map((d, i) => {
    const row = {
      No: i + 1,
      NIM: d.nim,
      Nama: d.nama,
      Prodi: d.prodi
    };
    for (let m = 1; m <= 16; m++) {
      row[`P${m}`] = d.meetings[m];
    }
    row['Total Hadir'] = `${d.totalHadir}/16`;
    row['Persen Kehadiran'] = `${d.percentage}%`;
    row['Kelayakan UAS'] = d.isEligibleUas ? 'Memenuhi Syarat' : 'Tidak Memenuhi (<75%)';
    return row;
  });

  exportToExcel(exportRows, `Rekap_Presensi_Matriks_UPNVJ_${new Date().toISOString().split('T')[0]}.xlsx`, 'Rekap Presensi');
  showToast('success', 'Ekspor Excel Selesai', 'Rekapitulasi matriks berhasil disimpan.');
}

function handleExportPdf() {
  if (currentMatrixData.length === 0) {
    showToast('warning', 'Pilih Mata Kuliah', 'Silakan pilih mata kuliah dan buat matriks terlebih dahulu.');
    return;
  }

  const columns = ['No', 'NIM', 'Nama Mahasiswa', 'Hadir', '% Kehadiran', 'Syarat UAS'];
  const rows = currentMatrixData.map((d, i) => [
    i + 1,
    d.nim,
    d.nama,
    `${d.totalHadir}/16`,
    `${d.percentage}%`,
    d.isEligibleUas ? 'Memenuhi' : 'Gugur UAS (<75%)'
  ]);

  exportToPDF({
    title: 'REKAPITULASI KEHADIRAN MAHASISWA & KELAYAKAN UAS',
    subtitle: `Tahun Akademik 2026/2027 · Dicetak pada: ${formatDateTimeWIB(new Date())}`,
    columns: columns,
    rows: rows,
    filename: `Laporan_Rekap_UAS_UPNVJ_${new Date().toISOString().split('T')[0]}.pdf`,
    signerName: authState.adminDoc?.nama || 'Koordinator Program Studi'
  });

  showToast('success', 'Laporan PDF Siap', 'File PDF resmi berkop surat UPNVJ berhasil diunduh.');
}
