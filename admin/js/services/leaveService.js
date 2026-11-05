/**
 * Leave Service: Manajemen Pengajuan Izin & Sakit Mahasiswa
 * Universitas Pembangunan Nasional "Veteran" Jakarta
 */
import { 
  db, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  addDoc,
  query, 
  where, 
  orderBy, 
  onSnapshot,
  writeBatch 
} from '../firebase.js';
import { generateOfficialLeavePdf } from '../officialLetterPdf.js';

export function listenPendingLeaveRequestsCount(onCountUpdate) {
  const q = query(
    collection(db, 'leaveRequests'),
    where('status', '==', 'Menunggu')
  );
  return onSnapshot(q, (snap) => {
    onCountUpdate(snap.size);
  }, () => {});
}

export async function fetchLeaveRequests({ status = 'all', fakultas = 'all', prodi = 'all' } = {}) {
  try {
    let constraints = [];
    if (status && status !== 'all') {
      constraints.push(where('status', '==', status));
    }
    if (fakultas && fakultas !== 'all') {
      constraints.push(where('fakultas', '==', fakultas));
    }
    if (prodi && prodi !== 'all') {
      constraints.push(where('prodi', '==', prodi));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(collection(db, 'leaveRequests'), ...constraints);
    const snap = await getDocs(q);

    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    throw error;
  }
}

/**
 * Setujui Pengajuan Izin/Sakit:
 * 1. Otomatis Menghasilkan Surat Keputusan Resmi Dekan (A4 PDF) Ber-Cap Stempel Hijau
 * 2. Menyimpan Surat ke Firestore leaveRequests/{requestId} sehingga otomatis diterima mahasiswa
 * 3. Otomatis Mencatat Presensi Mahasiswa Menjadi "Izin" atau "Sakit"
 */
export async function approveLeaveRequest(requestId, adminNote, adminUser) {
  const reqRef = doc(db, 'leaveRequests', requestId);
  const snap = await getDoc(reqRef);
  if (!snap.exists()) throw new Error('Pengajuan tidak ditemukan.');

  const reqData = snap.data();
  let statusBaru = 'Izin';
  if (reqData.jenis === 'Sakit') statusBaru = 'Sakit';
  else if (reqData.jenis === 'Dispensasi') statusBaru = 'Dispensasi';
  else statusBaru = 'Izin';

  // Buat Surat Keputusan Resmi Format PDF Ber-Cap Hijau UPNVJ
  let officialPdf = null;
  try {
    officialPdf = await generateOfficialLeavePdf({
      leaveData: { id: requestId, ...reqData },
      decision: 'Disetujui',
      adminUser
    });
  } catch (pdfErr) {
    console.error('Peringatan: Gagal generate PDF surat izin:', pdfErr);
  }

  const batch = writeBatch(db);

  // 1. Update status pengajuan beserta Surat Keputusan Resmi
  const updatePayload = {
    status: 'Disetujui',
    catatanAdmin: adminNote || 'Disetujui oleh pengelola akademik',
    diprosesOleh: `${adminUser.nama} (${adminUser.role})`,
    updatedAt: new Date().toISOString()
  };

  if (officialPdf) {
    updatePayload.suratKeputusanPdf = officialPdf.pdfDataUrl;
    updatePayload.suratNomor = officialPdf.nomorSurat;
    updatePayload.dekanNama = officialPdf.dekanInfo.nama;
    updatePayload.dekanNip = officialPdf.dekanInfo.nip;
    updatePayload.dekanFakultas = officialPdf.dekanInfo.fakultasName;
    updatePayload.capWarna = 'HIJAU';
    updatePayload.capStatus = 'Disetujui';
    updatePayload.tanggalKeputusan = officialPdf.tanggalKeputusan;
  }

  batch.update(reqRef, updatePayload);

  // 2. Buat atau perbarui catatan absensi
  const newAttRef = doc(collection(db, 'attendance'));
  batch.set(newAttRef, {
    uid: reqData.uid,
    nim: reqData.nim,
    nama: reqData.nama,
    fakultas: reqData.fakultas,
    prodi: reqData.prodi,
    mataKuliah: reqData.mataKuliah || 'Izin Kuliah Terpadu',
    sesiId: reqData.sesiId || '',
    tanggal: reqData.tanggalMulai || new Date().toISOString().split('T')[0],
    waktu: 'Disetujui Izin',
    status: statusBaru,
    metode: 'sistem',
    keterangan: `Disetujui pengajuan ${reqData.jenis}: ${reqData.alasan || ''}`,
    createdAt: new Date().toISOString()
  });

  await batch.commit();

  return officialPdf;
}

/**
 * Tolak Pengajuan:
 * Otomatis Menghasilkan Surat Keputusan Penolakan Ber-Cap Stempel Merah
 */
export async function rejectLeaveRequest(requestId, rejectReason, adminUser) {
  if (!rejectReason || rejectReason.trim().length < 3) {
    throw new Error('Alasan penolakan izin wajib diisi.');
  }

  const reqRef = doc(db, 'leaveRequests', requestId);
  const snap = await getDoc(reqRef);
  if (!snap.exists()) throw new Error('Pengajuan tidak ditemukan.');
  const reqData = snap.data();

  // Buat Surat Keputusan Penolakan Resmi Format PDF Ber-Cap Merah UPNVJ
  let officialPdf = null;
  try {
    officialPdf = await generateOfficialLeavePdf({
      leaveData: { id: requestId, ...reqData, catatanAdmin: rejectReason.trim() },
      decision: 'Ditolak',
      adminUser
    });
  } catch (pdfErr) {
    console.error('Peringatan: Gagal generate PDF penolakan:', pdfErr);
  }

  const updatePayload = {
    status: 'Ditolak',
    catatanAdmin: rejectReason.trim(),
    diprosesOleh: `${adminUser.nama} (${adminUser.role})`,
    updatedAt: new Date().toISOString()
  };

  if (officialPdf) {
    updatePayload.suratKeputusanPdf = officialPdf.pdfDataUrl;
    updatePayload.suratNomor = officialPdf.nomorSurat;
    updatePayload.dekanNama = officialPdf.dekanInfo.nama;
    updatePayload.dekanNip = officialPdf.dekanInfo.nip;
    updatePayload.dekanFakultas = officialPdf.dekanInfo.fakultasName;
    updatePayload.capWarna = 'MERAH';
    updatePayload.capStatus = 'Ditolak';
    updatePayload.tanggalKeputusan = officialPdf.tanggalKeputusan;
  }

  await updateDoc(reqRef, updatePayload);

  return officialPdf;
}
