/**
 * Admin Management Service: Kelola Akun Administrator & Dosen via Secondary App
 * Universitas Pembangunan Nasional "Veteran" Jakarta
 */
import { 
  db, 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  orderBy,
  secondaryAuth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  auth
} from '../firebase.js';

export async function fetchAdminAccounts() {
  const q = query(collection(db, 'admins'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Buat Akun Admin/Dosen Baru Menggunakan Secondary Firebase App
 * Ini memastikan sesi superadmin saat ini TIDAK ter-logout!
 */
export async function createAdminAccount({
  nama,
  email,
  role,
  fakultas = null,
  prodi = null
}, superadminUser) {
  const trimmedEmail = email.trim().toLowerCase();
  // Kata sandi sementara acak
  const tempPassword = 'Upnvj#' + Math.floor(100000 + Math.random() * 900000) + '!';

  // 1. Buat user di Firebase Authentication via secondaryAuth
  const userCred = await createUserWithEmailAndPassword(secondaryAuth, trimmedEmail, tempPassword);
  const newUid = userCred.user.uid;

  // 2. Simpan dokumen hak akses di koleksi admins/{uid}
  const payload = {
    uid: newUid,
    nama: nama.trim(),
    email: trimmedEmail,
    role: role,
    fakultas: fakultas || null,
    prodi: prodi || null,
    aktif: true,
    fotoURL: '',
    createdAt: new Date().toISOString(),
    createdBy: `${superadminUser.nama} (${superadminUser.email})`
  };

  await setDoc(doc(db, 'admins', newUid), payload);

  // 3. Kirim email reset password agar admin baru dapat menentukan sandi pribadinya
  try {
    await sendPasswordResetEmail(auth, trimmedEmail);
  } catch (resetErr) {
    console.warn('Gagal mengirimkan email reset password otomatis:', resetErr);
  }

  return { id: newUid, ...payload };
}

export async function updateAdminStatus(targetUid, isActive, currentSuperadminUid) {
  if (targetUid === currentSuperadminUid && !isActive) {
    throw new Error('Anda tidak dapat menonaktifkan akun Anda sendiri.');
  }

  await updateDoc(doc(db, 'admins', targetUid), {
    aktif: isActive,
    updatedAt: new Date().toISOString()
  });
}

export async function updateAdminRoleAndScope(targetUid, { role, fakultas, prodi }, currentSuperadminUid) {
  if (targetUid === currentSuperadminUid && role !== 'superadmin') {
    throw new Error('Anda tidak dapat menurunkan hak akses Superadmin pada akun Anda sendiri.');
  }

  await updateDoc(doc(db, 'admins', targetUid), {
    role,
    fakultas: fakultas || null,
    prodi: prodi || null,
    updatedAt: new Date().toISOString()
  });
}

export async function resendAdminPasswordReset(email) {
  await sendPasswordResetEmail(auth, email.trim());
}
