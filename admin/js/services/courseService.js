/**
 * Course Service: Manajemen Mata Kuliah & Roster Peserta Kuliah
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
  orderBy 
} from '../firebase.js';

export async function fetchCourses({ fakultas = 'all', prodi = 'all', dosenUid = null } = {}) {
  try {
    let constraints = [];

    if (fakultas && fakultas !== 'all') {
      constraints.push(where('fakultas', '==', fakultas));
    }
    if (prodi && prodi !== 'all') {
      constraints.push(where('prodi', '==', prodi));
    }
    if (dosenUid) {
      constraints.push(where('dosenUid', '==', dosenUid));
    }

    constraints.push(orderBy('kode', 'asc'));

    const q = query(collection(db, 'courses'), ...constraints);
    const snap = await getDocs(q);

    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching courses:', error);
    throw error;
  }
}

export async function addCourse(courseData) {
  const docRef = await addDoc(collection(db, 'courses'), {
    ...courseData,
    aktif: courseData.aktif !== false,
    createdAt: new Date().toISOString()
  });
  return { id: docRef.id, ...courseData };
}

export async function updateCourse(id, updateData) {
  const ref = doc(db, 'courses', id);
  await updateDoc(ref, {
    ...updateData,
    updatedAt: new Date().toISOString()
  });
}

export async function deleteCourse(id) {
  await deleteDoc(doc(db, 'courses', id));
}

/**
 * Mengambil Daftar Peserta Kuliah yang Sesuai dengan Mata Kuliah Ini
 * (Fakultas + Prodi + Semester + Kelas)
 */
export async function getCourseStudentsRoster(course) {
  try {
    let q = query(
      collection(db, 'students'),
      where('prodi', '==', course.prodi),
      where('semester', '==', String(course.semester))
    );

    const snap = await getDocs(q);
    let students = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (course.kelas) {
      students = students.filter(s => !s.kelas || s.kelas === course.kelas);
    }

    return students;
  } catch (err) {
    console.warn('Gagal memuat roster mahasiswa mata kuliah:', err);
    return [];
  }
}
