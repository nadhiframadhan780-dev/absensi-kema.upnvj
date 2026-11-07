/**
 * Modul Generator Surat Keputusan Resmi Ketidakhadiran (Izin / Sakit / Dispensasi)
 * Universitas Pembangunan Nasional "Veteran" Jakarta - Admin Side
 * Sesuai format naskah dinas resmi institusi A4 1 lembar:
 * - Layout rapi, proporsional, tanpa tumpang tindih teks (zero text overlapping)
 * - Stempel Resmi Berwarna (HIJAU jika Disetujui, MERAH jika Ditolak) tepat di TENGAH
 * - Kolom Tanda Tangan Mahasiswa Pemohon lengkap dengan Kotak MATERAI Rp 10.000, Nama & NIM otomatis
 * - Kolom Tanda Tangan Dekan Fakultas & NIP Resmi
 * - QR Code Verifikasi SIAKAD & ID Dokumen Digital
 */

import { getDekanByFaculty } from './data.js';

export function formatIndonesianDateLong(dateInput) {
  if (!dateInput) return new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
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

export function generateOfficialLetterNumber(leaveId, fakultasCode, year) {
  const currentYear = year || new Date().getFullYear();
  const code = (fakultasCode || 'UN61').toUpperCase();
  let seed = 100;
  if (leaveId) {
    for (let i = 0; i < leaveId.length; i++) {
      seed = (seed * 31 + leaveId.charCodeAt(i)) % 900;
    }
  }
  const seqNumber = String(100 + seed).padStart(3, '0');
  return `B/${seqNumber}/UN61.0/${code}.KM.01/${currentYear}`;
}

export function dataUrlToBlob(dataUrl) {
  if (!dataUrl) return null;
  if (typeof dataUrl === 'object' && dataUrl instanceof Blob) return dataUrl;
  if (typeof dataUrl !== 'string') return null;
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

export function openDocumentPreviewSafely(dataUrl, fileName = 'Dokumen_UPNVJ') {
  if (!dataUrl) {
    alert('Dokumen tidak ditemukan.');
    return;
  }

  if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
    window.open(dataUrl, '_blank');
    return;
  }

  const blob = dataUrlToBlob(dataUrl);
  if (blob) {
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, '_blank');
    if (!win || win.closed || typeof win.closed === 'undefined') {
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
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

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

async function loadLogoBase64() {
  const possiblePaths = [
    '../assets/logo-upnvj.png',
    '/assets/logo-upnvj.png',
    'assets/logo-upnvj.png',
    '../public/assets/logo-upnvj.png'
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

export function drawOfficialUniversityStamp(doc, {
  cx = 148,
  cy = 205,
  radius = 17,
  status = 'Disetujui',
  fakultasCode = 'FIK',
  tanggalStr = '2026',
  docToken = 'VERIFIED'
}) {
  const isApproved = status.toLowerCase() === 'disetujui';
  
  const r = isApproved ? 5 : 220;
  const g = isApproved ? 150 : 38;
  const b = isApproved ? 105 : 38;

  doc.saveGraphicsState && doc.saveGraphicsState();

  if (doc.setGState && typeof doc.GState === 'function') {
    doc.setGState(new doc.GState({ opacity: 0.88 }));
  }

  doc.setDrawColor(r, g, b);
  doc.setTextColor(r, g, b);

  // 1. Lingkaran Luar Ganda
  doc.setLineWidth(0.85);
  doc.circle(cx, cy, radius, 'S');

  doc.setLineWidth(0.35);
  doc.circle(cx, cy, radius - 1.2, 'S');

  // 2. Lingkaran Dalam
  doc.setLineWidth(0.5);
  doc.circle(cx, cy, radius - 4.5, 'S');

  // 3. Garis Pembatas Pita Tengah
  doc.setLineWidth(0.4);
  doc.line(cx - radius + 3, cy - 3.4, cx + radius - 3, cy - 3.4);
  doc.line(cx - radius + 3, cy + 3.4, cx + radius - 3, cy + 3.4);

  // 4. Bintang Kiri-Kanan Pita
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('★', cx - radius + 4.5, cy + 1.2, { align: 'center' });
  doc.text('★', cx + radius - 4.5, cy + 1.2, { align: 'center' });

  // 5. Teks Busur Atas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.2);
  doc.text('KEMENDIKTISAINTEK RI', cx, cy - radius + 3.4, { align: 'center' });
  doc.setFontSize(4.8);
  doc.text(`UPN "VETERAN" JAKARTA`, cx, cy - radius + 6.0, { align: 'center' });

  // 6. TEKS UTAMA KEPUTUSAN DI TENGAH STEMPEL
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  const statusText = isApproved ? 'DISETUJUI' : 'DITOLAK';
  doc.text(statusText, cx, cy + 1.2, { align: 'center' });

  // 7. Teks Busur Bawah
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.8);
  doc.text(`FAKULTAS ${fakultasCode.toUpperCase()}`, cx, cy + radius - 3.8, { align: 'center' });
  doc.setFontSize(4.2);
  doc.text(`SIAKAD * ${docToken}`, cx, cy + radius - 1.8, { align: 'center' });

  doc.restoreGraphicsState && doc.restoreGraphicsState();
}

export async function generateOfficialLeavePdf({
  leaveData,
  decision = 'Disetujui',
  adminUser = { nama: 'Admin Akademik', role: 'superadmin' }
}) {
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

  // 1. KOP SURAT
  const logoData = await loadLogoBase64();
  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', 16, 10, 22, 22);
    } catch (e) {
      console.warn('Gagal memuat logo gambar ke PDF:', e);
    }
  }

  doc.setFont('times', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(11, 35, 65);
  doc.text('KEMENTERIAN PENDIDIKAN TINGGI, SAINS, DAN TEKNOLOGI', 116, 14, { align: 'center' });

  doc.setFontSize(12.5);
  doc.text('UNIVERSITAS PEMBANGUNAN NASIONAL "VETERAN" JAKARTA', 116, 19.5, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(dekanInfo.fakultasName.toUpperCase(), 116, 24.5, { align: 'center' });

  doc.setFont('times', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Jalan Rumah Sakit Fatmawati No. 1 Pondok Labu, Jakarta Selatan 12450', 116, 29, { align: 'center' });
  doc.text('Telepon (021) 7656971 | Laman: www.upnvj.ac.id | Pos-el: upnvj@upnvj.ac.id', 116, 32.5, { align: 'center' });

  // Garis Ganda Kop Surat
  doc.setDrawColor(11, 35, 65);
  doc.setLineWidth(0.75);
  doc.line(16, 36, 194, 36);
  doc.setLineWidth(0.25);
  doc.line(16, 37, 194, 37);

  // 2. JUDUL & NOMOR SURAT KEPUTUSAN
  doc.setFont('times', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(11, 35, 65);
  doc.text('SURAT KETERANGAN RESMI KETIDAKHADIRAN MAHASISWA', 105, 43.5, { align: 'center' });

  const titleWidth = doc.getTextWidth('SURAT KETERANGAN RESMI KETIDAKHADIRAN MAHASISWA');
  doc.setLineWidth(0.3);
  doc.line(105 - (titleWidth / 2), 44.5, 105 + (titleWidth / 2), 44.5);

  doc.setFont('times', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Nomor: ${nomorSurat}`, 105, 49, { align: 'center' });

  // 3. IDENTITAS TUJUAN SURAT & PENGANTAR
  let curY = 55;
  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);

  doc.text('Yth. Bapak/Ibu Dosen Pengampu & Penanggung Jawab Mata Kuliah', 16, curY);
  curY += 4.2;
  doc.text(`di Lingkungan ${dekanInfo.fakultasName}, UPN "Veteran" Jakarta`, 16, curY);

  curY += 6;
  doc.text(
    'Berdasarkan permohonan ketidakhadiran perkuliahan yang diajukan melalui Sistem Informasi Presensi Mahasiswa SIAKAD UPNVJ, bersama ini kami sampaikan data pemohon sebagai berikut:',
    16,
    curY,
    { maxWidth: 178, align: 'justify', lineHeightFactor: 1.25 }
  );

  // 4. TABEL BIODATA MAHASISWA (DYNAMIC ROW HEIGHT - ANTI NYATU)
  curY += 9;

  const dateRangeStr = leaveData.tanggalMulai === leaveData.tanggalSelesai || !leaveData.tanggalSelesai
    ? leaveData.tanggalMulai
    : `${leaveData.tanggalMulai} s/d ${leaveData.tanggalSelesai}`;

  const tableRows = [
    { label: 'Nama Lengkap Mahasiswa', val: leaveData.nama || '-' },
    { label: 'Nomor Induk Mahasiswa (NIM)', val: leaveData.nim || '-' },
    { label: 'Program Studi / Fakultas', val: `${leaveData.prodi || '-'} / ${dekanInfo.fakultasName}` },
    { label: 'Mata Kuliah', val: leaveData.mataKuliah || 'Seluruh Perkuliahan Terjadwal' },
    { label: 'Jenis Permohonan', val: `${leaveData.jenis || 'Izin'} Perkuliahan` },
    { label: 'Periode Berhalangan', val: dateRangeStr },
    { label: 'Alasan / Keterangan', val: leaveData.alasan || '-' }
  ];

  const calculatedRows = tableRows.map(row => {
    doc.setFont('times', 'normal');
    doc.setFontSize(8.5);
    const wrappedLines = doc.splitTextToSize(`: ${row.val}`, 115);
    const rowHeight = Math.max(wrappedLines.length * 4.0, 4.8);
    return { ...row, wrappedLines, rowHeight };
  });

  const totalTableHeight = calculatedRows.reduce((sum, r) => sum + r.rowHeight, 0) + 4;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(16, curY, 178, totalTableHeight, 2, 2, 'FD');

  let tableRowY = curY + 3.2;
  calculatedRows.forEach((row, idx) => {
    doc.setFont('times', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text(row.label, 20, tableRowY);

    doc.setFont('times', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(row.wrappedLines, 74, tableRowY);

    tableRowY += row.rowHeight;

    if (idx < calculatedRows.length - 1) {
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.2);
      doc.line(20, tableRowY - 0.8, 190, tableRowY - 0.8);
    }
  });

  curY += totalTableHeight + 5;

  // 5. KOTAK KEPUTUSAN DEKAN
  doc.setFont('times', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text(
    'Setelah dilakukan pemeriksaan berkas dan verifikasi administrasi akademik, dengan ini Dekan menerbitkan keputusan:',
    16,
    curY,
    { maxWidth: 178, align: 'justify' }
  );

  curY += 5;
  if (isApproved) {
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(5, 150, 105);
    doc.setLineWidth(0.6);
    doc.roundedRect(16, curY, 178, 15, 2, 2, 'FD');

    doc.setFont('times', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(5, 150, 105);
    doc.text('STATUS: DISETUJUI (DIBERIKAN DISPENSASI/IZIN KULIAH)', 105, curY + 6, { align: 'center' });

    doc.setFont('times', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(22, 101, 52);
    doc.text('Mahasiswa diberikan dispensasi absensi resmi untuk periode yang diajukan dan tercatat sah pada SIAKAD UPNVJ.', 105, curY + 11, { align: 'center' });
  } else {
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.6);
    doc.roundedRect(16, curY, 178, 15, 2, 2, 'FD');

    doc.setFont('times', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(220, 38, 38);
    doc.text('STATUS: DITOLAK (TIDAK MEMENUHI SYARAT)', 105, curY + 6, { align: 'center' });

    doc.setFont('times', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(153, 27, 27);
    const catatan = leaveData.catatanAdmin ? `Alasan: ${leaveData.catatanAdmin}` : 'Bukti dokumen pendukung tidak memenuhi ketentuan akademik.';
    doc.text(catatan, 105, curY + 11, { align: 'center', maxWidth: 170 });
  }

  curY += 19;

  // 6. KOTAK INSTRUKSI WAJIB PRINT & WAJIB TEMPEL MATERAI
  doc.setFillColor(254, 249, 195);
  doc.setDrawColor(202, 138, 4);
  doc.setLineWidth(0.35);
  doc.roundedRect(16, curY, 178, 13, 2, 2, 'FD');

  doc.setFont('times', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(133, 77, 14);
  doc.text('PERHATIAN & KEWAJIBAN MAHASISWA:', 20, curY + 4.5);

  doc.setFont('times', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(113, 63, 18);
  doc.text(
    'Mahasiswa bersangkutan WAJIB MENCETAK (PRINT A4) surat ini, MENEMPELKAN MATERAI Rp 10.000 pada kolom yang disediakan, menandatanganinya, dan menyerahkannya kepada Dosen Pengampu / Penanggung Jawab Mata Kuliah.',
    20,
    curY + 8.5,
    { maxWidth: 170, lineHeightFactor: 1.2 }
  );

  curY += 18;

  // 7. PENGESAHAN DUA PIHAK: MAHASISWA (MATERAI) + STEMPEL DI TENGAH + DEKAN
  const leftColX = 54;
  const centerColX = 105;
  const rightColX = 156;
  const sigStartY = curY;

  // SISI KIRI: MAHASISWA
  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Mahasiswa Pemohon,', leftColX, sigStartY, { align: 'center' });

  const materaiBoxW = 28;
  const materaiBoxH = 17;
  const materaiBoxX = leftColX - (materaiBoxW / 2);
  const materaiBoxY = sigStartY + 4;

  doc.saveGraphicsState && doc.saveGraphicsState();
  doc.setDrawColor(202, 138, 4);
  doc.setFillColor(254, 252, 232);
  if (doc.setLineDashPattern) {
    doc.setLineDashPattern([1.5, 1], 0);
  }
  doc.setLineWidth(0.4);
  doc.rect(materaiBoxX, materaiBoxY, materaiBoxW, materaiBoxH, 'FD');
  doc.restoreGraphicsState && doc.restoreGraphicsState();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(161, 98, 7);
  doc.text('MATERAI', leftColX, materaiBoxY + 5.5, { align: 'center' });
  doc.setFontSize(6.8);
  doc.text('Rp 10.000', leftColX, materaiBoxY + 10, { align: 'center' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(5.2);
  doc.setTextColor(180, 83, 9);
  doc.text('(Tempel di sini)', leftColX, materaiBoxY + 14, { align: 'center' });

  doc.setFont('times', 'italic');
  doc.setFontSize(6.2);
  doc.setTextColor(100, 116, 139);
  doc.text('*(Tanda tangan mengenai materai)', leftColX, materaiBoxY + materaiBoxH + 4, { align: 'center' });

  const studentNameY = sigStartY + 33;
  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(11, 35, 65);
  const studentName = leaveData.nama || 'Nama Mahasiswa';
  doc.text(studentName, leftColX, studentNameY, { align: 'center' });

  const studentNameW = doc.getTextWidth(studentName);
  doc.setLineWidth(0.3);
  doc.setDrawColor(11, 35, 65);
  doc.line(leftColX - (studentNameW / 2), studentNameY + 1, leftColX + (studentNameW / 2), studentNameY + 1);

  doc.setFont('times', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`NIM. ${leaveData.nim || '-'}`, leftColX, studentNameY + 5, { align: 'center' });

  // SISI KANAN: DEKAN
  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`Jakarta, ${tanggalKeputusan}`, rightColX, sigStartY, { align: 'center' });
  doc.setFont('times', 'bold');
  doc.text('Mengesahkan,', rightColX, sigStartY + 4.2, { align: 'center' });
  doc.text(`Dekan ${dekanInfo.fakultasName},`, rightColX, sigStartY + 8.4, { align: 'center' });

  const dekanNameY = sigStartY + 33;
  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(11, 35, 65);
  doc.text(dekanInfo.nama, rightColX, dekanNameY, { align: 'center' });

  const dekanNameW = doc.getTextWidth(dekanInfo.nama);
  doc.setLineWidth(0.3);
  doc.setDrawColor(11, 35, 65);
  doc.line(rightColX - (dekanNameW / 2), dekanNameY + 1, rightColX + (dekanNameW / 2), dekanNameY + 1);

  doc.setFont('times', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`NIP. ${dekanInfo.nip}`, rightColX, dekanNameY + 5, { align: 'center' });

  // POSISI STEMPEL RESMI PADA BAGIAN PENGESAHAN DEKAN
  drawOfficialUniversityStamp(doc, {
    cx: rightColX - 8,
    cy: sigStartY + 20,
    radius: 17,
    status: decision,
    fakultasCode: dekanInfo.fakultasCode,
    tanggalStr: String(new Date().getFullYear()),
    docToken
  });

  // 8. KOTAK VALIDASI DIGITAL SIAKAD (FOOTER)
  const footerBoxY = 252;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(16, footerBoxY, 178, 22, 2, 2, 'FD');

  const qrBoxX = 20;
  const qrBoxY = footerBoxY + 2.5;
  const qrSize = 17;

  try {
    const tempDiv = document.createElement('div');
    if (window.QRCode) {
      new window.QRCode(tempDiv, {
        text: `https://absensi.upnvj.ac.id/#/verifikasi?token=${docToken}&nim=${leaveData.nim}`,
        width: 100,
        height: 100,
        correctLevel: 2
      });
      const qrCanvas = tempDiv.querySelector('canvas');
      if (qrCanvas) {
        doc.addImage(qrCanvas.toDataURL('image/png'), 'PNG', qrBoxX, qrBoxY, qrSize, qrSize);
      }
    } else {
      doc.setDrawColor(148, 163, 184);
      doc.setFillColor(241, 245, 249);
      doc.rect(qrBoxX, qrBoxY, qrSize, qrSize, 'FD');
      doc.setFont('courier', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(15, 23, 42);
      doc.text('UPNVJ', qrBoxX + 1.5, qrBoxY + 6);
      doc.text(docToken, qrBoxX + 1.5, qrBoxY + 11);
      doc.text('AUTH', qrBoxX + 1.5, qrBoxY + 15);
    }
  } catch (_) {
    doc.rect(qrBoxX, qrBoxY, qrSize, qrSize);
  }

  doc.setFont('times', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(11, 35, 65);
  doc.text('Validasi Sistem Informasi Presensi SIAKAD UPNVJ', 42, footerBoxY + 6.5);

  doc.setFont('times', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`ID Dokumen Digital: ${docToken} | Verifikasi Otomatis melalui Portal Presensi UPNVJ`, 42, footerBoxY + 11);
  doc.text(`Diverifikasi oleh: ${adminUser.nama || 'Pengelola Akademik'} (${adminUser.role || 'Admin'})`, 42, footerBoxY + 15);
  doc.text('Dokumen ini sah dan diakui sebagai bukti izin/dispensasi resmi institusi.', 42, footerBoxY + 19);

  doc.setFont('times', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Dicetak melalui Sistem Presensi Mahasiswa UPN "Veteran" Jakarta | Halaman 1 dari 1 (A4)', 105, 282, { align: 'center' });

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
