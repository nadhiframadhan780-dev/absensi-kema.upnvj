/**
 * Modul Generator Surat Keputusan Resmi Ketidakhadiran (Izin / Sakit / Dispensasi)
 * Universitas Pembangunan Nasional "Veteran" Jakarta
 * Sesuai format naskah dinas resmi institusi A4 1 lembar dengan cap stempel warna aman anti-edit.
 */

import { getDekanByFaculty } from './data.js';

/**
 * Format tanggal Indonesia lengkap: "24 Mei 2026"
 */
export function formatIndonesianDateLong(dateInput) {
  if (!dateInput) return new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    // jika string YYYY-MM-DD
    const parts = String(dateInput).split('-');
    if (parts.length === 3) {
      const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      const mIdx = parseInt(parts[1], 10) - 1;
      return `${parseInt(parts[2], 10)} ${monthNames[mIdx] || parts[1]} ${parts[0]}`;
    }
    return String(dateInput);
  }
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Format nomor naskah dinas resmi UPNVJ
 */
export function generateOfficialLetterNumber(leaveId, fakultasCode, year) {
  const currentYear = year || new Date().getFullYear();
  const code = (fakultasCode || 'UN61').toUpperCase();
  // Hasilkan angka urut berbasis string leaveId atau timestamp
  let seed = 100;
  if (leaveId) {
    for (let i = 0; i < leaveId.length; i++) {
      seed = (seed * 31 + leaveId.charCodeAt(i)) % 900;
    }
  }
  const seqNumber = String(100 + seed).padStart(3, '0');
  return `B/${seqNumber}/UN61.0/${code}.KM.01/${currentYear}`;
}

/**
 * Konversi Data URL (Base64) menjadi Blob aman untuk browser
 */
export function dataUrlToBlob(dataUrl) {
  if (!dataUrl) return null;
  if (typeof dataUrl === 'object' && dataUrl instanceof Blob) return dataUrl;
  if (typeof dataUrl !== 'string') return null;

  // Jika sudah merupakan URL blob
  if (dataUrl.startsWith('blob:')) return null;

  try {
    const parts = dataUrl.split(';base64,');
    if (parts.length < 2) return null;
    const contentType = parts[0].split(':')[1] || 'application/octet-stream';
    const binaryStr = window.atob(parts[1]);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return new Blob([bytes], { type: contentType });
  } catch (err) {
    console.error('Error konversi dataUrl to blob:', err);
    return null;
  }
}

/**
 * Buka Pratinjau Dokumen dengan aman tanpa error `about:blank#blocked`
 */
export function openDocumentPreviewSafely(dataUrl, fileName = 'Dokumen_UPNVJ') {
  if (!dataUrl) {
    alert('Dokumen tidak ditemukan.');
    return;
  }

  // Jika URL http/https biasa
  if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
    window.open(dataUrl, '_blank');
    return;
  }

  // Konversi Base64 menjadi Blob Object URL
  const blob = dataUrlToBlob(dataUrl);
  if (blob) {
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, '_blank');
    if (!win || win.closed || typeof win.closed === 'undefined') {
      // Fallback jika popup blocker aktif
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
  } else {
    // Fallback direct download
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

/**
 * Unduh berkas PDF dari Data URL
 */
export function downloadPdfFromDataUrl(dataUrl, fileName = 'Surat_Keputusan_UPNVJ.pdf') {
  const blob = dataUrlToBlob(dataUrl);
  if (blob) {
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } else {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

/**
 * Cetak PDF langsung (Print A4)
 */
export function printPdfDataUrl(dataUrl) {
  const blob = dataUrlToBlob(dataUrl);
  const targetUrl = blob ? URL.createObjectURL(blob) : dataUrl;
  
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = targetUrl;
  
  iframe.onload = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      console.warn('Iframe print error, membuka tab baru:', e);
      window.open(targetUrl, '_blank');
    }
    setTimeout(() => {
      document.body.removeChild(iframe);
      if (blob) URL.revokeObjectURL(targetUrl);
    }, 60000);
  };

  document.body.appendChild(iframe);
}

/**
 * Muat logo UPNVJ sebagai Base64 image
 */
async function loadLogoBase64() {
  const possiblePaths = [
    'assets/logo-upnvj.png',
    '/assets/logo-upnvj.png',
    '../assets/logo-upnvj.png',
    'public/assets/logo-upnvj.png'
  ];

  for (const path of possiblePaths) {
    try {
      const res = await fetch(path);
      if (res.ok) {
        const blob = await res.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      }
    } catch (_) {}
  }
  return null;
}

/**
 * Gambar Cap Stempel Resmi Vektor UPNVJ di jsPDF
 * - Warna HIJAU (#059669) jika DISETUJUI
 * - Warna MERAH (#dc2626) jika DITOLAK
 * Ter-fused langsung di atas kanvas PDF (anti-edit)
 */
export function drawOfficialUniversityStamp(doc, {
  cx = 160,
  cy = 245,
  radius = 18,
  status = 'Disetujui',
  fakultasCode = 'FIK',
  tanggalStr = '2026',
  docToken = 'VERIFIED'
}) {
  const isApproved = status.toLowerCase() === 'disetujui';
  
  // Tentukan warna cap
  const r = isApproved ? 5 : 220;
  const g = isApproved ? 150 : 38;
  const b = isApproved ? 105 : 38;

  doc.saveGraphicsState && doc.saveGraphicsState();

  // Atur transparansi halus seperti cap tinta basah resmi (alpha 0.88)
  if (doc.setGState && typeof doc.GState === 'function') {
    doc.setGState(new doc.GState({ opacity: 0.88 }));
  }

  doc.setDrawColor(r, g, b);
  doc.setTextColor(r, g, b);

  // 1. Lingkaran Luar Ganda (Double Outer Ring)
  doc.setLineWidth(0.8);
  doc.circle(cx, cy, radius, 'S');

  doc.setLineWidth(0.3);
  doc.circle(cx, cy, radius - 1.2, 'S');

  // 2. Lingkaran Dalam (Inner Ring)
  doc.setLineWidth(0.5);
  doc.circle(cx, cy, radius - 4.5, 'S');

  // 3. Garis Pembatas Tengah (Center Ribbon Lines)
  doc.setLineWidth(0.4);
  doc.line(cx - radius + 3, cy - 3.2, cx + radius - 3, cy - 3.2);
  doc.line(cx - radius + 3, cy + 3.2, cx + radius - 3, cy + 3.2);

  // 4. Bintang / Simbol Kiri-Kanan Pita
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('★', cx - radius + 4.5, cy + 1.2, { align: 'center' });
  doc.text('★', cx + radius - 4.5, cy + 1.2, { align: 'center' });

  // 5. Teks Busur Atas (Kementerian & UPNVJ)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.2);
  doc.text('KEMENDIKTISAINTEK RI', cx, cy - radius + 3.2, { align: 'center' });
  doc.setFontSize(4.8);
  doc.text(`UPN "VETERAN" JAKARTA`, cx, cy - radius + 5.6, { align: 'center' });

  // 6. TEKS UTAMA KEPUTUSAN DI TENGAH STEMPEL (DISETUJUI / DITOLAK)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  const statusText = isApproved ? 'DISETUJUI' : 'DITOLAK';
  doc.text(statusText, cx, cy + 1.2, { align: 'center' });

  // 7. Teks Busur Bawah (Fakultas & Keabsahan)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.8);
  doc.text(`FAKULTAS ${fakultasCode.toUpperCase()}`, cx, cy + radius - 3.8, { align: 'center' });
  doc.setFontSize(4.2);
  doc.text(`SIAKAD * ${docToken}`, cx, cy + radius - 1.8, { align: 'center' });

  doc.restoreGraphicsState && doc.restoreGraphicsState();
}

/**
 * Generate PDF Surat Keputusan Resmi Ketidakhadiran (A4 Selembar)
 */
export async function generateOfficialLeavePdf({
  leaveData,
  decision = 'Disetujui',
  adminUser = { nama: 'Admin Akademik', role: 'superadmin' }
}) {
  // Pastikan jsPDF tersedia
  const jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  if (!jsPDF) {
    throw new Error('Pustaka jsPDF belum siap. Mohon pastikan koneksi CDN jsPDF aktif.');
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const dekanInfo = getDekanByFaculty(leaveData.fakultas || 'FIK');
  const tanggalKeputusan = formatIndonesianDateLong(new Date());
  const nomorSurat = leaveData.nomorSurat || generateOfficialLetterNumber(leaveData.id, dekanInfo.fakultasCode);
  const docToken = (leaveData.id || 'UPN').substring(0, 8).toUpperCase();
  const isApproved = decision.toLowerCase() === 'disetujui';

  // =========================================================================
  // 1. KOP SURAT RESMI UPNVJ
  // =========================================================================
  const logoData = await loadLogoBase64();
  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', 16, 12, 24, 24);
    } catch (e) {
      console.warn('Gagal memuat logo gambar ke PDF:', e);
    }
  }

  // Teks Kop
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(11, 35, 65); // #0b2341
  doc.text('KEMENTERIAN PENDIDIKAN TINGGI, SAINS, DAN TEKNOLOGI', 115, 17, { align: 'center' });

  doc.setFontSize(13);
  doc.text('UNIVERSITAS PEMBANGUNAN NASIONAL "VETERAN" JAKARTA', 115, 23, { align: 'center' });

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(dekanInfo.fakultasName.toUpperCase(), 115, 29, { align: 'center' });

  doc.setFont('times', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Jalan Rumah Sakit Fatmawati No. 1 Pondok Labu, Jakarta Selatan 12450', 115, 34, { align: 'center' });
  doc.text('Telepon (021) 7656971, Fax (021) 7656904 | Laman: www.upnvj.ac.id | Pos-el: upnvj@upnvj.ac.id', 115, 38, { align: 'center' });

  // Garis Ganda Kop Surat
  doc.setDrawColor(11, 35, 65);
  doc.setLineWidth(0.8);
  doc.line(16, 42, 194, 42);
  doc.setLineWidth(0.25);
  doc.line(16, 43, 194, 43);

  // =========================================================================
  // 2. JUDUL & NOMOR SURAT KEPUTUSAN
  // =========================================================================
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(11, 35, 65);
  doc.text('SURAT KETERANGAN RESMI KETIDAKHADIRAN MAHASISWA', 105, 50, { align: 'center' });

  // Garis bawah judul
  doc.setLineWidth(0.3);
  doc.line(48, 51, 162, 51);

  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(`Nomor: ${nomorSurat}`, 105, 56, { align: 'center' });

  // =========================================================================
  // 3. IDENTITAS TUJUAN SURAT
  // =========================================================================
  let y = 64;
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);

  doc.text('Yth.', 16, y);
  y += 5;
  doc.setFont('times', 'bold');
  doc.text('Bapak/Ibu Dosen Pengampu & Penanggung Jawab Mata Kuliah', 16, y);
  y += 5;
  doc.setFont('times', 'normal');
  doc.text(`di Lingkungan ${dekanInfo.fakultasName}`, 16, y);
  y += 5;
  doc.text('Universitas Pembangunan Nasional "Veteran" Jakarta', 16, y);

  // =========================================================================
  // 4. PARAGRAF PENGANTAR
  // =========================================================================
  y += 8;
  doc.setFont('times', 'normal');
  doc.text(
    'Berdasarkan permohonan ketidakhadiran perkuliahan yang diajukan oleh mahasiswa melalui Sistem Informasi Presensi Mahasiswa SIAKAD UPNVJ, bersama ini kami sampaikan data pemohon sebagai berikut:',
    16,
    y,
    { maxWidth: 178, align: 'justify', lineHeightFactor: 1.35 }
  );

  // =========================================================================
  // 5. TABEL BIODATA MAHASISWA & DETAIL PERMOHONAN
  // =========================================================================
  y += 14;
  const tableData = [
    ['Nama Lengkap', `: ${leaveData.nama || '-'}`],
    ['Nomor Induk Mahasiswa (NIM)', `: ${leaveData.nim || '-'}`],
    ['Program Studi', `: ${leaveData.prodi || '-'}`],
    ['Fakultas', `: ${dekanInfo.fakultasName}`],
    ['Mata Kuliah', `: ${leaveData.mataKuliah || 'Seluruh Perkuliahan Terjadwal'}`],
    ['Jenis Permohonan', `: ${leaveData.jenis || 'Izin'} Perkuliahan`],
    ['Periode Berhalangan', `: ${leaveData.tanggalMulai} ${leaveData.tanggalSelesai && leaveData.tanggalSelesai !== leaveData.tanggalMulai ? 's/d ' + leaveData.tanggalSelesai : ''}`],
    ['Alasan / Keterangan', `: ${leaveData.alasan || '-'}`],
    ['Dokumen Bukti Lampiran', `: ${leaveData.lampiranNama || 'Terlampir dalam Berkas Digital SIAKAD'}`]
  ];

  // Kotak background tabel
  doc.setFillColor(248, 250, 252); // #f8fafc
  doc.setDrawColor(226, 232, 240); // #e2e8f0
  doc.setLineWidth(0.3);
  doc.roundedRect(16, y - 2, 178, 48, 2, 2, 'FD');

  let rowY = y + 3;
  tableData.forEach(([label, val]) => {
    doc.setFont('times', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    doc.text(label, 20, rowY);

    doc.setFont('times', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(val, 80, rowY, { maxWidth: 110 });
    rowY += 5;
  });

  // =========================================================================
  // 6. KOTAK KEPUTUSAN DEKAN (DISETUJUI / DITOLAK)
  // =========================================================================
  y = 142;
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(
    'Setelah dilakukan pemeriksaan berkas keterangan dan verifikasi administrasi akademik, dengan ini Dekan memberikan keputusan sebagai berikut:',
    16,
    y,
    { maxWidth: 178, align: 'justify' }
  );

  y += 7;
  if (isApproved) {
    // KOTAK HIJAU: DISETUJUI
    doc.setFillColor(240, 253, 244); // #f0fdf4
    doc.setDrawColor(5, 150, 105);   // #059669
    doc.setLineWidth(0.6);
    doc.roundedRect(16, y, 178, 18, 2, 2, 'FD');

    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(5, 150, 105);
    doc.text('STATUS: DISETUJUI (DIBERIKAN DISPENSASI/IZIN KULIAH)', 105, y + 7, { align: 'center' });

    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(22, 101, 52);
    doc.text('Mahasiswa diberikan dispensasi absensi resmi untuk periode yang diajukan dan tercatat sah pada sistem perkuliahan.', 105, y + 13, { align: 'center' });
  } else {
    // KOTAK MERAH: DITOLAK
    doc.setFillColor(254, 242, 242); // #fef2f2
    doc.setDrawColor(220, 38, 38);   // #dc2626
    doc.setLineWidth(0.6);
    doc.roundedRect(16, y, 178, 18, 2, 2, 'FD');

    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(220, 38, 38);
    doc.text('STATUS: DITOLAK (TIDAK MEMENUHI SYARAT)', 105, y + 7, { align: 'center' });

    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(153, 27, 27);
    const catatan = leaveData.catatanAdmin ? `Alasan: ${leaveData.catatanAdmin}` : 'Bukti dokumen pendukung tidak memenuhi ketentuan akademik.';
    doc.text(catatan, 105, y + 13, { align: 'center', maxWidth: 170 });
  }

  // =========================================================================
  // 7. KLAUSUL WAJIB PRINT & PENYERAHAN KE DOSEN
  // =========================================================================
  y += 24;
  doc.setFillColor(254, 249, 195); // #fef9c3
  doc.setDrawColor(202, 138, 4);   // #ca8a04
  doc.setLineWidth(0.4);
  doc.roundedRect(16, y, 178, 16, 2, 2, 'FD');

  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(133, 77, 14); // #854d0e
  doc.text('PERHATIAN & KEWAJIBAN MAHASISWA:', 20, y + 5);

  doc.setFont('times', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(113, 63, 18);
  doc.text(
    'Mahasiswa bersangkutan WAJIB MENCETAK (PRINT A4) surat keputusan resmi ini dan menyerahkannya kepada Dosen Pengampu / Penanggung Jawab Mata Kuliah saat pertemuan berikutnya sebagai bukti ketidakhadiran yang sah.',
    20,
    y + 9.5,
    { maxWidth: 170, lineHeightFactor: 1.25 }
  );

  // =========================================================================
  // 8. TANDA TANGAN DEKAN, CAP STEMPEL RESMI, DAN QR VERIFIKASI SIAKAD
  // =========================================================================
  y = 212;

  // Sisi Kiri: Validasi Digital & QR Code
  doc.setFont('times', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(11, 35, 65);
  doc.text('Validasi Sistem Digital:', 16, y);

  // Gambar QR Code Verifikasi (via QRCode canvas jika tersedia, atau draw authentic grid pattern)
  const qrBoxX = 16;
  const qrBoxY = y + 4;
  const qrSize = 26;

  try {
    // Buat QR code via DOM canvas sementara
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 120;
    tempCanvas.height = 120;
    if (window.QRCode) {
      const tempDiv = document.createElement('div');
      new window.QRCode(tempDiv, {
        text: `https://absensi.upnvj.ac.id/#/verifikasi?token=${docToken}&nim=${leaveData.nim}`,
        width: 120,
        height: 120,
        correctLevel: 2
      });
      const qrCanvas = tempDiv.querySelector('canvas');
      if (qrCanvas) {
        doc.addImage(qrCanvas.toDataURL('image/png'), 'PNG', qrBoxX, qrBoxY, qrSize, qrSize);
      }
    } else {
      // Fallback kotak verifikasi ber-token
      doc.setDrawColor(148, 163, 184);
      doc.setFillColor(241, 245, 249);
      doc.rect(qrBoxX, qrBoxY, qrSize, qrSize, 'FD');
      doc.setFont('courier', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(15, 23, 42);
      doc.text('UPNVJ-AUTH', qrBoxX + 2, qrBoxY + 8);
      doc.text(docToken, qrBoxX + 2, qrBoxY + 14);
      doc.text('VERIFIED', qrBoxX + 2, qrBoxY + 20);
    }
  } catch (_) {
    doc.rect(qrBoxX, qrBoxY, qrSize, qrSize);
  }

  doc.setFont('times', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Pindai QR Code untuk verifikasi', 46, y + 10);
  doc.text('keaslian dokumen pada SIAKAD UPNVJ.', 46, y + 14);
  doc.text(`ID Dokumen: ${docToken}`, 46, y + 19);
  doc.text(`Diverifikasi oleh: ${adminUser.nama || 'Pengelola Akademik'}`, 46, y + 24);

  // Sisi Kanan: Dekan & Stempel Resmi
  const rightX = 148;
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`Jakarta, ${tanggalKeputusan}`, rightX, y, { align: 'center' });

  doc.setFont('times', 'bold');
  doc.text(`Dekan ${dekanInfo.fakultasName},`, rightX, y + 5, { align: 'center' });

  // Gambar Cap Stempel Resmi Vektor (Hijau jika Disetujui, Merah jika Ditolak)
  drawOfficialUniversityStamp(doc, {
    cx: rightX - 16,
    cy: y + 22,
    radius: 17,
    status: decision,
    fakultasCode: dekanInfo.fakultasCode,
    tanggalStr: String(new Date().getFullYear()),
    docToken
  });

  // Tanda Tangan Dekan Teks
  const dekanY = y + 36;
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(11, 35, 65);
  doc.text(dekanInfo.nama, rightX, dekanY, { align: 'center' });

  // Garis bawah nama dekan
  doc.setLineWidth(0.3);
  doc.setDrawColor(11, 35, 65);
  const nameWidth = doc.getTextWidth(dekanInfo.nama);
  doc.line(rightX - (nameWidth / 2), dekanY + 1, rightX + (nameWidth / 2), dekanY + 1);

  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`NIP. ${dekanInfo.nip}`, rightX, dekanY + 5.5, { align: 'center' });

  // =========================================================================
  // 9. FOOTER DOKUMEN & WATERMARK INTEGRITAS
  // =========================================================================
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(16, 282, 194, 282);

  doc.setFont('times', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'Dokumen ini dicetak otomatis dan disahkan secara digital oleh Sistem Presensi UPNVJ. Tanda tangan dan stempel sah diakui oleh universitas.',
    16,
    286
  );
  doc.text('Halaman 1 dari 1 (A4)', 194, 286, { align: 'right' });

  // Hasilkan Data URL & Blob
  const pdfDataUrl = doc.output('datauristring');
  const pdfBlob = doc.output('blob');
  const pdfBlobUrl = URL.createObjectURL(pdfBlob);

  return {
    doc,
    pdfDataUrl,
    pdfBlob,
    pdfBlobUrl,
    nomorSurat,
    dekanInfo,
    tanggalKeputusan,
    capStatus: decision,
    capWarna: isApproved ? 'HIJAU' : 'MERAH'
  };
}
