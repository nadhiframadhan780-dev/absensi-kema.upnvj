/**
 * Firebase Web SDK v10 Modular Initialization untuk Admin Panel
 * Universitas Pembangunan Nasional "Veteran" Jakarta (UPNVJ)
 */
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
  getAuth, 
  browserLocalPersistence, 
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { 
  getFirestore, 
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
  serverTimestamp, 
  writeBatch,
  getCountFromServer,
  enableIndexedDbPersistence
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

export const firebaseConfig = {
  apiKey: "AIzaSyDAcKcg3alPOTH3FFGelYmsW7jcMMe2PLI",
  authDomain: "upnvjdatsystem.firebaseapp.com",
  databaseURL: "https://upnvjdatsystem-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "upnvjdatsystem",
  storageBucket: "upnvjdatsystem.firebasestorage.app",
  messagingSenderId: "57095309946",
  appId: "1:57095309946:web:b0e9f3f86380d549ffc9c3"
};

// 1. Instance Firebase Utama untuk Sesi Admin yang Sedang Aktif
const primaryApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(primaryApp);
export const db = getFirestore(primaryApp);

// Atur sesi persisten lokal
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn("Gagal menetapkan auth persistence pada admin panel:", err.message);
});

// Cache offline Firestore
try {
  enableIndexedDbPersistence(db).catch(() => {});
} catch (e) {}

// 2. Instance Firebase Sekunder: Digunakan KHUSUS untuk mendaftarkan akun Admin/Dosen baru
// tanpa membuat sesi admin superadmin yang sedang login ter-logout!
const secondaryApp = getApps().some(app => app.name === "secondary") 
  ? getApps().find(app => app.name === "secondary") 
  : initializeApp(firebaseConfig, "secondary");
export const secondaryAuth = getAuth(secondaryApp);

// Export seluruh fungsi Firestore & Auth modular agar praktis digunakan di seluruh services
export {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
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
  serverTimestamp, 
  writeBatch,
  getCountFromServer
};
