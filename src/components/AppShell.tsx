'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ClipboardList,
  DollarSign,
  LayoutGrid,
  Radio,
  Shield,
  Tag,
} from 'lucide-react';
import { InstinctAiDrawer } from './InstinctAiDrawer';
import { SecurityDataDrawer } from './SecurityDataDrawer';

const NAV_TABS = [
  { href: '/', label: 'Overview', icon: LayoutGrid, match: (p: string) => p === '/' },
  { href: '/herd', label: 'Herd', icon: Tag, match: (p: string) => p.startsWith('/herd') },
  { href: '/logs', label: 'Logs', icon: ClipboardList, match: (p: string) => p.startsWith('/logs') },
  { href: '/finances', label: 'Finances', icon: DollarSign, match: (p: string) => p.startsWith('/finances') },
];

function ShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [securityDrawerOpen, setSecurityDrawerOpen] = useState(false);

  // Render /login cleanly without main app chrome
  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F4F0] text-[#111312]">
      {/* Architectural Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-[#E2E0D9]">
        <div className="max-w-3xl mx-auto px-4 h-15 py-2 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2.5 min-h-[44px]">
            <div className="w-8 h-8 rounded-lg bg-[#173324] text-[#F5F4F0] flex items-center justify-center shrink-0">
              <span className="font-mono font-bold text-sm tracking-tighter">GR</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-base tracking-[-0.02em] text-[#111312]">
                GRanch
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#767C77]">
                Operations
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="security-data-trigger"
              onClick={() => setSecurityDrawerOpen(true)}
              aria-label="Security and ranch data"
              title="Security, Backups & Audit Log"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-[#F5F4F0] hover:bg-[#EFEDE8] border border-[#E2E0D9] text-[#111312] transition"
            >
              <Shield className="w-4 h-4 stroke-[2]" />
            </button>

            <button
              type="button"
              id="instinct-ai-trigger"
              onClick={() => setAiDrawerOpen(true)}
              className="min-h-[40px] px-3.5 inline-flex items-center gap-2 rounded-lg bg-[#111312] hover:bg-[#232724] text-[#F5F4F0] font-semibold text-xs tracking-wide transition"
            >
              <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
              <Radio className="w-3.5 h-3.5 stroke-[2]" />
              <span>Instinct AI</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 pt-5 pb-28">
        {children}
      </main>

      {/* Persistent 4-Tab Field Bottom Navigation */}
      <nav
        aria-label="Primary Navigation"
        className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-sm border-t border-[#E2E0D9] pb-safe"
      >
        <div className="max-w-3xl mx-auto grid grid-cols-4 px-2">
          {NAV_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.match(pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative min-h-[60px] flex flex-col items-center justify-center gap-1 text-[11px] tracking-[0.04em] transition ${
                  active
                    ? 'text-[#111312] font-bold'
                    : 'text-[#767C77] hover:text-[#111312] font-medium'
                }`}
              >
                {active && (
                  <span className="absolute top-0 inset-x-5 h-[2.5px] rounded-b-full bg-[#173324]" />
                )}
                <Icon className={`w-5 h-5 ${active ? 'stroke-[2.25] text-[#173324]' : 'stroke-[1.75]'}`} />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <InstinctAiDrawer open={aiDrawerOpen} onClose={() => setAiDrawerOpen(false)} />
      <SecurityDataDrawer open={securityDrawerOpen} onClose={() => setSecurityDrawerOpen(false)} />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F4F0]" />}>
      <ShellFrame>{children}</ShellFrame>
    </Suspense>
  );
}
