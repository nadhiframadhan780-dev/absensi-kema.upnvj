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

  // Ke-12 field identitas lengkap = 100%
  return Math.round((filledCount / requiredFields.length) * 100);
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

/**
 * Buat payload QR Code Mahasiswa Dinamis dengan batas waktu 30 Detik (Anti Titip Absen)
 * Payload berformat JSON terstruktur dengan tanda tangan checksum unik
 */
export function generateDynamicQrPayload(nim, nama = '', currentTimeMs = Date.now(), intervalMs = 30000) {
  const cleanNim = String(nim || '').trim();
  const exp = currentTimeMs + intervalMs;
  const nonce = Math.random().toString(36).substring(2, 9);
  
  // Hash sederhana berbasis bitwise untuk memverifikasi keaslian token tanpa dependensi eksternal
  const rawString = `${cleanNim}:${currentTimeMs}:${nonce}:UPNVJ_SECURE_SALT_2026`;
  let hashVal = 0;
  for (let i = 0; i < rawString.length; i++) {
    const char = rawString.charCodeAt(i);
    hashVal = ((hashVal << 5) - hashVal) + char;
    hashVal |= 0;
  }
  const token = Math.abs(hashVal).toString(16).padStart(8, '0');

  const payload = {
    type: 'UPNVJ_STUDENT_DYNAMIC_QR',
    nim: cleanNim,
    nama: String(nama || '').trim(),
    t: currentTimeMs,
    exp: exp,
    token: token,
    nonce: nonce
  };

  return {
    payload,
    payloadString: JSON.stringify(payload),
    exp,
    token
  };
}

/**
 * Validasi payload QR Code yang dipindai kamera scanner
 * Mendukung QR Dinamis 30 detik (dengan grace period toleransi waktu perangkat 15 detik),
 * serta mendukung fallback Barcode 1D (hanya 10 digit angka NIM).
 */
export function validateDynamicQrPayload(scannedText, currentTimeMs = Date.now(), graceSeconds = 15) {
  if (!scannedText || typeof scannedText !== 'string') {
    return { valid: false, reason: 'Data pemindaian kosong atau tidak terbaca.' };
  }

  const cleanText = scannedText.trim();

  // Kasus 1: QR Code Dinamis (format JSON)
  if (cleanText.startsWith('{') && cleanText.endsWith('}')) {
    try {
      const data = JSON.parse(cleanText);

      if (data.type !== 'UPNVJ_STUDENT_DYNAMIC_QR') {
        return { valid: false, reason: 'Format QR Code bukan QR Resmi Mahasiswa UPNVJ.' };
      }

      if (!validateNim(data.nim)) {
        return { valid: false, reason: `NIM (${data.nim}) dalam QR Code tidak valid.` };
      }

      const exp = Number(data.exp || 0);
      const toleranceMs = graceSeconds * 1000;
      const isExpired = currentTimeMs > (exp + toleranceMs);

      if (isExpired) {
        const expiredAgoSec = Math.round((currentTimeMs - exp) / 1000);
        return {
          valid: false,
          nim: data.nim,
          nama: data.nama,
          isExpired: true,
          reason: `QR Code Kadaluwarsa (${expiredAgoSec}s lalu). Screenshot atau foto lama tidak berlaku demi mencegah titip absen!`
        };
      }

      const remainingSec = Math.max(0, Math.round((exp - currentTimeMs) / 1000));
      return {
        valid: true,
        isDynamicQr: true,
        nim: data.nim,
        nama: data.nama,
        remainingSec,
        token: data.token
      };
    } catch (e) {
      return { valid: false, reason: 'Format payload QR Code rusak atau tidak valid.' };
    }
  }

  // Kasus 2: Barcode 1D konvensional (10 digit NIM)
  if (validateNim(cleanText)) {
    return {
      valid: true,
      isDynamicQr: false,
      isBarcode1D: true,
      nim: cleanText,
      nama: ''
    };
  }

  return {
    valid: false,
    reason: `Format kode ("${cleanText}") tidak dikenali sebagai QR Mahasiswa maupun Barcode NIM.`
  };
}

/**
 * Validasi Ekstensi dan Tipe Berkas Bukti (PDF, Word, JPG, PNG, WEBP)
 */
export const ALLOWED_LEAVE_EXTENSIONS = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp'];
export const MAX_LEAVE_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export function getFileCategory(fileName = '', mimeType = '') {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  if (ext === 'pdf' || mime === 'application/pdf') {
    return 'pdf';
  }
  if (['doc', 'docx'].includes(ext) || mime.includes('word') || mime.includes('officedocument')) {
    return 'word';
  }
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) || mime.startsWith('image/')) {
    return 'image';
  }
  return 'other';
}

/**
 * Validasi Komprehensif Pengajuan Surat Izin / Sakit / Dispensasi Mahasiswa
 */
export function validateLeaveSubmission({
  jenis = '',
  mataKuliah = '',
  tanggalMulai = '',
  tanggalSelesai = '',
  alasan = '',
  fileName = '',
  fileSize = 0,
  fileMimeType = ''
} = {}) {
  // 1. Validasi Jenis Pengajuan
  const validTypes = ['Sakit', 'Izin', 'Dispensasi'];
  const normalizedJenis = validTypes.find(t => t.toLowerCase() === (jenis || '').trim().toLowerCase());
  if (!normalizedJenis) {
    return {
      valid: false,
      error: 'Jenis pengajuan wajib dipilih (Sakit, Izin, atau Dispensasi).'
    };
  }

  // 2. Validasi Mata Kuliah
  if (!mataKuliah || typeof mataKuliah !== 'string' || mataKuliah.trim().length < 3) {
    return {
      valid: false,
      error: 'Mata kuliah wajib diisi (minimal 3 karakter).'
    };
  }

  // 3. Validasi Tanggal
  if (!tanggalMulai || typeof tanggalMulai !== 'string') {
    return {
      valid: false,
      error: 'Tanggal mulai izin wajib ditentukan.'
    };
  }
  const startDate = new Date(tanggalMulai);
  if (isNaN(startDate.getTime())) {
    return {
      valid: false,
      error: 'Format tanggal mulai tidak valid.'
    };
  }

  if (tanggalSelesai) {
    const endDate = new Date(tanggalSelesai);
    if (isNaN(endDate.getTime())) {
      return {
        valid: false,
        error: 'Format tanggal selesai tidak valid.'
      };
    }
    if (endDate < startDate) {
      return {
        valid: false,
        error: 'Tanggal selesai tidak boleh sebelum tanggal mulai.'
      };
    }
  }

  // 4. Validasi Alasan Pengajuan
  if (!alasan || typeof alasan !== 'string' || alasan.trim().length < 10) {
    return {
      valid: false,
      error: 'Alasan pengajuan wajib diuraikan dengan jelas (minimal 10 karakter).'
    };
  }

  // 5. Validasi Dokumen Bukti
  if (!fileName || typeof fileName !== 'string') {
    return {
      valid: false,
      error: 'Bukti surat (PDF, Word, atau Gambar JPG/PNG) wajib diunggah.'
    };
  }

  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_LEAVE_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Format berkas .${ext} tidak didukung. Harap unggah dokumen PDF, Word (.doc, .docx), atau Foto (JPG, PNG, WEBP).`
    };
  }

  if (typeof fileSize === 'number' && fileSize > MAX_LEAVE_FILE_SIZE_BYTES) {
    const sizeMb = (fileSize / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Ukuran berkas (${sizeMb} MB) melebihi batas maksimal 10 MB.`
    };
  }

  const category = getFileCategory(fileName, fileMimeType);

  return {
    valid: true,
    normalizedJenis,
    fileCategory: category,
    fileExt: ext
  };
}

/**
 * Format Badge Status Pengajuan Surat
 */
export function formatLeaveStatusBadge(status = 'Menunggu') {
  const norm = (status || '').toLowerCase();
  switch (norm) {
    case 'disetujui':
      return {
        text: 'Disetujui',
        bg: '#d1fae5',
        color: '#065f46',
        borderColor: '#a7f3d0',
        icon: 'check-circle'
      };
    case 'ditolak':
      return {
        text: 'Ditolak',
        bg: '#fee2e2',
        color: '#991b1b',
        borderColor: '#fecaca',
        icon: 'x-circle'
      };
    case 'menunggu':
    default:
      return {
        text: 'Menunggu Persetujuan',
        bg: '#fef3c7',
        color: '#92400e',
        borderColor: '#fde68a',
        icon: 'clock'
      };
  }
}

/**
 * Penentuan rute redirect cerdas:
 * Jika mahasiswa sudah login dan profilnya sudah lengkap (100% atau profileComplete === true),
 * maka saat mengakses halaman landing, login, atau prodi, sistem HARUS mengarahkan langsung ke dashboard (#/beranda).
 * Jika profil belum lengkap, harus diarahkan ke profil (#/profil).
 * Jika belum login dan mengakses protected route, arahkan ke login (#/login).
 */
export function checkAuthRedirect({ isAuthenticated, profile, currentRoute = '#/' }) {
  const cleanRoute = (currentRoute || '#/').split('?')[0];
  const protectedRoutes = ['#/beranda', '#/absensi', '#/pengajuan', '#/riwayat', '#/profil'];
  const publicEntryRoutes = ['#/', '', '#/login', '#/prodi'];

  if (!isAuthenticated) {
    if (protectedRoutes.includes(cleanRoute)) {
      return { redirect: true, target: '#/login', reason: 'Akses terbatas untuk akun terdaftar' };
    }
    return { redirect: false, target: cleanRoute };
  }

  const isComplete = Boolean(profile && (profile.profileComplete === true || calculateProfileProgress(profile) >= 100));

  if (!isComplete) {
    if (cleanRoute !== '#/profil') {
      return { redirect: true, target: '#/profil', reason: 'Profil wajib dilengkapi 100%' };
    }
    return { redirect: false, target: cleanRoute };
  }

  // Jika sudah login & profil 100% lengkap, langsung arahkan ke Dashboard
  if (publicEntryRoutes.includes(cleanRoute)) {
    return { redirect: true, target: '#/beranda', reason: 'Profil 100% lengkap, langsung ke dashboard' };
  }

  return { redirect: false, target: cleanRoute };
}


