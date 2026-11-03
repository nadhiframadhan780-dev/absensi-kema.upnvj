/**
 * Page Controller: Pengaturan Sistem, Geofencing, Backup JSON, Arsip Semester & Reset
 * Universitas Pembangunan Nasional "Veteran" Jakarta
 */
import { 
  fetchSystemSettings, 
  saveSystemSettings, 
  backupCollectionToJson, 
  archiveSemesterAttendance, 
  resetAttendanceData 
} from '../services/settingsService.js';
import { 
  showToast, 
  showConfirmDialog, 
  showDestructiveSecureDialog, 
  setButtonLoading 
} from '../ui.js';

let currentSettings = {};

export async function renderPengaturanPage() {
  const container = document.getElementById('view-pengaturan');
  if (!container) return;

  setupPengaturanEventListeners();
  await loadSettingsForm();
}

async function loadSettingsForm() {
  try {
    currentSettings = await fetchSystemSettings();

    document.getElementById('set-institution-name').value = currentSettings.institutionName || '';
    document.getElementById('set-academic-year').value = currentSettings.academicYear || '2026/2027';
    document.getElementById('set-semester').value = currentSettings.semester || 'Ganjil';
    document.getElementById('set-late-tolerance').value = currentSettings.lateToleranceMinutes || 15;
    document.getElementById('set-min-attendance').value = currentSettings.minAttendancePercent || 75;
    document.getElementById('set-hours-start').value = currentSettings.operatingHoursStart || '07:00';
    document.getElementById('set-hours-end').value = currentSettings.operatingHoursEnd || '21:00';

    document.getElementById('set-allow-manual').checked = currentSettings.allowManualAttendance !== false;
    document.getElementById('set-require-session').checked = currentSettings.requireActiveSession !== false;

    // Geofencing
    const geo = currentSettings.geofencing || {};
    document.getElementById('set-geo-enabled').checked = Boolean(geo.enabled);
    document.getElementById('set-geo-lat').value = geo.latitude || -6.314643;
    document.getElementById('set-geo-lng').value = geo.longitude || 106.793755;
    document.getElementById('set-geo-radius').value = geo.radiusMeters || 300;

    // Maintenance Mode
    document.getElementById('set-maintenance-mode').checked = Boolean(currentSettings.maintenanceMode);
    document.getElementById('set-maintenance-msg').value = currentSettings.maintenanceMessage || '';
  } catch (err) {
    console.error('Error loading settings:', err);
    showToast('error', 'Gagal Memuat Pengaturan', err.message);
  }
}

function setupPengaturanEventListeners() {
  const form = document.getElementById('form-system-settings');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-save-settings');
      setButtonLoading(btn, true, 'Menyimpan Konfigurasi...');

      try {
        const updated = {
          ...currentSettings,
          institutionName: document.getElementById('set-institution-name').value.trim(),
          academicYear: document.getElementById('set-academic-year').value.trim(),
          semester: document.getElementById('set-semester').value,
          lateToleranceMinutes: Number(document.getElementById('set-late-tolerance').value || 15),
          minAttendancePercent: Number(document.getElementById('set-min-attendance').value || 75),
          operatingHoursStart: document.getElementById('set-hours-start').value,
          operatingHoursEnd: document.getElementById('set-hours-end').value,
          allowManualAttendance: document.getElementById('set-allow-manual').checked,
          requireActiveSession: document.getElementById('set-require-session').checked,
          geofencing: {
            enabled: document.getElementById('set-geo-enabled').checked,
            latitude: Number(document.getElementById('set-geo-lat').value),
            longitude: Number(document.getElementById('set-geo-lng').value),
            radiusMeters: Number(document.getElementById('set-geo-radius').value || 300)
          },
          maintenanceMode: document.getElementById('set-maintenance-mode').checked,
          maintenanceMessage: document.getElementById('set-maintenance-msg').value.trim()
        };

        await saveSystemSettings(updated);
        currentSettings = updated;
        showToast('success', 'Pengaturan Disimpan', 'Konfigurasi sistem presensi UPNVJ berhasil diperbarui.');
      } catch (err) {
        showToast('error', 'Gagal Menyimpan', err.message);
      } finally {
        setButtonLoading(btn, false);
      }
    };
  }

  // Backup JSON Buttons
  document.querySelectorAll('.btn-backup-col').forEach(btn => {
    btn.onclick = async () => {
      const colName = btn.dataset.collection;
      try {
        showToast('info', 'Mengekspor JSON...', `Mengunduh seluruh dokumen koleksi ${colName}...`);
        const count = await backupCollectionToJson(colName);
        showToast('success', 'Backup Selesai', `Sebanyak ${count} dokumen ${colName} berhasil disimpan.`);
      } catch (e) {
        showToast('error', 'Gagal Backup', e.message);
      }
    };
  });

  // Arsipkan Semester
  const btnArchive = document.getElementById('btn-archive-semester');
  if (btnArchive) {
    btnArchive.onclick = async () => {
      const label = `${currentSettings.academicYear || '2026/2027'} - Semester ${currentSettings.semester || 'Ganjil'}`;
      const confirmed = await showConfirmDialog({
        title: 'Arsipkan Presensi Semester Ini?',
        message: `Data presensi untuk ${label} akan ditandai sebagai arsip (read-only) dan tidak akan membebani perhitungan kuota aktif. Data tidak akan dihapus.`,
        confirmText: 'Ya, Arsipkan'
      });

      if (confirmed) {
        try {
          const count = await archiveSemesterAttendance(label);
          showToast('success', 'Arsip Berhasil', `Sebanyak ${count} catatan presensi semester berhasil diarsipkan.`);
        } catch (e) {
          showToast('error', 'Gagal Mengarsipkan', e.message);
        }
      }
    };
  }

  // Reset Data Absensi (HANYA SUPERADMIN DENGAN KONFIRMASI BERLAPIS)
  const btnReset = document.getElementById('btn-reset-attendance-data');
  if (btnReset) {
    btnReset.onclick = async () => {
      const confirmed = await showDestructiveSecureDialog({
        title: 'PERINGATAN: RESET TOTAL SELURUH DATA PRESENSI?',
        message: 'Seluruh riwayat kehadiran mahasiswa akan dihapus permanen dari basis data Cloud Firestore. Pastikan Anda telah mengunduh file backup JSON.',
        targetKeyword: 'HAPUS'
      });

      if (confirmed) {
        try {
          const count = await resetAttendanceData();
          showToast('success', 'Reset Selesai', `Seluruh ${count} data presensi telah dibersihkan.`);
        } catch (e) {
          showToast('error', 'Gagal Reset', e.message);
        }
      }
    };
  }
}
