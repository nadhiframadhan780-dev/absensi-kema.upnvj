/**
 * Announcement Service: Pengumuman Terarah untuk Mahasiswa
 * Universitas Pembangunan Nasional "Veteran" Jakarta
 */
import { 
  db, 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from '../firebase.js';

export async function fetchAnnouncements() {
  const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addAnnouncement(announcementData, adminUser) {
  const payload = {
    ...announcementData,
    aktif: announcementData.aktif !== false,
    createdBy: `${adminUser.nama} (${adminUser.role})`,
    createdAt: new Date().toISOString()
  };

  const docRef = await addDoc(collection(db, 'announcements'), payload);
  return { id: docRef.id, ...payload };
}

export async function updateAnnouncement(id, updateData) {
  const ref = doc(db, 'announcements', id);
  await updateDoc(ref, {
    ...updateData,
    updatedAt: new Date().toISOString()
  });
}

export async function deleteAnnouncement(id) {
  await deleteDoc(doc(db, 'announcements', id));
}
