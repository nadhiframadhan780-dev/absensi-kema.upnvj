/**
 * Settings Service: Konfigurasi Sistem, Geofencing, Backup, & Reset
 * Universitas Pembangunan Nasional "Veteran" Jakarta
 */
import { 
  db, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  writeBatch 
} from '../firebase.js';
import { DEFAULT_SETTINGS } from '../data.js';
import { chunkArray, downloadFile } from '../utils.js';

export async function fetchSystemSettings() {
  try {
    const ref = doc(db, 'settings', 'general');
    const snap = await getDoc(ref);

    if (snap.exists()) {
      return { ...DEFAULT_SETTINGS, ...snap.data() };
    } else {
      // Inisialisasi awal jika belum ada
      await setDoc(ref, DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
  } catch (err) {
    console.warn('Gagal memuat pengaturan sistem, menggunakan default:', err);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSystemSettings(settingsData) {
  const ref = doc(db, 'settings', 'general');
  await setDoc(ref, {
    ...settingsData,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

/**
 * Backup Seluruh Data Koleksi ke File JSON
 */
export async function backupCollectionToJson(collectionName) {
  const colRef = collection(db, collectionName);
  const snap = await getDocs(colRef);
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const filename = `Backup_UPNVJ_${collectionName}_${new Date().toISOString().split('T')[0]}.json`;
  downloadFile(blob, filename);
  return data.length;
}

/**
 * Arsipkan Presensi Semester Lama (Menandai archived: true tanpa menghapus)
 */
export async function archiveSemesterAttendance(semesterYearLabel) {
  const q = collection(db, 'attendance');
  const snap = await getDocs(q);
  const unarchived = snap.docs.filter(d => !d.data().archived);

  const chunks = chunkArray(unarchived, 400);
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach(docSnap => {
      batch.update(docSnap.ref, {
        archived: true,
        archivedAt: new Date().toISOString(),
        semesterArsip: semesterYearLabel
      });
    });
    await batch.commit();
  }

  return unarchived.length;
}

/**
 * Reset Data Absensi (Hanya Superadmin & Memerlukan Konfirmasi Berlapis)
 */
export async function resetAttendanceData() {
  const q = collection(db, 'attendance');
  const snap = await getDocs(q);

  const chunks = chunkArray(snap.docs, 400);
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach(docSnap => batch.delete(docSnap.ref));
    await batch.commit();
  }

  return snap.docs.length;
}
