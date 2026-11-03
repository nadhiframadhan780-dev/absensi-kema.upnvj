/**
 * Session Service: Manajemen Pertemuan, QR Dinamis 30 Detik, & Otomasi Alpa
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
  onSnapshot,
  writeBatch,
  serverTimestamp 
} from '../firebase.js';
import { generateSessionCode, generateQrToken, chunkArray } from '../utils.js';
import { getCourseStudentsRoster } from './courseService.js';

export function listenSessionsRealtime({ fakultas = 'all', prodi = 'all', dosenUid = null } = {}, onUpdate) {
  let constraints = [];
  if (fakultas && fakultas !== 'all') constraints.push(where('fakultas', '==', fakultas));
  if (prodi && prodi !== 'all') constraints.push(where('prodi', '==', prodi));
  if (dosenUid) constraints.push(where('dosenUid', '==', dosenUid));

  constraints.push(orderBy('tanggal', 'desc'));

  const q = query(collection(db, 'sessions'), ...constraints);
  return onSnapshot(q, (snapshot) => {
    const sessions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    onUpdate(sessions);
  }, (err) => {
    console.error('Error listening to sessions:', err);
  });
}

export async function createSession(sessionData) {
  const kodeSesi = generateSessionCode();
  const qrToken = generateQrToken();
  const now = new Date();
  const qrExp = new Date(now.getTime() + 35000).toISOString(); // 35 detik masa berlaku token

  const payload = {
    ...sessionData,
    status: sessionData.status || 'Terjadwal',
    kodeSesi: kodeSesi,
    qrToken: qrToken,
    qrTokenExp: qrExp,
    batasTerlambatMenit: Number(sessionData.batasTerlambatMenit || 15),
    createdAt: new Date().toISOString()
  };

  const docRef = await addDoc(collection(db, 'sessions'), payload);
  return { id: docRef.id, ...payload };
}

/**
 * Buat Sesi Berulang Otomatis untuk 14 - 16 Pertemuan Mingguan
 */
export async function createRecurringSessions(baseCourse, { startDate, count = 16, startMeeting = 1 }) {
  const sessions = [];
  let currentDate = new Date(startDate);

  for (let i = 0; i < count; i++) {
    const meetingNum = startMeeting + i;
    const dateStr = currentDate.toISOString().split('T')[0];

    const sessionPayload = {
      courseId: baseCourse.id,
      kodeMk: baseCourse.kode,
      namaMk: baseCourse.nama,
      fakultas: baseCourse.fakultas,
      prodi: baseCourse.prodi,
      semester: baseCourse.semester,
      kelas: baseCourse.kelas || 'A',
      dosenUid: baseCourse.dosenUid,
      dosenNama: baseCourse.dosenNama || 'Dosen Pengampu',
      pertemuan: meetingNum,
      tanggal: dateStr,
      jamBuka: baseCourse.jamMulai || '08:00',
      jamTutup: baseCourse.jamSelesai || '09:40',
      batasTerlambatMenit: 15,
      metode: 'keduanya',
      status: 'Terjadwal',
      kodeSesi: generateSessionCode(),
      qrToken: generateQrToken(),
      qrTokenExp: new Date(Date.now() + 35000).toISOString(),
      catatan: `Pertemuan ke-${meetingNum} perkuliahan reguler.`,
      createdAt: new Date().toISOString()
    };

    sessions.push(sessionPayload);
    // Tambah 7 hari untuk pertemuan minggu berikutnya
    currentDate.setDate(currentDate.getDate() + 7);
  }

  // Simpan via writeBatch
  const chunks = chunkArray(sessions, 400);
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach(sess => {
      const ref = doc(collection(db, 'sessions'));
      batch.set(ref, sess);
    });
    await batch.commit();
  }

  return sessions.length;
}

export async function openSession(sessionId) {
  const ref = doc(db, 'sessions', sessionId);
  const qrToken = generateQrToken();
  const qrTokenExp = new Date(Date.now() + 35000).toISOString();

  await updateDoc(ref, {
    status: 'Dibuka',
    qrToken: qrToken,
    qrTokenExp: qrTokenExp,
    openedAt: new Date().toISOString()
  });
}

/**
 * Regenerasi Token QR Sesi Setiap 30 Detik untuk Mencegah Titip Absen
 */
export async function rotateSessionQrToken(sessionId) {
  const ref = doc(db, 'sessions', sessionId);
  const qrToken = generateQrToken();
  const qrTokenExp = new Date(Date.now() + 35000).toISOString();

  await updateDoc(ref, {
    qrToken: qrToken,
    qrTokenExp: qrTokenExp
  });

  return { qrToken, qrTokenExp };
}

/**
 * Tutup Sesi & Opsi Otomatis Tandai Mahasiswa yang Belum Hadir Sebagai "Alpa"
 */
export async function closeSessionAndMarkAlpa(session, { markAlpa = true } = {}) {
  const sessionRef = doc(db, 'sessions', session.id);
  await updateDoc(sessionRef, {
    status: 'Ditutup',
    closedAt: new Date().toISOString()
  });

  if (!markAlpa) return { alpaCount: 0 };

  // 1. Ambil seluruh roster mahasiswa mata kuliah ini
  const roster = await getCourseStudentsRoster(session);

  // 2. Ambil absensi yang sudah tercatat pada sesi ini
  const attQuery = query(
    collection(db, 'attendance'),
    where('sesiId', '==', session.id)
  );
  const attSnap = await getDocs(attQuery);
  const presentNims = new Set(attSnap.docs.map(d => d.data().nim));

  // 3. Ambil pengajuan izin/sakit yang sudah disetujui untuk sesi ini
  const leaveQuery = query(
    collection(db, 'leaveRequests'),
    where('sesiId', '==', session.id),
    where('status', '==', 'Disetujui')
  );
  const leaveSnap = await getDocs(leaveQuery);
  const leaveNims = new Set(leaveSnap.docs.map(d => d.data().nim));

  // 4. Mahasiswa yang belum absen dan tidak punya izin/sakit = ALPA
  const absentStudents = roster.filter(s => !presentNims.has(s.nim) && !leaveNims.has(s.nim));

  if (absentStudents.length > 0) {
    const chunks = chunkArray(absentStudents, 400);
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(student => {
        const newAttRef = doc(collection(db, 'attendance'));
        batch.set(newAttRef, {
          uid: student.uid || student.id,
          nim: student.nim,
          nama: student.nama,
          fakultas: session.fakultas,
          prodi: session.prodi,
          mataKuliah: session.namaMk,
          kodeMk: session.kodeMk,
          sesiId: session.id,
          pertemuan: session.pertemuan,
          tanggal: session.tanggal,
          waktu: session.jamTutup || 'Ditutup',
          status: 'Alpa',
          metode: 'sistem',
          keterangan: 'Otomatis dicatat Alpa saat sesi perkuliahan ditutup',
          createdAt: new Date().toISOString()
        });
      });
      await batch.commit();
    }
  }

  return { alpaCount: absentStudents.length };
}

export async function deleteSession(sessionId) {
  await deleteDoc(doc(db, 'sessions', sessionId));
}
