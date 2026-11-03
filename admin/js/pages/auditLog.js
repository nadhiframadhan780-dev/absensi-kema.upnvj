/**
 * Page Controller: Jejak Rekam Audit Log (Immutable)
 * Universitas Pembangunan Nasional "Veteran" Jakarta
 */
import { fetchAuditLogs } from '../services/auditService.js';
import { escapeHtml, formatDateTimeWIB, exportToExcel } from '../utils.js';
import { showToast } from '../ui.js';

let auditLogsList = [];
let lastVisibleLog = null;

export async function renderAuditLogPage() {
  const container = document.getElementById('view-auditlog');
  if (!container) return;

  setupAuditLogEventListeners();
  await loadAuditLogsTable(true);
}

function setupAuditLogEventListeners() {
  const filterAction = document.getElementById('filter-audit-action');
  if (filterAction) {
    filterAction.onchange = () => loadAuditLogsTable(true);
  }

  const btnExport = document.getElementById('btn-export-auditlog');
  if (btnExport) {
    btnExport.onclick = () => {
      if (auditLogsList.length === 0) return;
      const exportData = auditLogsList.map((l, i) => ({
        No: i + 1,
        Waktu: formatDateTimeWIB(l.createdAt?.toDate ? l.createdAt.toDate() : l.createdAt),
        Admin: l.nama || '',
        Role: l.role || '',
        Aksi: l.aksi || '',
        Koleksi: l.targetKoleksi || '',
        TargetId: l.targetId || '',
        Perangkat: l.userAgent || ''
      }));
      exportToExcel(exportData, `Audit_Log_UPNVJ_${new Date().toISOString().split('T')[0]}.xlsx`, 'Audit Log');
      showToast('success', 'Ekspor Selesai', 'Jejak audit log berhasil diekspor.');
    };
  }
}

async function loadAuditLogsTable(isReset = false) {
  const tbody = document.getElementById('table-auditlog-body');
  if (!tbody) return;

  const actionVal = document.getElementById('filter-audit-action')?.value || 'all';

  if (isReset) {
    lastVisibleLog = null;
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding: 40px; text-align: center; color: var(--slate-400);">
          <div class="spinner-border" style="width: 24px; height: 24px; margin: 0 auto 10px;"></div>
          <span>Memuat jejak aktivitas sistem...</span>
        </td>
      </tr>
    `;
  }

  try {
    const res = await fetchAuditLogs({
      actionFilter: actionVal,
      lastVisible: lastVisibleLog,
      pageSize: 30
    });

    auditLogsList = res.logs;
    lastVisibleLog = res.lastVisible;

    if (auditLogsList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="padding: 48px; text-align: center; color: var(--slate-400);">
            <i data-lucide="shield-check" style="width: 36px; height: 36px; margin: 0 auto 10px; stroke-width: 1.5; color: #10b981;"></i>
            <p style="font-weight: 600; font-size: 14px; margin: 0; color: var(--slate-600);">Belum Ada Jejak Audit</p>
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    tbody.innerHTML = auditLogsList.map(l => {
      const dateStr = formatDateTimeWIB(l.createdAt?.toDate ? l.createdAt.toDate() : l.createdAt);
      return `
        <tr class="table-row-hover">
          <td style="font-size: 12px; color: var(--slate-600); white-space: nowrap;">
            ${dateStr}
          </td>
          <td>
            <div style="font-weight: 700; color: var(--slate-900); font-size: 13px;">${escapeHtml(l.nama || 'Admin')}</div>
            <div style="font-size: 11px; color: var(--slate-400);">${escapeHtml(l.role || '-')}</div>
          </td>
          <td>
            <span class="badge-audit badge-audit-${(l.aksi || 'general').toLowerCase()}">
              ${escapeHtml(l.aksi || 'AKTIVITAS')}
            </span>
          </td>
          <td style="font-size: 12px;">
            <div><strong>Koleksi:</strong> <span class="font-mono text-gold">${escapeHtml(l.targetKoleksi || '-')}</span></div>
            ${l.targetId ? `<div style="font-size: 10px; color: var(--slate-400);">ID: ${escapeHtml(l.targetId)}</div>` : ''}
          </td>
          <td style="font-size: 11px; color: var(--slate-500); max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHtml(l.userAgent || 'Web Browser')}
          </td>
          <td style="text-align: right;">
            <span style="font-size: 11px; font-weight: 700; color: #10b981;">Tervalidasi</span>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('Error loading audit log:', err);
    showToast('error', 'Gagal Memuat Log', err.message);
  }
}
