'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Lock, ShieldCheck } from 'lucide-react';

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/';

  const [passcode, setPasscode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setConfigured(Boolean(data.configured));
        if (data.authenticated) {
          router.replace(nextPath.startsWith('/') ? nextPath : '/');
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [router, nextPath]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passcode.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Unable to sign in.');
        return;
      }

      const safeNext = nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/';
      router.replace(safeNext);
      router.refresh();
    } catch {
      setError('Network error while verifying passcode.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-[#F5F4F0] text-[#111312]">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand Identity */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-[#173324] text-[#F5F4F0] flex items-center justify-center shadow-sm">
            <span className="font-mono font-bold text-lg tracking-tighter">GR</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-[-0.025em] text-[#111312]">
              GRanch Operations
            </h1>
            <p className="text-xs font-semibold uppercase tracking-[0.09em] text-[#767C77] mt-1">
              Private Ranch Access
            </p>
          </div>
        </div>

        {/* Fail-Closed Setup Notice if RANCH_PASSCODE is missing */}
        {configured === false && (
          <div className="field-card p-4 border-l-[3px]! border-l-[#B45309]! space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#92400E]">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Passcode Setup Required
            </div>
            <p className="text-xs text-[#525753] leading-relaxed">
              Add <code className="font-mono font-semibold text-[#111312]">RANCH_PASSCODE</code> in
              your Vercel Environment Variables and redeploy to unlock GRanch.
            </p>
          </div>
        )}

        {/* Passcode Unlock Card */}
        <div className="field-card p-6 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="ranch-passcode" className="field-label flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                Ranch Passcode
              </label>
              <input
                id="ranch-passcode"
                type="password"
                required
                autoFocus
                autoComplete="current-password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter ranch passcode"
                className="field-input font-mono text-base tracking-wider min-h-[52px]!"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-[#FAFAF8] border border-[#E2E0D9] border-l-[3px] border-l-[#B42318] text-xs font-semibold text-[#B42318]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !passcode.trim() || configured === false}
              className="w-full min-h-[50px] flex items-center justify-center gap-2 rounded-lg bg-[#173324] hover:bg-[#0F2419] disabled:opacity-50 text-white font-semibold text-sm transition"
            >
              <ShieldCheck className="w-4 h-4" />
              {submitting ? 'Verifying...' : 'Unlock GRanch'}
            </button>
          </form>

          <p className="text-[11px] text-[#767C77] text-center leading-relaxed">
            Stays signed in for 30 days on this device. Instinct AI authenticates separately via{' '}
            <code className="font-mono text-[#525753]">Bearer AI_API_KEY</code>.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F5F4F0] text-sm font-medium text-[#767C77]">
          Loading...
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
