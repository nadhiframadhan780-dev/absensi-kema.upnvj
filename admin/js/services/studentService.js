/**
 * Student Service: Manajemen Mahasiswa, Validasi NIM, Batch Import/Export
 * Universitas Pembangunan Nasional "Veteran" Jakarta
 */
import { 
  db, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  writeBatch,
  getCountFromServer,
  serverTimestamp
} from '../firebase.js';
import { chunkArray } from '../utils.js';
import { getAllProdiList, getFacultyList } from '../data.js';

export async function fetchStudents({
  fakultas = 'all',
  prodi = 'all',
  angkatan = 'all',
  status = 'all',
  searchQuery = '',
  pageSize = 15,
  lastVisibleDoc = null
} = {}) {
  try {
    let q = collection(db, 'students');

    const constraints = [];
    if (fakultas && fakultas !== 'all') {
      constraints.push(where('fakultas', '==', fakultas));
    }
    if (prodi && prodi !== 'all') {
      constraints.push(where('prodi', '==', prodi));
    }
    if (angkatan && angkatan !== 'all') {
      constraints.push(where('angkatan', '==', angkatan));
    }
    if (status === 'active') {
      constraints.push(where('aktif', '==', true));
    } else if (status === 'inactive') {
      constraints.push(where('aktif', '==', false));
    }

    // Urutkan berdasarkan waktu buat
    constraints.push(orderBy('createdAt', 'desc'));

    if (lastVisibleDoc) {
      constraints.push(startAfter(lastVisibleDoc));
    }
    constraints.push(limit(pageSize));

    const finalQuery = query(q, ...constraints);
    const snap = await getDocs(finalQuery);

    let students = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Filter pencarian teks di memori jika ada input search query
    if (searchQuery) {
      const lower = searchQuery.toLowerCase().trim();
      students = students.filter(s => 
        (s.nama && s.nama.toLowerCase().includes(lower)) ||
        (s.nim && s.nim.includes(lower)) ||
        (s.email && s.email.toLowerCase().includes(lower))
      );
    }

    return {
      students,
      lastVisible: snap.docs[snap.docs.length - 1] || null,
      hasMore: snap.docs.length === pageSize
    };
  } catch (error) {
    console.error('Error fetching students:', error);
    throw error;
  }
}

export async function getStudentTotalCount() {
  try {
    const coll = collection(db, 'students');
    const snapshot = await getCountFromServer(coll);
    return snapshot.data().count;
  } catch (e) {
    return 0;
  }
}

/**
 * Tambah Mahasiswa Manual dengan Pengecekan NIM Unik di nim_index
 */
export async function addStudentManual(studentData) {
  const nim = String(studentData.nim || '').trim();
  if (!nim || nim.length !== 10) {
    throw new Error('NIM harus tepat 10 digit angka.');
  }

  // 1. Cek apakah NIM sudah terdaftar di nim_index
  const nimRef = doc(db, 'nim_index', nim);
  const nimSnap = await getDoc(nimRef);
  if (nimSnap.exists()) {
    throw new Error(`Mahasiswa dengan NIM ${nim} sudah terdaftar dalam sistem.`);
  }

  // 2. Gunakan auto ID atau pseudo-UID untuk pre-registered student
  const newStudentRef = doc(collection(db, 'students'));
  const uid = newStudentRef.id;

  const payload = {
    uid: uid,
    nama: studentData.nama.trim(),
    nim: nim,
    email: studentData.email ? studentData.email.trim() : `${nim}@mahasiswa.upnvj.ac.id`,
    fakultas: studentData.fakultas,
    prodi: studentData.prodi,
    angkatan: studentData.angkatan || new Date().getFullYear().toString(),
    semester: studentData.semester || '1',
    kelas: studentData.kelas || 'A',
    tanggalLahir: studentData.tanggalLahir || '',
    tempatLahir: studentData.tempatLahir || '',
    jenisKelamin: studentData.jenisKelamin || 'L',
    noHp: studentData.noHp || '',
    alamat: studentData.alamat || '',
    aktif: true,
    preRegistered: true,
    profileComplete: false,
    fotoURL: studentData.fotoURL || '',
    createdAt: new Date().toISOString()
  };

  const batch = writeBatch(db);
  batch.set(newStudentRef, payload);
  batch.set(nimRef, { uid: uid, verified: true, nim: nim });

  await batch.commit();
  return { id: uid, ...payload };
}

export async function updateStudent(uid, updateFields) {
  const ref = doc(db, 'students', uid);
  await updateDoc(ref, {
    ...updateFields,
    updatedAt: new Date().toISOString()
  });
}

export async function deleteStudent(uid, nim) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'students', uid));
  if (nim) {
    batch.delete(doc(db, 'nim_index', nim));
  }
  await batch.commit();
}

/**
 * Operasi Massal: Update Status Aktif / Hapus Massal
 */
export async function batchUpdateStudentStatus(uids, isActive) {
  const chunks = chunkArray(uids, 400);
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach(uid => {
      batch.update(doc(db, 'students', uid), { aktif: isActive });
    });
    await batch.commit();
  }
}

export async function batchDeleteStudents(studentsList) {
  const chunks = chunkArray(studentsList, 200); // 2 ops per student (student + nim_index)
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach(s => {
      batch.delete(doc(db, 'students', s.uid));
      if (s.nim) {
        batch.delete(doc(db, 'nim_index', s.nim));
      }
    });
    await batch.commit();
  }
}

/**
 * Import Massal Mahasiswa dari Excel/CSV
 * - Memecah maksimal 500 operasi per writeBatch
 * - Melakukan validasi baris (format NIM, prodi resmi)
 * - Mengembalikan daftar baris yang gagal
 */
export async function importStudentsBatch(rawRows, onProgress) {
  const validProdiList = getAllProdiList().map(p => p.nama.toLowerCase());
  const validFaculties = getFacultyList().map(f => f.kode.toLowerCase());

  const validEntries = [];
  const failedEntries = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowNum = i + 2; // Asumsi row 1 adalah header Excel

    const nim = String(row.NIM || row.nim || '').trim();
    const nama = String(row.Nama || row.nama || '').trim();
    const fakultas = String(row.Fakultas || row.fakultas || '').trim();
    const prodi = String(row.Prodi || row.prodi || '').trim();
    const angkatan = String(row.Angkatan || row.angkatan || '').trim();
    const semester = String(row.Semester || row.semester || '1').trim();
    const kelas = String(row.Kelas || row.kelas || 'A').trim();

    // Validasi
    if (!nim || !/^\d{10}$/.test(nim)) {
      failedEntries.push({ rowNum, nim, nama, alasan: 'Format NIM tidak valid (wajib 10 digit angka)' });
      continue;
    }
    if (!nama) {
      failedEntries.push({ rowNum, nim, nama, alasan: 'Nama mahasiswa tidak boleh kosong' });
      continue;
    }
    if (!fakultas || !validFaculties.includes(fakultas.toLowerCase())) {
      failedEntries.push({ rowNum, nim, nama, alasan: `Fakultas "${fakultas}" tidak terdaftar di UPNVJ` });
      continue;
    }
    if (!prodi || !validProdiList.includes(prodi.toLowerCase())) {
      failedEntries.push({ rowNum, nim, nama, alasan: `Program studi "${prodi}" tidak sesuai daftar resmi` });
      continue;
    }

    validEntries.push({
      nim,
      nama,
      email: `${nim}@mahasiswa.upnvj.ac.id`,
      fakultas: fakultas.toUpperCase(),
      prodi,
      angkatan: angkatan || new Date().getFullYear().toString(),
      semester,
      kelas,
      aktif: true,
      preRegistered: true,
      profileComplete: false,
      createdAt: new Date().toISOString()
    });
  }

  // Simpan ke Firestore via writeBatch (maks 250 data per batch karena ada 2 doc per mahasiswa: students & nim_index)
  const batchChunks = chunkArray(validEntries, 200);
  let processedCount = 0;

  for (let bIndex = 0; bIndex < batchChunks.length; bIndex++) {
    const currentChunk = batchChunks[bIndex];
    const batch = writeBatch(db);

    for (const student of currentChunk) {
      const studentRef = doc(collection(db, 'students'));
      const uid = studentRef.id;
      student.uid = uid;

      batch.set(studentRef, student);
      batch.set(doc(db, 'nim_index', student.nim), { uid: uid, verified: true, nim: student.nim });
    }

    await batch.commit();
    processedCount += currentChunk.length;

    if (typeof onProgress === 'function') {
      const percent = (processedCount / (validEntries.length || 1)) * 100;
      onProgress(percent, `Menyimpan ${processedCount} dari ${validEntries.length} data mahasiswa...`);
    }
  }

  return {
    totalInput: rawRows.length,
    successCount: validEntries.length,
    failedCount: failedEntries.length,
    failedRows: failedEntries
  };
}
