/**
 * Utility Functions: Formatter Tanggal WIB, Sanitasi XSS, Debounce, & Ekspor Dokumen
 * Universitas Pembangunan Nasional "Veteran" Jakarta
 */

/**
 * Mencegah XSS injection pada tampilan HTML
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format Tanggal Indonesia (Zona Waktu Asia/Jakarta)
 * Contoh: "Senin, 2 November 2026"
 */
export function formatDateWIB(dateInput) {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  return d.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Format Jam Indonesia (WIB)
 * Contoh: "08:30 WIB"
 */
export function formatTimeWIB(dateInput) {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  return d.toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit'
  }) + ' WIB';
}

/**
 * Format Tanggal & Jam Singkat
 * Contoh: "02/11/2026 08:30 WIB"
 */
export function formatDateTimeWIB(dateInput) {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  const tgl = d.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' });
  const jam = d.toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit'
  });
  return `${tgl} ${jam} WIB`;
}

/**
 * Mendapatkan string YYYY-MM-DD hari ini di zona waktu WIB
 */
export function getTodayWIB() {
  const d = new Date();
  // Offset WIB adalah UTC+7
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const wibDate = new Date(utc + (3600000 * 7));
  return wibDate.toISOString().split('T')[0];
}

/**
 * Debounce helper untuk input pencarian langsung
 */
export function debounce(func, delay = 300) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Memecah array besar menjadi chunk maksimal 500 item (Batas Firestore Batch)
 */
export function chunkArray(array, size = 500) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Mengunduh blob sebagai file di peramban pengguna
 */
export function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Ekspor data ke file Excel (.xlsx) menggunakan SheetJS
 */
export function exportToExcel(dataArray, filename, sheetName = 'Sheet1') {
  if (!window.XLSX) {
    throw new Error('Pustaka SheetJS (XLSX) belum dimuat.');
  }
  const worksheet = window.XLSX.utils.json_to_sheet(dataArray);
  const workbook = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  window.XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/**
 * Ekspor data ke file CSV
 */
export function exportToCSV(dataArray, filename) {
  if (!dataArray || dataArray.length === 0) return;
  const headers = Object.keys(dataArray[0]);
  const rows = dataArray.map(obj => 
    headers.map(header => `"${String(obj[header] ?? '').replace(/"/g, '""')}"`).join(',')
  );
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadFile(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

/**
 * Ekspor Laporan Resmi ke PDF dengan Kop Surat UPNVJ & Area Tanda Tangan
 */
export function exportToPDF({ title, subtitle, columns, rows, filename, signerName, signerRole = 'Koordinator Program Studi' }) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    throw new Error('Pustaka jsPDF belum dimuat.');
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape', 'mm', 'a4');

  // Header Kop Kampus
  doc.setFillColor(11, 35, 65); // Navy UPNVJ
  doc.rect(0, 0, 297, 20, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text("UNIVERSITAS PEMBANGUNAN NASIONAL 'VETERAN' JAKARTA", 148.5, 9, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text("Sistem Informasi Presensi Digital Terpadu Kampus Bela Negara", 148.5, 15, { align: 'center' });

  // Garis Emas Aksent
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(1.5);
  doc.line(0, 20, 297, 20);

  // Judul Laporan
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 30);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(subtitle || `Dicetak pada: ${formatDateTimeWIB(new Date())}`, 14, 36);

  // Tabel Data via autoTable
  if (doc.autoTable) {
    doc.autoTable({
      startY: 42,
      head: [columns],
      body: rows,
      theme: 'grid',
      headStyles: {
        fillColor: [11, 35, 65],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 2.5,
        overflow: 'linebreak'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: 14, right: 14 }
    });

    // Area Tanda Tangan
    const finalY = doc.lastAutoTable.finalY || 150;
    const signY = finalY + 16 > 175 ? 175 : finalY + 16;

    if (signY + 30 <= 200) {
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      const signX = 220;
      doc.text(`Jakarta, ${formatDateWIB(new Date()).replace(/^[A-Za-z]+,\s*/, '')}`, signX, signY);
      doc.text(signerRole, signX, signY + 5);
      doc.text("Mengetahui,", signX, signY + 10);
      
      doc.line(signX, signY + 28, signX + 50, signY + 28);
      doc.setFont('helvetica', 'bold');
      doc.text(signerName || "Pengelola Akademik", signX, signY + 33);
    }
  }

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/**
 * Generate Kode Sesi 6 Digit Alphanumerik (contoh: 847291)
 */
export function generateSessionCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate Token Dinamis QR Code Sesi (32 karakter acak)
 */
export function generateQrToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
