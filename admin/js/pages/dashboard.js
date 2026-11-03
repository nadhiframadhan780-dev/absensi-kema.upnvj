/**
 * Page Controller: Dashboard Admin UPNVJ
 * Metrik Real-time, Chart.js, & Live Attendance Feed
 */
import { db, collection, getDocs, query, where, limit, orderBy } from '../firebase.js';
import { authState } from '../auth.js';
import { getTodayWIB, escapeHtml, formatTimeWIB } from '../utils.js';

let chartTrend = null;
let chartFakultas = null;
let chartStatus = null;
let chartMetode = null;

export async function renderDashboardPage() {
  const container = document.getElementById('view-dashboard');
  if (!container) return;

  const today = getTodayWIB();

  try {
    // 1. Ambil data presensi hari ini
    const attTodaySnap = await getDocs(query(
      collection(db, 'attendance'),
      where('tanggal', '==', today)
    ));
    const attTodayList = attTodaySnap.docs.map(d => d.data());

    // 2. Ambil total mahasiswa aktif
    const studSnap = await getDocs(query(collection(db, 'students'), where('aktif', '==', true), limit(1000)));
    const totalStudents = studSnap.size;

    // 3. Ambil sesi berlangsung
    const sessionSnap = await getDocs(query(
      collection(db, 'sessions'),
      where('status', '==', 'Dibuka')
    ));
    const activeSessionsCount = sessionSnap.size;

    // 4. Ambil pengajuan izin menunggu
    const leaveSnap = await getDocs(query(
      collection(db, 'leaveRequests'),
      where('status', '==', 'Menunggu')
    ));
    const pendingLeaveCount = leaveSnap.size;

    // 5. Hitung metrik
    const totalHadirHariIni = attTodayList.length;
    const persentaseKehadiran = totalStudents > 0 
      ? Math.min(100, Math.round((totalHadirHariIni / totalStudents) * 100)) 
      : 0;

    // Render Kartu Statistik
    document.getElementById('stat-total-mahasiswa').textContent = totalStudents.toLocaleString('id-ID');
    document.getElementById('stat-kehadiran-hari-ini').textContent = totalHadirHariIni.toLocaleString('id-ID');
    document.getElementById('stat-persen-kehadiran').textContent = `${persentaseKehadiran}%`;
    document.getElementById('stat-sesi-aktif').textContent = activeSessionsCount.toLocaleString('id-ID');
    document.getElementById('stat-izin-menunggu').textContent = pendingLeaveCount.toLocaleString('id-ID');

    // Render Live Feed Presensi Terbaru
    renderRecentAttendanceFeed(attTodayList);

    // Inisialisasi Grafik Chart.js
    renderDashboardCharts(attTodayList);
  } catch (err) {
    console.error('Error rendering dashboard:', err);
  }
}

function renderRecentAttendanceFeed(attList) {
  const feedList = document.getElementById('dashboard-live-feed');
  if (!feedList) return;

  if (attList.length === 0) {
    feedList.innerHTML = `
      <div style="padding: 24px; text-align: center; color: var(--slate-400);">
        <i data-lucide="clock" style="width: 28px; height: 28px; margin: 0 auto 6px;"></i>
        <p style="font-size: 13px; margin: 0;">Belum ada presensi tercatat hari ini.</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  feedList.innerHTML = attList.slice(0, 7).map(item => `
    <div class="feed-item">
      <div class="feed-avatar">${escapeHtml(item.nama ? item.nama.charAt(0).toUpperCase() : 'M')}</div>
      <div class="feed-info">
        <div class="feed-title">${escapeHtml(item.nama || 'Mahasiswa')} <span class="feed-nim">(${escapeHtml(item.nim)})</span></div>
        <div class="feed-subtitle">${escapeHtml(item.mataKuliah || 'Kuliah')} • ${escapeHtml(item.prodi || '-')}</div>
      </div>
      <div class="feed-time">
        <span class="badge-status badge-${(item.status || 'Hadir').toLowerCase()}">${escapeHtml(item.status || 'Hadir')}</span>
        <div style="font-size: 10px; color: var(--slate-400); margin-top: 2px;">${escapeHtml(item.waktu || 'Hari ini')}</div>
      </div>
    </div>
  `).join('');

  if (window.lucide) window.lucide.createIcons();
}

function renderDashboardCharts(attList) {
  if (!window.Chart) return;

  // Chart Status Kehadiran (Doughnut)
  const ctxStatus = document.getElementById('chart-status-kehadiran')?.getContext('2d');
  if (ctxStatus) {
    if (chartStatus) chartStatus.destroy();
    const counts = { Hadir: 0, Terlambat: 0, Izin: 0, Sakit: 0, Alpa: 0 };
    attList.forEach(a => {
      const s = a.status || 'Hadir';
      if (counts[s] !== undefined) counts[s]++;
      else counts.Hadir++;
    });

    chartStatus = new window.Chart(ctxStatus, {
      type: 'doughnut',
      data: {
        labels: ['Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpa'],
        datasets: [{
          data: [counts.Hadir, counts.Terlambat, counts.Izin, counts.Sakit, counts.Alpa],
          backgroundColor: ['#10b981', '#f59e0b', '#0284c7', '#8b5cf6', '#ef4444'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
        },
        cutout: '68%'
      }
    });
  }

  // Chart Metode Scan vs Manual (Pie)
  const ctxMetode = document.getElementById('chart-metode-absen')?.getContext('2d');
  if (ctxMetode) {
    if (chartMetode) chartMetode.destroy();
    let scanCount = 0;
    let manualCount = 0;
    attList.forEach(a => {
      if (a.metode === 'scan' || a.metode === 'scan-admin') scanCount++;
      else manualCount++;
    });

    chartMetode = new window.Chart(ctxMetode, {
      type: 'pie',
      data: {
        labels: ['Scan Barcode / QR', 'Input Manual / Sistem'],
        datasets: [{
          data: [scanCount || 1, manualCount],
          backgroundColor: ['#0b2341', '#f59e0b'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
        }
      }
    });
  }

  // Chart Kehadiran per Fakultas (Bar)
  const ctxFakultas = document.getElementById('chart-fakultas')?.getContext('2d');
  if (ctxFakultas) {
    if (chartFakultas) chartFakultas.destroy();
    const facCounts = { FEB: 0, FK: 0, FISIP: 0, FIK: 0, FT: 0, FH: 0, FIKES: 0 };
    attList.forEach(a => {
      const f = (a.fakultas || '').toUpperCase();
      if (facCounts[f] !== undefined) facCounts[f]++;
    });

    chartFakultas = new window.Chart(ctxFakultas, {
      type: 'bar',
      data: {
        labels: Object.keys(facCounts),
        datasets: [{
          label: 'Presensi Hari Ini',
          data: Object.values(facCounts),
          backgroundColor: '#0b2341',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
          x: { grid: { display: false } }
        }
      }
    });
  }
}
