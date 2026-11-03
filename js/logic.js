/**
 * Logika Validasi dan Perhitungan Sistem Absensi UPNVJ
 */

/**
 * Validasi domain email institusi UPNVJ
 * Wajib berakhiran: @mahasiswa.upnvj.ac.id
 */
export function validateUpnvjEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const cleanEmail = email.trim().toLowerCase();
  return cleanEmail.endsWith('@mahasiswa.upnvj.ac.id') && cleanEmail.length > '@mahasiswa.upnvj.ac.id'.length;
}

/**
 * Validasi NIM Mahasiswa UPNVJ
 * Harus berupa angka (standar 10 digit)
 */
export function validateNim(nim) {
  if (!nim || typeof nim !== 'string') return false;
  const clean = nim.trim();
  return /^[0-9]{10}$/.test(clean);
}

/**
 * Konversi tanggal lahir format YYYY-MM-DD menjadi sandi DDMMYYYY
 */
export function formatBirthdatePassword(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const parts = dateStr.trim().split('-');
  if (parts.length !== 3) return '';
  const [year, month, day] = parts;
  if (!year || !month || !day) return '';
  // Pastikan day dan month 2 digit
  const d = day.padStart(2, '0');
  const m = month.padStart(2, '0');
  return `${d}${m}${year}`;
}

/**
 * Mengekstrak jenjang pendidikan dari nama program studi
 * (D3, S1, S2, S3, Profesi, Spesialis)
 */
export function extractJenjang(prodiName) {
  if (!prodiName || typeof prodiName !== 'string') return 'S1';
  const name = prodiName.trim();
  if (name.startsWith('D3')) return 'D3';
  if (name.startsWith('S1')) return 'S1';
  if (name.startsWith('S2')) return 'S2';
  if (name.startsWith('S3')) return 'S3';
  if (name.startsWith('Profesi')) return 'Profesi';
  if (name.startsWith('Spesialis')) return 'Spesialis';
  return 'S1';
}

/**
 * Cek apakah tanggal lahir ada di masa depan
 */
export function isBirthdateValid(dateStr) {
  if (!dateStr) return false;
  const inputDate = new Date(dateStr);
  if (isNaN(inputDate.getTime())) return false;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return inputDate <= today;
}

/**
 * Validasi nomor HP Indonesia (+62 atau 08, 10-14 digit)
 */
export function validateIndonesianPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const clean = phone.replace(/[\s-]/g, '');
  return /^(\+62|62|08)[0-9]{8,12}$/.test(clean);
}

/**
 * Hitung persentase kelengkapan profil mahasiswa (0-100%)
 */
export function calculateProfileProgress(profile) {
  if (!profile) return 0;
  const requiredFields = [
    'nama',
    'nim',
    'email',
    'fakultas',
    'prodi',
    'angkatan',
    'semester',
    'tanggalLahir',
    'tempatLahir',
    'jenisKelamin',
    'noHp',
    'alamat'
  ];

  let filledCount = 0;
  for (const field of requiredFields) {
    const val = profile[field];
    if (val !== undefined && val !== null && String(val).trim().length > 0) {
      filledCount++;
    }
  }

  // Tambahkan bonus poin jika ada foto profil
  let totalScore = Math.round((filledCount / requiredFields.length) * 90);
  if (profile.fotoURL && profile.fotoURL.trim().length > 0) {
    totalScore += 10;
  }
  return Math.min(100, totalScore);
}

/**
 * Deteksi absensi ganda (NIM + Mata Kuliah + Tanggal sama)
 */
export function isDuplicateAttendance(records, nim, mataKuliah, tanggal) {
  if (!Array.isArray(records) || !nim || !mataKuliah || !tanggal) return false;
  const targetNim = String(nim).trim().toLowerCase();
  const targetMatkul = String(mataKuliah).trim().toLowerCase();
  const targetTanggal = String(tanggal).trim();

  return records.some(rec => {
    return (
      String(rec.nim || '').trim().toLowerCase() === targetNim &&
      String(rec.mataKuliah || '').trim().toLowerCase() === targetMatkul &&
      String(rec.tanggal || '').trim() === targetTanggal
    );
  });
}

/**
 * Generate CSV untuk ekspor riwayat absensi
 */
export function generateCsvContent(records, studentInfo = {}) {
  const headers = ['No', 'Tanggal', 'Waktu', 'Mata Kuliah', 'NIM', 'Nama Mahasiswa', 'Fakultas', 'Program Studi', 'Metode', 'Status'];
  const rows = [headers.join(',')];

  if (Array.isArray(records)) {
    records.forEach((rec, idx) => {
      const escape = (val) => `"${String(val || '').replace(/"/g, '""')}"`;
      const row = [
        idx + 1,
        escape(rec.tanggal || '-'),
        escape(rec.waktuFormatted || rec.jam || '-'),
        escape(rec.mataKuliah || '-'),
        escape(rec.nim || studentInfo.nim || '-'),
        escape(rec.nama || studentInfo.nama || '-'),
        escape(rec.fakultas || studentInfo.fakultas || '-'),
        escape(rec.prodi || studentInfo.prodi || '-'),
        escape(rec.metode === 'scan' ? 'Scan Barcode' : 'Manual'),
        escape(rec.status || 'Hadir')
      ];
      rows.push(row.join(','));
    });
  }

  return rows.join('\r\n');
}
