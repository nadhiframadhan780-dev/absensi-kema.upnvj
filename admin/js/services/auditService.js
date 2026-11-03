/**
 * Audit Log Service: Pencatatan Jejak Aktivitas Admin (Append-Only)
 * Universitas Pembangunan Nasional "Veteran" Jakarta
 */
import { 
  db, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  where, 
  startAfter, 
  serverTimestamp 
} from '../firebase.js';

export async function logAdminAction({
  adminUser,
  aksi,
  targetKoleksi,
  targetId = '',
  sebelum = null,
  sesudah = null
}) {
  if (!adminUser || !adminUser.uid) return;

  try {
    const logData = {
      uid: adminUser.uid,
      nama: adminUser.nama || adminUser.displayName || 'Admin',
      role: adminUser.role || 'admin',
      aksi: aksi,
      targetKoleksi: targetKoleksi || 'general',
      targetId: String(targetId || ''),
      sebelum: sebelum ? JSON.stringify(sebelum) : null,
      sesudah: sesudah ? JSON.stringify(sesudah) : null,
      userAgent: (navigator.userAgent || '').slice(0, 180),
      createdAt: serverTimestamp()
    };

    await addDoc(collection(db, 'auditLogs'), logData);
  } catch (error) {
    console.warn('Gagal mencatat audit log:', error);
  }
}

export async function fetchAuditLogs({
  actionFilter = 'all',
  lastVisible = null,
  pageSize = 20
} = {}) {
  try {
    let q = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'));

    if (actionFilter && actionFilter !== 'all') {
      q = query(collection(db, 'auditLogs'), where('aksi', '==', actionFilter), orderBy('createdAt', 'desc'));
    }

    if (lastVisible) {
      q = query(q, startAfter(lastVisible), limit(pageSize));
    } else {
      q = query(q, limit(pageSize));
    }

    const snap = await getDocs(q);
    const logs = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return {
      logs,
      lastVisible: snap.docs[snap.docs.length - 1] || null
    };
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    throw error;
  }
}
