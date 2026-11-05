import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateUpnvjEmail,
  validateNim,
  formatBirthdatePassword,
  extractJenjang,
  isBirthdateValid,
  validateIndonesianPhone,
  calculateProfileProgress,
  isDuplicateAttendance,
  generateCsvContent,
  generateDynamicQrPayload,
  validateDynamicQrPayload,
  validateLeaveSubmission,
  getFileCategory,
  formatLeaveStatusBadge,
  ALLOWED_LEAVE_EXTENSIONS,
  MAX_LEAVE_FILE_SIZE_BYTES,
  checkAuthRedirect,
  getOptimalUploadStrategy,
  MAX_SAFE_FIRESTORE_DOC_BYTES
} from '../js/logic.js';
import { FACULTIES, getFacultyById, getProdiList, FK_SPECIAL_NOTE } from '../js/data.js';

test('Data UPNVJ: Memiliki 7 fakultas resmi', () => {
  assert.equal(FACULTIES.length, 7);
  const codes = FACULTIES.map(f => f.code);
  assert.deepEqual(codes, ['FEB', 'FK', 'FISIP', 'FIK', 'FT', 'FH', 'FIKES']);
});

test('Data UPNVJ: Fakultas Kedokteran memiliki catatan khusus yang tepat', () => {
  const fk = getFacultyById('fk');
  assert.ok(fk);
  assert.equal(fk.specialNote, FK_SPECIAL_NOTE);
  assert.equal(fk.prodi.length, 7);
  assert.ok(fk.prodi.includes('S1 Kedokteran'));
  assert.ok(fk.prodi.includes('Profesi Dokter'));
  assert.ok(fk.prodi.includes('S1 Farmasi'));
  assert.ok(fk.prodi.includes('Profesi Apoteker'));
});

test('Validasi Email Institusi: Hanya menerima @mahasiswa.upnvj.ac.id', () => {
  assert.equal(validateUpnvjEmail('2110511001@mahasiswa.upnvj.ac.id'), true);
  assert.equal(validateUpnvjEmail('nadhif@mahasiswa.upnvj.ac.id'), true);
  // Email tidak valid / domain luar
  assert.equal(validateUpnvjEmail('nadhif@gmail.com'), false);
  assert.equal(validateUpnvjEmail('dosen@upnvj.ac.id'), false);
  assert.equal(validateUpnvjEmail('test@mahasiswa.ui.ac.id'), false);
  assert.equal(validateUpnvjEmail('@mahasiswa.upnvj.ac.id'), false);
  assert.equal(validateUpnvjEmail(''), false);
  assert.equal(validateUpnvjEmail(null), false);
});

test('Validasi NIM: Wajib angka 10 digit', () => {
  assert.equal(validateNim('2110511001'), true);
  assert.equal(validateNim('2210611099'), true);
  assert.equal(validateNim('211051100'), false); // 9 digit
  assert.equal(validateNim('21105110011'), false); // 11 digit
  assert.equal(validateNim('211051100A'), false); // Mengandung huruf
  assert.equal(validateNim(''), false);
});

test('Format Password Tanggal Lahir: YYYY-MM-DD -> DDMMYYYY', () => {
  assert.equal(formatBirthdatePassword('2003-05-14'), '14052003');
  assert.equal(formatBirthdatePassword('2002-12-01'), '01122002');
  assert.equal(formatBirthdatePassword(''), '');
  assert.equal(formatBirthdatePassword('invalid'), '');
});

test('Ekstrak Jenjang: Mendeteksi D3, S1, S2, S3, Profesi, Spesialis', () => {
  assert.equal(extractJenjang('S1 Sistem Informasi'), 'S1');
  assert.equal(extractJenjang('D3 Akuntansi'), 'D3');
  assert.equal(extractJenjang('S2 Manajemen'), 'S2');
  assert.equal(extractJenjang('S3 Hukum'), 'S3');
  assert.equal(extractJenjang('Profesi Dokter'), 'Profesi');
  assert.equal(extractJenjang('Spesialis Radiologi'), 'Spesialis');
});

test('Validasi Tanggal Lahir: Tidak boleh di masa depan', () => {
  assert.equal(isBirthdateValid('2000-01-01'), true);
  assert.equal(isBirthdateValid('2029-01-01'), false);
  assert.equal(isBirthdateValid(''), false);
});

test('Validasi Nomor HP Indonesia', () => {
  assert.equal(validateIndonesianPhone('081234567890'), true);
  assert.equal(validateIndonesianPhone('+6281234567890'), true);
  assert.equal(validateIndonesianPhone('6281234567890'), true);
  assert.equal(validateIndonesianPhone('12345'), false);
  assert.equal(validateIndonesianPhone('0812abc'), false);
});

test('Perhitungan Persentase Profil', () => {
  const emptyProfile = {};
  assert.equal(calculateProfileProgress(emptyProfile), 0);

  const fullProfile = {
    nama: 'Budi Santoso',
    nim: '2110511001',
    email: '2110511001@mahasiswa.upnvj.ac.id',
    fakultas: 'FIK',
    prodi: 'S1 Sistem Informasi',
    angkatan: '2021',
    semester: '6',
    tanggalLahir: '2003-05-14',
    tempatLahir: 'Jakarta',
    jenisKelamin: 'Laki-laki',
    noHp: '081234567890',
    alamat: 'Jl. RS Fatmawati No. 1, Pondok Labu, Jakarta Selatan',
    fotoURL: 'data:image/jpeg;base64,...'
  };
  assert.equal(calculateProfileProgress(fullProfile), 100);
});

test('Cek Absensi Ganda', () => {
  const records = [
    { nim: '2110511001', mataKuliah: 'Rekayasa Perangkat Lunak', tanggal: '2026-11-01' },
    { nim: '2110511001', mataKuliah: 'Basis Data Lanjut', tanggal: '2026-11-01' },
  ];

  assert.equal(isDuplicateAttendance(records, '2110511001', 'Rekayasa Perangkat Lunak', '2026-11-01'), true);
  assert.equal(isDuplicateAttendance(records, '2110511001', 'Pemrograman Web', '2026-11-01'), false);
  assert.equal(isDuplicateAttendance(records, '2110511001', 'Rekayasa Perangkat Lunak', '2026-11-02'), false);
  assert.equal(isDuplicateAttendance(records, '2110511002', 'Rekayasa Perangkat Lunak', '2026-11-01'), false);
});

test('Ekspor CSV', () => {
  const records = [
    {
      tanggal: '2026-11-01',
      waktuFormatted: '08:30 WIB',
      mataKuliah: 'Kecerdasan Buatan',
      nim: '2110511001',
      nama: 'Ahmad Mahasiswa',
      fakultas: 'FIK',
      prodi: 'S1 Informatika',
      metode: 'scan',
      status: 'Hadir'
    }
  ];
  const csv = generateCsvContent(records);
  assert.ok(csv.includes('Tanggal,Waktu,Mata Kuliah'));
  assert.ok(csv.includes('Kecerdasan Buatan'));
  assert.ok(csv.includes('Scan Barcode'));
});

test('QR Code Dinamis 30 Detik: Pembuatan token ber-TTL 30 detik', () => {
  const baseTime = 1762240000000;
  const result = generateDynamicQrPayload('2110511001', 'Budi Pratama', baseTime, 30000);
  assert.ok(result.token);
  assert.equal(result.exp, baseTime + 30000);
  assert.equal(result.payload.nim, '2110511001');
  assert.equal(result.payload.type, 'UPNVJ_STUDENT_DYNAMIC_QR');
  assert.ok(result.payloadString.includes('UPNVJ_STUDENT_DYNAMIC_QR'));
});

test('QR Code Dinamis 30 Detik: Validasi saat masih aktif', () => {
  const baseTime = 1762240000000;
  const { payloadString } = generateDynamicQrPayload('2110511001', 'Budi Pratama', baseTime, 30000);
  
  // Validasi 10 detik setelah dibuat
  const checkTime = baseTime + 10000;
  const val = validateDynamicQrPayload(payloadString, checkTime);
  assert.equal(val.valid, true);
  assert.equal(val.isDynamicQr, true);
  assert.equal(val.nim, '2110511001');
  assert.equal(val.remainingSec, 20);
});

test('QR Code Dinamis 30 Detik: Deteksi Kadaluwarsa / Anti-Screenshot', () => {
  const baseTime = 1762240000000;
  const { payloadString } = generateDynamicQrPayload('2110511001', 'Budi Pratama', baseTime, 30000);
  
  // Validasi 60 detik setelah dibuat (melebihi 30s + grace 15s)
  const expiredTime = baseTime + 60000;
  const val = validateDynamicQrPayload(payloadString, expiredTime, 15);
  assert.equal(val.valid, false);
  assert.equal(val.isExpired, true);
  assert.ok(val.reason.includes('Kadaluwarsa'));
  assert.ok(val.reason.includes('Screenshot'));
});

test('QR Code Dinamis 30 Detik: Fallback Barcode 1D', () => {
  // Barcode 1D konvensional hanya berupa 10 digit angka NIM
  const val = validateDynamicQrPayload('2110511001');
  assert.equal(val.valid, true);
  assert.equal(val.isBarcode1D, true);
  assert.equal(val.nim, '2110511001');

  // Input bukan NIM atau format aneh
  const invalidVal = validateDynamicQrPayload('BukanNIM123');
  assert.equal(invalidVal.valid, false);
});

test('Pengajuan Surat: Kategori Berkas (PDF, Word, Image)', () => {
  assert.equal(getFileCategory('surat_dokter.pdf', 'application/pdf'), 'pdf');
  assert.equal(getFileCategory('dispensasi.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), 'word');
  assert.equal(getFileCategory('izin_lomba.doc', 'application/msword'), 'word');
  assert.equal(getFileCategory('bukti_rawat.jpg', 'image/jpeg'), 'image');
  assert.equal(getFileCategory('surat.png', 'image/png'), 'image');
  assert.equal(getFileCategory('bukti.webp', 'image/webp'), 'image');
  assert.equal(getFileCategory('program.exe', 'application/octet-stream'), 'other');
});

test('Pengajuan Surat: Validasi Berhasil untuk Sakit, Izin, dan Dispensasi', () => {
  // 1. Sakit dengan bukti PDF
  const resSakit = validateLeaveSubmission({
    jenis: 'Sakit',
    mataKuliah: 'Pemrograman Web',
    tanggalMulai: '2026-11-04',
    alasan: 'Mengalami demam tinggi dan radang tenggorokan sesuai rekomendasi dokter.',
    fileName: 'surat_sakit_rs_fatmawati.pdf',
    fileSize: 500 * 1024,
    fileMimeType: 'application/pdf'
  });
  assert.equal(resSakit.valid, true);
  assert.equal(resSakit.normalizedJenis, 'Sakit');
  assert.equal(resSakit.fileCategory, 'pdf');

  // 2. Izin dengan surat Word (.docx)
  const resIzin = validateLeaveSubmission({
    jenis: 'Izin',
    mataKuliah: 'Basis Data Lanjut',
    tanggalMulai: '2026-11-05',
    tanggalSelesai: '2026-11-06',
    alasan: 'Menghadiri pernikahan keluarga inti di luar kota selama dua hari.',
    fileName: 'surat_izin_orang_tua.docx',
    fileSize: 200 * 1024,
    fileMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
  assert.equal(resIzin.valid, true);
  assert.equal(resIzin.normalizedJenis, 'Izin');
  assert.equal(resIzin.fileCategory, 'word');

  // 3. Dispensasi dengan bukti Gambar (.jpg)
  const resDispensasi = validateLeaveSubmission({
    jenis: 'Dispensasi',
    mataKuliah: 'Kecerdasan Buatan',
    tanggalMulai: '2026-11-10',
    alasan: 'Mewakili kontingen universitas dalam kompetisi Gemastik Nasional 2026.',
    fileName: 'surat_tugas_rektorat.jpg',
    fileSize: 850 * 1024,
    fileMimeType: 'image/jpeg'
  });
  assert.equal(resDispensasi.valid, true);
  assert.equal(resDispensasi.normalizedJenis, 'Dispensasi');
  assert.equal(resDispensasi.fileCategory, 'image');
});

test('Pengajuan Surat: Penolakan Validasi Error Kasus Negatif', () => {
  // Jenis tidak valid
  const invalidJenis = validateLeaveSubmission({
    jenis: 'Bolos',
    mataKuliah: 'Web',
    tanggalMulai: '2026-11-04',
    alasan: 'Alasan yang panjang lebih dari sepuluh karakter',
    fileName: 'file.pdf',
    fileSize: 1000
  });
  assert.equal(invalidJenis.valid, false);
  assert.ok(invalidJenis.error?.includes('Jenis pengajuan'));

  // Alasan terlalu pendek (<10 karakter)
  const shortReason = validateLeaveSubmission({
    jenis: 'Sakit',
    mataKuliah: 'Sistem Operasi',
    tanggalMulai: '2026-11-04',
    alasan: 'Sakit flu',
    fileName: 'bukti.pdf',
    fileSize: 1000
  });
  assert.equal(shortReason.valid, false);
  assert.ok(shortReason.error?.includes('Alasan pengajuan'));

  // Format berkas ditolak (misal .exe)
  const invalidExt = validateLeaveSubmission({
    jenis: 'Izin',
    mataKuliah: 'Jaringan Komputer',
    tanggalMulai: '2026-11-04',
    alasan: 'Keterangan izin yang sudah cukup panjang',
    fileName: 'virus.exe',
    fileSize: 1000
  });
  assert.equal(invalidExt.valid, false);
  assert.ok(invalidExt.error?.includes('tidak didukung'));

  // Ukuran berkas melebihi 10MB
  const tooLarge = validateLeaveSubmission({
    jenis: 'Dispensasi',
    mataKuliah: 'Struktur Data',
    tanggalMulai: '2026-11-04',
    alasan: 'Keterangan izin dispensasi kegiatan kampus',
    fileName: 'video_besar.pdf',
    fileSize: 15 * 1024 * 1024
  });
  assert.equal(tooLarge.valid, false);
  assert.ok(tooLarge.error?.includes('melebihi batas maksimal'));
});

test('Pengajuan Surat: Format Badge Status', () => {
  assert.equal(formatLeaveStatusBadge('Menunggu').text, 'Menunggu Persetujuan');
  assert.equal(formatLeaveStatusBadge('Disetujui').text, 'Disetujui');
  assert.equal(formatLeaveStatusBadge('Ditolak').text, 'Ditolak');
});

test('Pengalihan Dashboard: Profil 100% lengkap langsung diarahkan ke #/beranda', () => {
  const completeProfile = {
    nama: 'Budi Santoso',
    nim: '2110511001',
    email: '2110511001@mahasiswa.upnvj.ac.id',
    fakultas: 'FIK',
    prodi: 'S1 Sistem Informasi',
    angkatan: '2021',
    semester: '6',
    tanggalLahir: '2003-05-14',
    tempatLahir: 'Jakarta',
    jenisKelamin: 'Laki-laki',
    noHp: '081234567890',
    alamat: 'Jl. RS Fatmawati No. 1 Jakarta Selatan',
    fotoURL: 'https://example.com/foto.jpg',
    profileComplete: true
  };

  // 1. Saat mahasiswa dengan profil 100% membuka landing page ('#/'), langsung ke Dashboard ('#/beranda')
  const r1 = checkAuthRedirect({ isAuthenticated: true, profile: completeProfile, currentRoute: '#/' });
  assert.equal(r1.redirect, true);
  assert.equal(r1.target, '#/beranda');

  // 2. Saat membuka login ('#/login'), langsung ke Dashboard ('#/beranda')
  const r2 = checkAuthRedirect({ isAuthenticated: true, profile: completeProfile, currentRoute: '#/login' });
  assert.equal(r2.redirect, true);
  assert.equal(r2.target, '#/beranda');

  // 3. Saat membuka prodi ('#/prodi'), langsung ke Dashboard ('#/beranda')
  const r3 = checkAuthRedirect({ isAuthenticated: true, profile: completeProfile, currentRoute: '#/prodi' });
  assert.equal(r3.redirect, true);
  assert.equal(r3.target, '#/beranda');

  // 4. Saat membuka halaman absensi ('#/absensi'), tetap di absensi
  const r4 = checkAuthRedirect({ isAuthenticated: true, profile: completeProfile, currentRoute: '#/absensi' });
  assert.equal(r4.redirect, false);
  assert.equal(r4.target, '#/absensi');

  // 5. Jika profil belum lengkap (<100%), harus diarahkan ke '#/profil'
  const incompleteProfile = {
    nama: 'Budi Santoso',
    nim: '2110511001',
    profileComplete: false
  };
  const r5 = checkAuthRedirect({ isAuthenticated: true, profile: incompleteProfile, currentRoute: '#/beranda' });
  assert.equal(r5.redirect, true);
  assert.equal(r5.target, '#/profil');

  // 6. Jika belum login dan membuka rute privat, diarahkan ke '#/login'
  const r6 = checkAuthRedirect({ isAuthenticated: false, profile: null, currentRoute: '#/beranda' });
  assert.equal(r6.redirect, true);
  assert.equal(r6.target, '#/login');
});

test('Strategi Unggah & Anti-Hang Firestore: Kompresi gambar dan proteksi berkas besar', () => {
  // 1. Gambar selalu menggunakan strategi kompresi canvas sehingga selalu muat di Firestore
  const imgStrategy = getOptimalUploadStrategy(4 * 1024 * 1024, 'image');
  assert.equal(imgStrategy.shouldCompressImage, true);
  assert.equal(imgStrategy.safeForFirestoreFallback, true);
  assert.equal(imgStrategy.strategy, 'canvas-compress');

  // 2. Berkas dokumen (PDF / Word) di bawah 680 KB aman untuk fallback Base64
  const docSmall = getOptimalUploadStrategy(300 * 1024, 'pdf');
  assert.equal(docSmall.shouldCompressImage, false);
  assert.equal(docSmall.safeForFirestoreFallback, true);
  assert.equal(docSmall.strategy, 'direct-base64');

  // 3. Berkas dokumen di atas 680 KB ditandai storage-required untuk mencegah Firestore error 1MB
  const docLarge = getOptimalUploadStrategy(2 * 1024 * 1024, 'pdf');
  assert.equal(docLarge.shouldCompressImage, false);
  assert.equal(docLarge.safeForFirestoreFallback, false);
  assert.equal(docLarge.strategy, 'storage-required');
});



