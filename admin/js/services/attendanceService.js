/**
 * Attendance Service: Pencatatan, Koreksi, & Filter Rekapitulasi Presensi
 * Universitas Pembangunan Nasional "Veteran" Jakarta
 */
import { 
  db, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  onSnapshot, 
  writeBatch 
} from '../firebase.js';
import { chunkArray, getTodayWIB } from '../utils.js';

export function listenTodayAttendance(onUpdate) {
  const today = getTodayWIB();
  const q = query(
    collection(db, 'attendance'),
    where('tanggal', '==', today),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    onUpdate(list);
  }, (err) => {
    console.warn('Gagal memantau absensi hari ini:', err);
  });
}

export async function fetchAttendanceList({
  startDate = '',
  endDate = '',
  fakultas = 'all',
  prodi = 'all',
  mataKuliah = '',
  status = 'all',
  metode = 'all',
  nimQuery = '',
  pageSize = 20,
  lastVisibleDoc = null
} = {}) {
  try {
    let constraints = [];

    if (fakultas && fakultas !== 'all') constraints.push(where('fakultas', '==', fakultas));
    if (prodi && prodi !== 'all') constraints.push(where('prodi', '==', prodi));
    if (status && status !== 'all') constraints.push(where('status', '==', status));
    if (metode && metode !== 'all') constraints.push(where('metode', '==', metode));

    if (startDate && endDate) {
      constraints.push(where('tanggal', '>=', startDate));
      constraints.push(where('tanggal', '<=', endDate));
    } else if (startDate) {
      constraints.push(where('tanggal', '==', startDate));
    }

    constraints.push(orderBy('tanggal', 'desc'));
    constraints.push(orderBy('createdAt', 'desc'));

    if (lastVisibleDoc) {
      constraints.push(startAfter(lastVisibleDoc));
    }
    constraints.push(limit(pageSize));

    const q = query(collection(db, 'attendance'), ...constraints);
    const snap = await getDocs(q);

    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Filter memori jika ada input nama MK atau NIM
    if (mataKuliah) {
      const mkLower = mataKuliah.toLowerCase();
      list = list.filter(item => (item.mataKuliah || '').toLowerCase().includes(mkLower));
    }
    if (nimQuery) {
      const qLower = nimQuery.trim().toLowerCase();
      list = list.filter(item => 
        (item.nim && item.nim.includes(qLower)) ||
        (item.nama && item.nama.toLowerCase().includes(qLower))
      );
    }

    return {
      records: list,
      lastVisible: snap.docs[snap.docs.length - 1] || null,
      hasMore: snap.docs.length === pageSize
    };
  } catch (error) {
    console.error('Error fetching attendance list:', error);
    throw error;
  }
}

/**
 * Tambah Catatan Kehadiran Manual dengan Pengecekan Duplikat
 */
export async function addManualAttendance(recordData) {
  // Cek duplikat (NIM + Mata Kuliah + Tanggal)
  const dupQ = query(
    collection(db, 'attendance'),
    where('nim', '==', recordData.nim),
    where('tanggal', '==', recordData.tanggal)
  );
  const dupSnap = await getDocs(dupQ);
  const isDuplicate = dupSnap.docs.some(d => {
    const data = d.data();
    return data.mataKuliah === recordData.mataKuliah || (recordData.sesiId && data.sesiId === recordData.sesiId);
  });

  if (isDuplicate) {
    throw new Error(`Mahasiswa ${recordData.nim} sudah memiliki data presensi pada mata kuliah ini di tanggal ${recordData.tanggal}.`);
  }

  const docRef = await addDoc(collection(db, 'attendance'), {
    ...recordData,
    metode: recordData.metode || 'manual',
    status: recordData.status || 'Hadir',
    createdAt: new Date().toISOString()
  });

  return { id: docRef.id, ...recordData };
}

/**
 * Koreksi Status Presensi dengan Wajib Mencatat Alasan & Identitas Admin
 */
export async function updateAttendanceStatus(docId, newStatus, reason, adminUser) {
  if (!reason || reason.trim().length < 3) {
    throw new Error('Alasan perubahan status wajib diisi secara jelas.');
  }

  const ref = doc(db, 'attendance', docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error('Catatan presensi tidak ditemukan.');
  }

  const oldData = snap.data();
  const updatePayload = {
    status: newStatus,
    diubahOleh: `${adminUser.nama || 'Admin'} (${adminUser.role})`,
    diubahPada: new Date().toISOString(),
    alasanUbah: reason.trim(),
    riwayatKoreksi: [
      ...(oldData.riwayatKoreksi || []),
      {
        statusSebelumnya: oldData.status,
        statusBaru: newStatus,
        diubahOleh: adminUser.nama || 'Admin',
        waktu: new Date().toISOString(),
        alasan: reason.trim()
      }
    ]
  };

  await updateDoc(ref, updatePayload);
  return { id: docId, ...oldData, ...updatePayload };
}

export async function deleteAttendanceRecord(docId) {
  await deleteDoc(doc(db, 'attendance', docId));
}

export async function batchDeleteAttendance(docIds) {
  const chunks = chunkArray(docIds, 400);
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach(id => batch.delete(doc(db, 'attendance', id)));
    await batch.commit();
  }
}
