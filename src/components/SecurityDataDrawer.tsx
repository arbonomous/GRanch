'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Database,
  Download,
  History,
  LogOut,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { ModalSheet } from './Badges';
import { formatShortDate, formatTime } from '@/lib/dates';

interface AuditEntry {
  id: string;
  idempotency_key: string | null;
  source: string;
  endpoint: string;
  parser: string;
  raw_transcript: string | null;
  status_code: number;
  response_message: string;
  created_at: string;
}

function SecurityDataInner({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [clearPhrase, setClearPhrase] = useState('');
  const [clearing, setClearing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/admin/audit', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.audit_logs) setAuditLogs(data.audit_logs);
      })
      .finally(() => {
        if (active) setLoadingAudit(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleClearData(e: React.FormEvent) {
    e.preventDefault();
    if (clearPhrase.trim().toUpperCase() !== 'CLEAR') return;
    setClearing(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/admin/clear-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'CLEAR RANCH DATA' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg({ ok: false, text: data.error || 'Could not clear ranch data.' });
        return;
      }
      setClearPhrase('');
      setAuditLogs([]);
      setStatusMsg({ ok: true, text: data.message });
      window.dispatchEvent(new CustomEvent('granch:data-changed'));
    } catch {
      setStatusMsg({ ok: false, text: 'Network error clearing data.' });
    } finally {
      setClearing(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      onClose();
      router.replace('/login');
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Backup & Export */}
      <section className="field-card overflow-hidden">
        <div className="px-4 py-3 border-b border-[#ECEAE4] flex items-center gap-2">
          <Database className="w-4 h-4 text-[#173324]" />
          <h3 className="text-[11px] font-bold uppercase tracking-[0.09em] text-[#767C77]">
            Backup &amp; Export
          </h3>
        </div>
        <div className="p-4 space-y-3">
          <a
            href="/api/admin/export?format=json"
            download
            className="w-full min-h-[46px] px-4 inline-flex items-center justify-center gap-2 rounded-lg bg-[#173324] hover:bg-[#0F2419] text-white font-semibold text-xs transition"
          >
            <Download className="w-4 h-4" />
            Download Full Ranch Backup (.json)
          </a>

          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['cows', 'Herd CSV'],
                ['health', 'Health CSV'],
                ['logs', 'Daily Logs CSV'],
                ['transactions', 'Finances CSV'],
              ] as const
            ).map(([table, label]) => (
              <a
                key={table}
                href={`/api/admin/export?format=csv&table=${table}`}
                download
                className="min-h-[40px] px-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#F5F4F0] hover:bg-[#EFEDE8] border border-[#E2E0D9] text-xs font-semibold text-[#111312] transition"
              >
                <Download className="w-3.5 h-3.5 text-[#525753]" />
                {label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* AI Write Audit Log */}
      <section className="field-card overflow-hidden">
        <div className="px-4 py-3 border-b border-[#ECEAE4] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#173324]" />
            <h3 className="text-[11px] font-bold uppercase tracking-[0.09em] text-[#767C77]">
              AI Write Audit Log ({auditLogs.length})
            </h3>
          </div>
          <span className="text-[10px] font-mono text-[#767C77]">DELETE blocked for AI</span>
        </div>

        <div className="divide-y divide-[#ECEAE4] max-h-60 overflow-y-auto">
          {loadingAudit && (
            <p className="p-4 text-xs text-[#767C77]">Loading audit entries...</p>
          )}
          {!loadingAudit && auditLogs.length === 0 && (
            <p className="p-4 text-xs text-[#767C77]">
              No AI ingest calls recorded yet. Every call to /api/ai/ingest is logged here.
            </p>
          )}
          {auditLogs.map((entry) => (
            <div key={entry.id} className="p-3.5 space-y-1 bg-white">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-[#111312] text-[#F5F4F0] text-[10px] font-semibold uppercase">
                    {entry.source === 'instinct_ai' ? 'Instinct AI' : 'UI Console'}
                  </span>
                  <span className="text-[10px] font-mono text-[#767C77]">{entry.parser}</span>
                </div>
                <span className="font-mono text-[10px] text-[#767C77]">
                  {formatShortDate(entry.created_at)} · {formatTime(entry.created_at)}
                </span>
              </div>
              <p className="text-xs font-medium text-[#111312]">{entry.response_message}</p>
              {entry.idempotency_key && (
                <p className="text-[10px] font-mono text-[#767C77] truncate">
                  Key: {entry.idempotency_key}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Clear Sample Data */}
      <section className="field-card overflow-hidden border-l-[3px]! border-l-[#B42318]!">
        <div className="px-4 py-3 border-b border-[#ECEAE4] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[#B42318]" />
          <h3 className="text-[11px] font-bold uppercase tracking-[0.09em] text-[#B42318]">
            Clear Sample / Ranch Data
          </h3>
        </div>
        <form onSubmit={handleClearData} className="p-4 space-y-3">
          <p className="text-xs text-[#525753] leading-relaxed">
            Ready to enter your real herd? Export a backup first, then type{' '}
            <code className="font-mono font-bold text-[#111312]">CLEAR</code> below to empty all
            cattle, health records, logs, and transactions.
          </p>

          {statusMsg && (
            <div
              className={`p-3 rounded-lg border text-xs font-semibold ${
                statusMsg.ok
                  ? 'bg-[#FAFAF8] border-[#E2E0D9] border-l-[3px] border-l-[#157347] text-[#157347]'
                  : 'bg-[#FAFAF8] border-[#E2E0D9] border-l-[3px] border-l-[#B42318] text-[#B42318]'
              }`}
            >
              {statusMsg.text}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={clearPhrase}
              onChange={(e) => setClearPhrase(e.target.value)}
              placeholder='Type "CLEAR"'
              className="field-input font-mono text-xs min-h-[42px]!"
            />
            <button
              type="submit"
              disabled={clearing || clearPhrase.trim().toUpperCase() !== 'CLEAR'}
              className="min-h-[42px] px-4 inline-flex items-center gap-1.5 rounded-lg bg-[#B42318] hover:bg-[#911C13] disabled:opacity-40 text-white font-semibold text-xs whitespace-nowrap transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {clearing ? 'Clearing...' : 'Reset DB'}
            </button>
          </div>
        </form>
      </section>

      {/* Sign Out */}
      <div className="pt-1 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#767C77]">
          <ShieldCheck className="w-4 h-4 text-[#157347]" />
          Signed in as Ranch Owner (30d session)
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="min-h-[40px] px-3.5 inline-flex items-center gap-1.5 rounded-lg bg-white hover:bg-[#EFEDE8] border border-[#D6D3CB] text-xs font-semibold text-[#111312] transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          {signingOut ? 'Locking...' : 'Lock / Sign Out'}
        </button>
      </div>
    </div>
  );
}

export function SecurityDataDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title="Security & Ranch Data"
      subtitle="Backups, Instinct AI audit log, data reset, and session lock"
    >
      {open && <SecurityDataInner onClose={onClose} />}
    </ModalSheet>
  );
}
