/**
 * Page Controller: Profil Administrator & Ubah Kata Sandi
 * Universitas Pembangunan Nasional "Veteran" Jakarta
 */
import { 
  auth, 
  db, 
  doc, 
  updateDoc, 
  reauthenticateWithCredential, 
  updatePassword, 
  EmailAuthProvider 
} from '../firebase.js';
import { authState } from '../auth.js';
import { escapeHtml } from '../utils.js';
import { showToast, setButtonLoading } from '../ui.js';

export async function renderProfilPage() {
  const container = document.getElementById('view-profil');
  if (!container || !authState.user) return;

  loadAdminProfileData();
  setupProfilEventListeners();
}

function loadAdminProfileData() {
  const docData = authState.adminDoc || {};
  document.getElementById('prof-admin-name').value = docData.nama || '';
  document.getElementById('prof-admin-email').value = authState.user.email || '';
  document.getElementById('prof-admin-role').value = docData.role || 'Admin';
  document.getElementById('prof-admin-scope').value = docData.fakultas 
    ? `Fakultas ${docData.fakultas}${docData.prodi ? ` - ${docData.prodi}` : ''}` 
    : 'Akses Seluruh Fakultas (Nasional)';

  const avatar = document.getElementById('admin-profile-avatar-display');
  if (avatar) {
    if (docData.fotoURL) {
      avatar.innerHTML = `<img src="${docData.fotoURL}" style="width: 100%; height: 100%; object-fit: cover;">`;
    } else {
      avatar.textContent = (docData.nama || 'A').charAt(0).toUpperCase();
    }
  }
}

function setupProfilEventListeners() {
  // Update Nama & Foto
  const formBio = document.getElementById('form-admin-biodata');
  if (formBio) {
    formBio.onsubmit = async (e) => {
      e.preventDefault();
      const newName = document.getElementById('prof-admin-name').value.trim();
      const btn = document.getElementById('btn-save-admin-bio');
      setButtonLoading(btn, true, 'Menyimpan...');

      try {
        await updateDoc(doc(db, 'admins', authState.user.uid), {
          nama: newName,
          updatedAt: new Date().toISOString()
        });
        if (authState.adminDoc) authState.adminDoc.nama = newName;
        document.getElementById('topbar-admin-name').textContent = newName;
        showToast('success', 'Profil Diperbarui', 'Nama administrator berhasil disimpan.');
      } catch (err) {
        showToast('error', 'Gagal', err.message);
      } finally {
        setButtonLoading(btn, false);
      }
    };
  }

  // Upload Foto Profil (Base64 Terkompresi)
  const photoInput = document.getElementById('admin-photo-input');
  if (photoInput) {
    photoInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          canvas.width = 200;
          canvas.height = 200;
          const ctx = canvas.getContext('2d');
          const minDim = Math.min(img.width, img.height);
          ctx.drawImage(img, (img.width - minDim) / 2, (img.height - minDim) / 2, minDim, minDim, 0, 0, 200, 200);

          const compressedB64 = canvas.toDataURL('image/jpeg', 0.85);

          try {
            await updateDoc(doc(db, 'admins', authState.user.uid), {
              fotoURL: compressedB64
            });
            if (authState.adminDoc) authState.adminDoc.fotoURL = compressedB64;
            loadAdminProfileData();
            showToast('success', 'Foto Disimpan', 'Foto profil admin telah diperbarui.');
          } catch (err) {
            showToast('error', 'Gagal Menyimpan Foto', err.message);
          }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    };
  }

  // Ubah Password dengan Re-autentikasi
  const formPass = document.getElementById('form-admin-change-password');
  if (formPass) {
    formPass.onsubmit = async (e) => {
      e.preventDefault();
      const currentPass = document.getElementById('prof-current-password').value;
      const newPass = document.getElementById('prof-new-password').value;
      const confirmPass = document.getElementById('prof-confirm-password').value;

      if (newPass.length < 6) {
        showToast('warning', 'Kata Sandi Lemah', 'Kata sandi baru minimal 6 karakter.');
        return;
      }
      if (newPass !== confirmPass) {
        showToast('warning', 'Tidak Cocok', 'Konfirmasi kata sandi baru tidak sesuai.');
        return;
      }

      const btn = document.getElementById('btn-submit-change-password');
      setButtonLoading(btn, true, 'Mengubah Sandi...');

      try {
        const credential = EmailAuthProvider.credential(authState.user.email, currentPass);
        await reauthenticateWithCredential(authState.user, credential);
        await updatePassword(authState.user, newPass);

        showToast('success', 'Kata Sandi Diperbarui', 'Kata sandi login administrator Anda telah berhasil diubah.');
        formPass.reset();
      } catch (err) {
        let msg = err.message;
        if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          msg = 'Kata sandi saat ini yang Anda masukkan salah.';
        }
        showToast('error', 'Gagal Mengubah Sandi', msg);
      } finally {
        setButtonLoading(btn, false);
      }
    };
  }
}
