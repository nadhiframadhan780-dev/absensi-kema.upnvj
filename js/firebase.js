/**
 * Firebase Web SDK v10 Modular Initialization
 * Menggunakan Firebase Auth, Cloud Firestore, dan Firebase Storage
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  addDoc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

// Konfigurasi resmi proyek Firebase UPNVJ
export const firebaseConfig = {
  apiKey: "AIzaSyDAcKcg3alPOTH3FFGelYmsW7jcMMe2PLI",
  authDomain: "upnvjdatsystem.firebaseapp.com",
  databaseURL: "https://upnvjdatsystem-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "upnvjdatsystem",
  storageBucket: "upnvjdatsystem.firebasestorage.app",
  messagingSenderId: "57095309946",
  appId: "1:57095309946:web:b0e9f3f86380d549ffc9c3"
};

// Inisialisasi Firebase App
export const app = initializeApp(firebaseConfig);

// Inisialisasi Layanan
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Atur persistensi lokal
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.warn("Konfigurasi persistensi auth lokal:", err);
});

// Provider Google Auth
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  hd: "mahasiswa.upnvj.ac.id",
  prompt: "select_account"
});

// Re-export fungsi Firebase modular untuk kemudahan pakai di modul lain
export {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  serverTimestamp,
  ref,
  uploadBytes,
  getDownloadURL
};
