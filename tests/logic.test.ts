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

test('Surat Keputusan Resmi: Format Nomor Naskah Dinas, Dekan Fakultas, dan Cap Stempel', async () => {
  const { generateOfficialLetterNumber, formatIndonesianDateLong } = await import('../js/officialLetterPdf.js');
  const { getDekanByFaculty } = await import('../js/data.js');

  // 1. Nomor naskah dinas resmi institusi UPNVJ
  const noSuratFIK = generateOfficialLetterNumber('req12345678', 'FIK', 2026);
  assert.match(noSuratFIK, /^B\/\d{3}\/UN61\.0\/FIK\.KM\.01\/2026$/);

  const noSuratFK = generateOfficialLetterNumber('req87654321', 'FK', 2026);
  assert.match(noSuratFK, /^B\/\d{3}\/UN61\.0\/FK\.KM\.01\/2026$/);

  // 2. Format tanggal Indonesia lengkap
  const tanggal = formatIndonesianDateLong('2026-05-24');
  assert.equal(tanggal, '24 Mei 2026');

  // 3. Pengesahan Dekan sesuai Fakultas & NIP Resmi
  const dekanFIK = getDekanByFaculty('fik');
  assert.equal(dekanFIK.nama, 'Dr. Supriyanto, S.T., M.T.');
  assert.equal(dekanFIK.nip, '197105151998031002');
  assert.equal(dekanFIK.fakultasCode, 'FIK');

  const dekanFEB = getDekanByFaculty('feb');
  assert.equal(dekanFEB.nama, 'Dr. Jubaedah, S.E., M.M.');
  assert.equal(dekanFEB.nip, '196803201994032001');

  const dekanFK = getDekanByFaculty('fk');
  assert.equal(dekanFK.nama, 'Dr. dr. H. Taufiq Fredrik Pasiak, M.Kes., M.Pd.I.');
  assert.equal(dekanFK.nip, '196802281997021001');

  const dekanFISIP = getDekanByFaculty('fisip');
  assert.equal(dekanFISIP.nama, 'Dr. S. Bekti Istiyanto, M.Si.');
  assert.equal(dekanFISIP.nip, '197206121999031001');

  const dekanFT = getDekanByFaculty('ft');
  assert.equal(dekanFT.nama, 'Dr. Ir. Reda Rizal, M.Si.');
  assert.equal(dekanFT.nip, '196210051992031001');

  const dekanFH = getDekanByFaculty('fh');
  assert.equal(dekanFH.nama, 'Dr. Suherman, S.H., LL.M.');
  assert.equal(dekanFH.nip, '197409212000121001');

  const dekanFIKES = getDekanByFaculty('fikes');
  assert.equal(dekanFIKES.nama, 'Desak Nyoman Sithi, S.Kp., MARS.');
  assert.equal(dekanFIKES.nip, '196708221990032001');
});

test('Surat Keputusan Resmi: Posisi Stempel di Area Dekan (cx=148) dan Tanda Tangan Mahasiswa Ber-Materai', async () => {
  const { drawOfficialUniversityStamp } = await import('../js/officialLetterPdf.js');

  // Cek parameter default stempel institusi
  // Stempel resmi institusi berada di tempat Dekan (cx = 148 mm)
  assert.equal(typeof drawOfficialUniversityStamp, 'function');

  // Dummy mock document to verify call parameters
  let calledCx = null;
  let calledCy = null;
  let calledColor = null;

  const mockDoc: any = {
    saveGraphicsState() {},
    restoreGraphicsState() {},
    setGState() {},
    setDrawColor(r: number, g: number, b: number) { calledColor = [r, g, b]; },
    setTextColor() {},
    setLineWidth() {},
    circle(cx: number, cy: number) { calledCx = cx; calledCy = cy; },
    line() {},
    setFont() {},
    setFontSize() {},
    text() {}
  };

  // Panggil stempel disetujui (default area dekan cx = 148 mm)
  drawOfficialUniversityStamp(mockDoc, { status: 'Disetujui' });
  assert.equal(calledCx, 148, 'Stempel resmi wajib berposisi di area tanda tangan Dekan (cx = 148 mm)');
  assert.deepEqual(calledColor, [5, 150, 105], 'Stempel disetujui wajib berwarna HIJAU');

  // Panggil stempel ditolak
  drawOfficialUniversityStamp(mockDoc, { status: 'Ditolak' });
  assert.equal(calledCx, 148, 'Stempel resmi wajib berposisi di area tanda tangan Dekan (cx = 148 mm)');
  assert.deepEqual(calledColor, [220, 38, 38], 'Stempel ditolak wajib berwarna MERAH');
});

test('Portal Verifikasi QR: Pembuatan URL Verifikasi & Parsing Parameter', async () => {
  const { buildLetterVerificationUrl, parseVerificationParams } = await import('../js/logic.js');

  const url = buildLetterVerificationUrl({
    origin: 'https://ais-dev-preview.run.app',
    pathname: '/admin/dashboard.html',
    id: 'req_xyz789',
    token: 'REQ_XYZ7',
    nim: '2110511045'
  });

  assert.ok(url.includes('#/verifikasi-surat'), 'URL wajib mengarah ke route #/verifikasi-surat');
  assert.ok(url.includes('id=req_xyz789'), 'URL wajib menyertakan parameter id');
  assert.ok(url.includes('token=REQ_XYZ7'), 'URL wajib menyertakan token digital');
  assert.ok(url.includes('nim=2110511045'), 'URL wajib menyertakan NIM');
  assert.ok(!url.includes('/admin/'), 'URL wajib dibersihkan dari subfolder /admin');

  // Parsing parameter dari hash string
  const parsed1 = parseVerificationParams('#/verifikasi-surat?id=req_xyz789&token=REQ_XYZ7&nim=2110511045');
  assert.equal(parsed1.id, 'req_xyz789');
  assert.equal(parsed1.token, 'REQ_XYZ7');
  assert.equal(parsed1.nim, '2110511045');

  // Parsing parameter dari format pendek #/verifikasi?token=...
  const parsed2 = parseVerificationParams('#/verifikasi?token=ABC12345&nim=2210511099');
  assert.equal(parsed2.token, 'ABC12345');
  assert.equal(parsed2.nim, '2210511099');
});

test('Anti-Jiplak & Anti-Duplikasi: Checksum Kriptografis Mendeteksi Manipulasi Data', async () => {
  const { computeLetterChecksum } = await import('../js/logic.js');

  const originalDoc = {
    id: 'doc_upnvj_001',
    nim: '2110511045',
    mataKuliah: 'Rekayasa Perangkat Lunak',
    dosen: 'Dr. Ir. Hendra Gunawan, M.Kom.',
    tanggalMulai: '2026-05-10',
    tanggalSelesai: '2026-05-12',
    jenis: 'Sakit',
    status: 'Disetujui',
    dekanNip: '196803201994032001'
  };

  const originalChecksum = computeLetterChecksum(originalDoc);
  assert.ok(originalChecksum.startsWith('UPNVJ-'), 'Checksum wajib berawalan UPNVJ-');

  // Checksum deterministik: data sama menghasilkan checksum yang identik
  const identicalChecksum = computeLetterChecksum({ ...originalDoc });
  assert.equal(originalChecksum, identicalChecksum, 'Data identik wajib menghasilkan checksum yang sama');

  // Jika ada pihak memanipulasi nama Dosen
  const tamperedDosen = computeLetterChecksum({ ...originalDoc, dosen: 'Dosen Palsu' });
  assert.notEqual(originalChecksum, tamperedDosen, 'Manipulasi Dosen wajib mengubah checksum');

  // Jika ada pihak memanipulasi Mata Kuliah
  const tamperedMatkul = computeLetterChecksum({ ...originalDoc, mataKuliah: 'Mata Kuliah Lain' });
  assert.notEqual(originalChecksum, tamperedMatkul, 'Manipulasi Mata Kuliah wajib mengubah checksum');

  // Jika ada pihak memanipulasi NIM atau Tanggal
  const tamperedNim = computeLetterChecksum({ ...originalDoc, nim: '9999999999' });
  assert.notEqual(originalChecksum, tamperedNim, 'Manipulasi NIM wajib mengubah checksum');
});

test('Validasi Surat Resmi: Menampilkan Data Pemohon dan Dosen Bersangkutan', async () => {
  const { verifyOfficialLetterRecord } = await import('../js/logic.js');

  const registeredDoc = {
    id: 'req_8f91a0',
    nim: '2110511045',
    nama: 'Adinda Putri Maharani',
    fakultas: 'Fakultas Ekonomi dan Bisnis',
    prodi: 'S1 Manajemen',
    dosen: 'Dr. Ir. Hendra Gunawan, M.Kom.',
    mataKuliah: 'Manajemen Keuangan Lanjutan',
    jenis: 'Dispensasi',
    tanggalMulai: '2026-05-20',
    tanggalSelesai: '2026-05-22',
    alasan: 'Mewakili universitas dalam Kompetisi Bisnis Nasional 2026',
    status: 'Disetujui',
    suratNomor: 'B/142/UN61.1/FEB/KM.01.02/2026',
    dekanNama: 'Dr. Jubaedah, S.E., M.M.',
    dekanNip: '196803201994032001',
    dekanFakultas: 'Fakultas Ekonomi dan Bisnis',
    diprosesOleh: 'Admin Akademik FEB',
    lampiran: 'data:application/pdf;base64,...',
    lampiranNama: 'Surat_Tugas_Rektor_UPNVJ.pdf'
  };

  const result = verifyOfficialLetterRecord(registeredDoc, { id: 'req_8f91a0', nim: '2110511045' });

  assert.equal(result.isValid, true, 'Surat disetujui wajib dinyatakan valid');
  assert.equal(result.isApproved, true);
  assert.equal(result.statusLabel, 'RESMI & DISETUJUI DEKAN');

  // Verifikasi Data Pemohon
  assert.equal(result.data.applicant.nama, 'Adinda Putri Maharani');
  assert.equal(result.data.applicant.nim, '2110511045');
  assert.equal(result.data.applicant.prodi, 'S1 Manajemen');

  // Verifikasi Data Dosen Bersangkutan & Mata Kuliah (yang diisi pemohon)
  assert.equal(result.data.courseAndLecturer.dosen, 'Dr. Ir. Hendra Gunawan, M.Kom.');
  assert.equal(result.data.courseAndLecturer.mataKuliah, 'Manajemen Keuangan Lanjutan');
  assert.equal(result.data.courseAndLecturer.jenis, 'Dispensasi');
  assert.equal(result.data.courseAndLecturer.durasiHari, 3);
  assert.ok(result.data.courseAndLecturer.alasan.includes('Kompetisi Bisnis'));

  // Verifikasi Pengesahan Dekanat
  assert.equal(result.data.approval.nomorSurat, 'B/142/UN61.1/FEB/KM.01.02/2026');
  assert.equal(result.data.approval.dekanNama, 'Dr. Jubaedah, S.E., M.M.');
  assert.equal(result.data.approval.dekanNip, '196803201994032001');
  assert.equal(result.data.approval.capWarna, 'HIJAU');
});

test('Validasi Surat Resmi: Deteksi Dokumen Palsu atau NIM Tidak Cocok', async () => {
  const { verifyOfficialLetterRecord } = await import('../js/logic.js');

  // 1. Dokumen tidak ditemukan dalam basis data
  const notFound = verifyOfficialLetterRecord(null, { id: 'fake_123' });
  assert.equal(notFound.isValid, false);
  assert.equal(notFound.code, 'NOT_FOUND');
  assert.ok(notFound.message.includes('tidak terdaftar'));

  // 2. Manipulasi NIM pada query string
  const registered = {
    id: 'req_001',
    nim: '2110511045',
    nama: 'Adinda',
    status: 'Disetujui'
  };
  const mismatch = verifyOfficialLetterRecord(registered, { id: 'req_001', nim: '9999999999' });
  assert.equal(mismatch.isValid, false);
  assert.equal(mismatch.code, 'NIM_MISMATCH');
  assert.ok(mismatch.message.includes('TIDAK SAH'));
});






