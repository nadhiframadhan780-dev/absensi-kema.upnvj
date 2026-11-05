/**
 * Page Controller: Pengajuan Izin & Sakit Mahasiswa
 * Universitas Pembangunan Nasional "Veteran" Jakarta
 */
import { 
  fetchLeaveRequests, 
  approveLeaveRequest, 
  rejectLeaveRequest 
} from '../services/leaveService.js';
import { escapeHtml, formatDateWIB } from '../utils.js';
import { 
  showToast, 
  showConfirmDialog, 
  openDrawer, 
  closeDrawer, 
  setButtonLoading 
} from '../ui.js';
import { authState } from '../auth.js';
import { 
  openDocumentPreviewSafely, 
  downloadPdfFromDataUrl, 
  printPdfDataUrl 
} from '../officialLetterPdf.js';

let leaveList = [];

export async function renderIzinPage() {
  const container = document.getElementById('view-izin');
  if (!container) return;

  setupIzinFilters();
  await loadLeaveTable();
}

function setupIzinFilters() {
  const statusFilter = document.getElementById('filter-izin-status');
  if (statusFilter) {
    statusFilter.onchange = () => loadLeaveTable();
  }
}

async function loadLeaveTable() {
  const tbody = document.getElementById('table-izin-body');
  if (!tbody) return;

  const statusVal = document.getElementById('filter-izin-status')?.value || 'all';

  tbody.innerHTML = `
    <tr>
      <td colspan="7" style="padding: 40px; text-align: center; color: var(--slate-400);">
        <div class="spinner-border" style="width: 24px; height: 24px; margin: 0 auto 10px;"></div>
        <span>Memuat pengajuan izin & sakit...</span>
      </td>
    </tr>
  `;

  try {
    leaveList = await fetchLeaveRequests({
      status: statusVal,
      fakultas: authState.fakultas || 'all',
      prodi: authState.prodi || 'all'
    });

    if (leaveList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="padding: 48px; text-align: center; color: var(--slate-400);">
            <i data-lucide="check-check" style="width: 36px; height: 36px; margin: 0 auto 10px; stroke-width: 1.5; color: #10b981;"></i>
            <p style="font-weight: 600; font-size: 14px; margin: 0; color: var(--slate-600);">Tidak Ada Pengajuan Menunggu</p>
            <p style="font-size: 12px; margin: 4px 0 0 0;">Semua permohonan izin dan sakit telah diproses.</p>
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    tbody.innerHTML = leaveList.map(item => `
      <tr class="table-row-hover">
        <td>
          <div style="font-weight: 700; color: var(--slate-900); font-size: 13px;">${formatDateWIB(item.createdAt)}</div>
          <div style="font-size: 11px; color: var(--slate-400);">${escapeHtml(item.tanggalMulai || '-')}</div>
        </td>
        <td class="font-mono text-bold">${escapeHtml(item.nim || '-')}</td>
        <td style="font-weight: 600; color: var(--slate-900);">${escapeHtml(item.nama || '-')}</td>
        <td>
          <span class="badge-status ${item.jenis === 'Sakit' ? 'badge-sakit' : (item.jenis === 'Dispensasi' ? 'badge-dispensasi' : 'badge-izin')}">
            ${escapeHtml(item.jenis || 'Izin')}
          </span>
        </td>
        <td style="font-weight: 600; color: var(--navy-900);">${escapeHtml(item.mataKuliah || 'Semua Kuliah')}</td>
        <td>
          <span class="badge-status status-${(item.status || 'menunggu').toLowerCase()}">
            ${escapeHtml(item.status || 'Menunggu')}
          </span>
        </td>
        <td style="text-align: right;">
          <div class="action-btn-group">
            <button type="button" class="btn-portal btn-secondary btn-sm btn-view-leave" data-id="${item.id}">
              <i data-lucide="file-text" style="width: 14px; height: 14px;"></i>
              <span>Detail & Bukti</span>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-view-leave').forEach(btn => {
      btn.onclick = () => openLeaveDetailDrawer(btn.dataset.id);
    });

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('Error loading leave table:', err);
    showToast('error', 'Gagal Memuat Pengajuan', err.message);
  }
}

/**
 * Render Bukti Lampiran: Foto / PDF / Dokumen Word (Aman tanpa about:blank)
 */
function renderAttachmentPreview(item) {
  if (!item.lampiran) {
    return `
      <div style="padding: 24px; text-align: center; color: var(--slate-400); background: var(--slate-50); border-radius: 10px; border: 1px dashed var(--slate-300);">
        <i data-lucide="file-x" style="width: 28px; height: 28px; margin: 0 auto 6px; display: block; opacity: 0.5;"></i>
        <span>Tidak ada lampiran dokumen foto atau berkas.</span>
      </div>
    `;
  }

  const fileName = item.lampiranNama || 'Dokumen_Bukti';
  const mime = (item.lampiranTipe || '').toLowerCase();
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const isPdf = ext === 'pdf' || mime === 'application/pdf' || item.lampiran.startsWith('data:application/pdf');
  const isWord = ['doc', 'docx'].includes(ext) || mime.includes('word') || mime.includes('officedocument');
  const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) || mime.startsWith('image/') || item.lampiran.startsWith('data:image/');

  if (isImage) {
    return `
      <div style="border-radius: 12px; overflow: hidden; border: 1px solid var(--slate-200); background: #0b1523; text-align: center;">
        <img src="${item.lampiran}" alt="Bukti Surat ${escapeHtml(item.jenis)}" style="max-width: 100%; max-height: 380px; object-fit: contain; margin: 0 auto; display: block;">
      </div>
      <div style="margin-top: 10px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <span style="font-size: 12px; color: var(--slate-500); font-weight: 500;">
          <i data-lucide="image" style="width: 13px; height: 13px; vertical-align: middle;"></i> ${escapeHtml(fileName)}
        </span>
        <button type="button" class="btn-portal btn-secondary btn-sm" id="btn-preview-attachment-img">
          <i data-lucide="external-link" style="width: 13px; height: 13px;"></i>
          <span>Buka Ukuran Penuh</span>
        </button>
      </div>
    `;
  }

  if (isPdf) {
    return `
      <div style="padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 48px; height: 48px; border-radius: 10px; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i data-lucide="file-text" style="width: 26px; height: 26px;"></i>
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 700; color: #0b2341; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${escapeHtml(fileName)}
            </div>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
              Dokumen Resmi Surat Bukti (Format PDF)
            </div>
          </div>
        </div>
        <div style="margin-top: 14px; display: flex; gap: 8px;">
          <button type="button" class="btn-portal btn-primary btn-sm" id="btn-preview-attachment-pdf" style="flex: 1;">
            <i data-lucide="eye" style="width: 14px; height: 14px;"></i>
            <span>Buka Pratinjau PDF</span>
          </button>
          <button type="button" class="btn-portal btn-secondary btn-sm" id="btn-download-attachment-pdf">
            <i data-lucide="download" style="width: 14px; height: 14px;"></i>
            <span>Unduh</span>
          </button>
        </div>
      </div>
    `;
  }

  if (isWord) {
    return `
      <div style="padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 48px; height: 48px; border-radius: 10px; background: #dbeafe; color: #2563eb; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i data-lucide="file-check" style="width: 26px; height: 26px;"></i>
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 700; color: #0b2341; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${escapeHtml(fileName)}
            </div>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
              Dokumen Microsoft Word (.${ext})
            </div>
          </div>
        </div>
        <div style="margin-top: 14px;">
          <button type="button" class="btn-portal btn-primary btn-sm" id="btn-download-attachment-doc" style="width: 100%;">
            <i data-lucide="download" style="width: 14px; height: 14px;"></i>
            <span>Unduh Dokumen Word</span>
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div style="padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">
      <div style="display: flex; align-items: center; gap: 14px;">
        <div style="width: 48px; height: 48px; border-radius: 10px; background: #f1f5f9; color: #475569; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <i data-lucide="file" style="width: 26px; height: 26px;"></i>
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 700; color: #0b2341; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${escapeHtml(fileName)}
          </div>
          <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
            Berkas Lampiran (${escapeHtml(ext.toUpperCase())})
          </div>
        </div>
      </div>
      <div style="margin-top: 14px;">
        <button type="button" class="btn-portal btn-primary btn-sm" id="btn-download-attachment-misc" style="width: 100%;">
          <i data-lucide="download" style="width: 14px; height: 14px;"></i>
          <span>Unduh Berkas Lampiran</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Drawer Detail Pengajuan Izin/Sakit & Pratinjau Surat Dokter
 */
function openLeaveDetailDrawer(requestId) {
  const item = leaveList.find(l => l.id === requestId);
  if (!item) return;

  const fileName = item.lampiranNama || `Dokumen_${item.nim}`;

  // Cek apakah surat keputusan resmi sudah dibuat
  const hasOfficialLetter = Boolean(item.suratKeputusanPdf);
  const capColor = item.capWarna || (item.status === 'Disetujui' ? 'HIJAU' : 'MERAH');
  const capBadgeBg = capColor === 'HIJAU' ? '#dcfce7' : '#fee2e2';
  const capBadgeText = capColor === 'HIJAU' ? '#15803d' : '#b91c1c';

  const contentHtml = `
    <div style="padding: 16px 0;">
      <div style="margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
        <div>
          <span class="badge-status ${item.jenis === 'Sakit' ? 'badge-sakit' : (item.jenis === 'Dispensasi' ? 'badge-dispensasi' : 'badge-izin')}" style="font-size: 13px; padding: 4px 14px;">
            ${escapeHtml(item.jenis)}
          </span>
          <span class="badge-status status-${(item.status || 'menunggu').toLowerCase()}" style="font-size: 13px; padding: 4px 14px; margin-left: 8px;">
            ${escapeHtml(item.status || 'Menunggu')}
          </span>
        </div>
        ${hasOfficialLetter ? `
          <span style="font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 9999px; background: ${capBadgeBg}; color: ${capBadgeText}; border: 1px solid currentColor;">
            ★ CAP STEMPEL ${capColor}
          </span>
        ` : ''}
      </div>

      <div class="detail-grid" style="margin-bottom: 20px;">
        <div class="detail-item"><span class="detail-label">Mahasiswa:</span><span class="detail-value">${escapeHtml(item.nama)} (${escapeHtml(item.nim)})</span></div>
        <div class="detail-item"><span class="detail-label">Program Studi:</span><span class="detail-value">${escapeHtml(item.prodi || '-')} (${escapeHtml(item.fakultas || '-')})</span></div>
        <div class="detail-item"><span class="detail-label">Mata Kuliah:</span><span class="detail-value">${escapeHtml(item.mataKuliah || 'Kuliah Reguler')}</span></div>
        <div class="detail-item"><span class="detail-label">Tanggal Izin:</span><span class="detail-value">${formatDateWIB(item.tanggalMulai)} ${item.tanggalSelesai ? `s/d ${formatDateWIB(item.tanggalSelesai)}` : ''}</span></div>
      </div>

      <div style="margin-bottom: 20px;">
        <h4 style="font-size: 13px; font-weight: 700; color: var(--slate-900); margin: 0 0 6px 0;">Alasan Pengajuan:</h4>
        <div style="padding: 12px 16px; background: var(--slate-100); border-radius: 10px; font-size: 13px; color: var(--slate-700); line-height: 1.5; white-space: pre-wrap;">
          ${escapeHtml(item.alasan || 'Tidak ada keterangan tambahan.')}
        </div>
      </div>

      <!-- Lampiran Surat Sakit / Bukti Foto / Dokumen -->
      <div style="margin-bottom: 20px;">
        <h4 style="font-size: 13px; font-weight: 700; color: var(--slate-900); margin: 0 0 8px 0;">Lampiran Dokumen Bukti Mahasiswa:</h4>
        ${renderAttachmentPreview(item)}
      </div>

      <!-- Surat Keputusan Resmi Dekan (A4 PDF) -->
      ${hasOfficialLetter ? `
        <div style="margin-bottom: 20px; padding: 18px; background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 14px;">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 40px; height: 40px; border-radius: 10px; background: #22c55e; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 800;">
                <i data-lucide="file-check-2" style="width: 22px; height: 22px;"></i>
              </div>
              <div>
                <div style="font-size: 13.5px; font-weight: 800; color: #14532d;">Surat Keputusan Resmi Dekan (A4 PDF)</div>
                <div style="font-size: 11.5px; color: #166534; font-family: monospace;">Nomor: ${escapeHtml(item.suratNomor || '-')}</div>
              </div>
            </div>
            <span style="font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 6px; background: #bbf7d0; color: #14532d;">
              Tanda Tangan & Cap Sah
            </span>
          </div>

          <div style="font-size: 12px; color: #166534; margin-bottom: 12px; line-height: 1.45;">
            Surat keputusan sah telah dibuat secara otomatis dan dikirimkan langsung ke akun mahasiswa bersangkutan untuk dicetak (print A4) dan diserahkan ke Dosen Pengampu.
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn-portal btn-primary btn-sm" id="btn-view-official-pdf" style="flex: 1; min-width: 120px;">
              <i data-lucide="eye" style="width: 14px; height: 14px;"></i>
              <span>Pratinjau Surat</span>
            </button>
            <button type="button" class="btn-portal btn-secondary btn-sm" id="btn-download-official-pdf">
              <i data-lucide="download" style="width: 14px; height: 14px;"></i>
              <span>Unduh PDF</span>
            </button>
            <button type="button" class="btn-portal btn-secondary btn-sm" id="btn-print-official-pdf">
              <i data-lucide="printer" style="width: 14px; height: 14px;"></i>
              <span>Cetak (A4)</span>
            </button>
          </div>
        </div>
      ` : ''}

      ${item.catatanAdmin ? `
        <div style="margin-top: 16px; padding: 12px; border-left: 4px solid var(--navy-800); background: var(--navy-50); border-radius: 0 8px 8px 0;">
          <div style="font-size: 11px; font-weight: 700; color: var(--navy-900);">Catatan Verifikasi Admin:</div>
          <div style="font-size: 12px; color: var(--slate-700); margin-top: 2px;">${escapeHtml(item.catatanAdmin)} (${escapeHtml(item.diprosesOleh || 'Admin')})</div>
        </div>
      ` : ''}

      <!-- Form Alasan Penolakan (Hidden by default, shown when Tolak clicked) -->
      <div id="drawer-reject-form-box" class="hidden" style="margin-top: 20px; padding: 16px; background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 12px;">
        <label style="display: block; font-size: 12.5px; font-weight: 800; color: #991b1b; margin-bottom: 6px;">
          Alasan Penolakan Pengajuan (Wajib Dicatat):
        </label>
        <textarea id="drawer-reject-reason-input" class="form-input" rows="3" placeholder="Contoh: Bukti surat dokter tidak jelas atau masa berlaku sudah lewat." style="font-size: 12.5px; margin-bottom: 10px;"></textarea>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button type="button" class="btn-portal btn-secondary btn-sm" id="btn-cancel-reject-form">Batal</button>
          <button type="button" class="btn-portal btn-danger btn-sm" id="btn-submit-reject-form">
            <i data-lucide="x-circle" style="width: 14px; height: 14px;"></i>
            <span>Konfirmasi Tolak</span>
          </button>
        </div>
      </div>
    </div>
  `;

  let footerHtml = '';
  if (item.status === 'Menunggu') {
    footerHtml = `
      <div id="drawer-action-buttons-group" style="display: flex; gap: 10px; width: 100%;">
        <button type="button" class="btn-portal btn-danger" id="drawer-btn-reject" style="flex: 1;">
          <i data-lucide="x-circle" style="width: 16px; height: 16px;"></i>
          <span>Tolak Pengajuan</span>
        </button>
        <button type="button" class="btn-portal btn-primary" id="drawer-btn-approve" style="flex: 1;">
          <i data-lucide="check-circle" style="width: 16px; height: 16px;"></i>
          <span>Setujui Izin</span>
        </button>
      </div>
    `;
  }

  openDrawer(`Pengajuan ${item.jenis}: ${item.nama}`, contentHtml, footerHtml);

  // Hook up lampiran preview buttons safely
  const btnImg = document.getElementById('btn-preview-attachment-img');
  if (btnImg && item.lampiran) {
    btnImg.onclick = () => openDocumentPreviewSafely(item.lampiran, fileName);
  }

  const btnPdfView = document.getElementById('btn-preview-attachment-pdf');
  if (btnPdfView && item.lampiran) {
    btnPdfView.onclick = () => openDocumentPreviewSafely(item.lampiran, fileName);
  }

  const btnPdfDown = document.getElementById('btn-download-attachment-pdf');
  if (btnPdfDown && item.lampiran) {
    btnPdfDown.onclick = () => downloadPdfFromDataUrl(item.lampiran, fileName);
  }

  const btnDocDown = document.getElementById('btn-download-attachment-doc');
  if (btnDocDown && item.lampiran) {
    btnDocDown.onclick = () => downloadPdfFromDataUrl(item.lampiran, fileName);
  }

  const btnMiscDown = document.getElementById('btn-download-attachment-misc');
  if (btnMiscDown && item.lampiran) {
    btnMiscDown.onclick = () => downloadPdfFromDataUrl(item.lampiran, fileName);
  }

  // Hook up official decision letter buttons
  if (hasOfficialLetter) {
    const btnViewOff = document.getElementById('btn-view-official-pdf');
    if (btnViewOff) {
      btnViewOff.onclick = () => openDocumentPreviewSafely(item.suratKeputusanPdf, `Surat_Keputusan_${item.nim}.pdf`);
    }

    const btnDownOff = document.getElementById('btn-download-official-pdf');
    if (btnDownOff) {
      btnDownOff.onclick = () => downloadPdfFromDataUrl(item.suratKeputusanPdf, `Surat_Keputusan_${item.nim}.pdf`);
    }

    const btnPrintOff = document.getElementById('btn-print-official-pdf');
    if (btnPrintOff) {
      btnPrintOff.onclick = () => printPdfDataUrl(item.suratKeputusanPdf);
    }
  }

  // Hook up approval & rejection
  if (item.status === 'Menunggu') {
    const btnApprove = document.getElementById('drawer-btn-approve');
    const btnReject = document.getElementById('drawer-btn-reject');
    const rejectBox = document.getElementById('drawer-reject-form-box');
    const rejectInput = document.getElementById('drawer-reject-reason-input');
    const actionGroup = document.getElementById('drawer-action-buttons-group');
    const btnCancelReject = document.getElementById('btn-cancel-reject-form');
    const btnSubmitReject = document.getElementById('btn-submit-reject-form');

    if (btnApprove) {
      btnApprove.onclick = async () => {
        const confirm = await showConfirmDialog({
          title: `Setujui Pengajuan ${item.jenis}?`,
          message: `Sistem akan otomatis menerbitkan Surat Keputusan Resmi Dekan (A4 PDF) ber-cap stempel HIJAU, menyimpannya ke dokumen mahasiswa, dan mencatat presensi sebagai "${item.jenis}".`,
          confirmText: 'Ya, Terbitkan Surat & Setujui'
        });

        if (confirm) {
          setButtonLoading(btnApprove, true);
          try {
            await approveLeaveRequest(requestId, 'Disetujui oleh pengelola akademik', {
              nama: authState.adminDoc?.nama || authState.user.email,
              role: authState.role
            });
            showToast('success', 'Disetujui & Surat Diterbitkan', `Surat keputusan resmi dekan (A4) ber-cap HIJAU otomatis terkirim ke mahasiswa ${item.nama}.`);
            closeDrawer();
            await loadLeaveTable();
          } catch (err) {
            showToast('error', 'Gagal Menyetujui', err.message);
          } finally {
            setButtonLoading(btnApprove, false);
          }
        }
      };
    }

    if (btnReject && rejectBox) {
      btnReject.onclick = () => {
        rejectBox.classList.remove('hidden');
        if (actionGroup) actionGroup.style.display = 'none';
        if (rejectInput) rejectInput.focus();
      };
    }

    if (btnCancelReject && rejectBox) {
      btnCancelReject.onclick = () => {
        rejectBox.classList.add('hidden');
        if (actionGroup) actionGroup.style.display = 'flex';
      };
    }

    if (btnSubmitReject && rejectInput) {
      btnSubmitReject.onclick = async () => {
        const reason = rejectInput.value.trim();
        if (!reason || reason.length < 3) {
          showToast('warning', 'Alasan Wajib Diisi', 'Silakan tuliskan alasan penolakan pengajuan izin.');
          rejectInput.focus();
          return;
        }

        setButtonLoading(btnSubmitReject, true);
        try {
          await rejectLeaveRequest(requestId, reason, {
            nama: authState.adminDoc?.nama || authState.user.email,
            role: authState.role
          });
          showToast('info', 'Ditolak & Surat Diterbitkan', `Pengajuan telah ditolak dan surat keputusan ber-cap MERAH telah diterbitkan.`);
          closeDrawer();
          await loadLeaveTable();
        } catch (err) {
          showToast('error', 'Gagal Menolak', err.message);
        } finally {
          setButtonLoading(btnSubmitReject, false);
        }
      };
    }
  }

  if (window.lucide) window.lucide.createIcons();
}
