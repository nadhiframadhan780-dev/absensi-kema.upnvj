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
  generateCsvContent
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
