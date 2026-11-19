'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bot,
  ClipboardList,
  DollarSign,
  Home,
  Tag,
} from 'lucide-react';
import { InstinctAiDrawer } from './InstinctAiDrawer';

const NAV_TABS = [
  { href: '/', label: 'Home', icon: Home, match: (p: string) => p === '/' },
  { href: '/herd', label: 'Herd', icon: Tag, match: (p: string) => p.startsWith('/herd') },
  { href: '/logs', label: 'Logs', icon: ClipboardList, match: (p: string) => p.startsWith('/logs') },
  { href: '/finances', label: 'Finances', icon: DollarSign, match: (p: string) => p.startsWith('/finances') },
];

function BottomNavInner() {
  const pathname = usePathname() || '/';
  return (
    <div className="max-w-3xl mx-auto grid grid-cols-4 px-2 pt-1.5 pb-1 gap-1">
      {NAV_TABS.map((tab) => {
        const Icon = tab.icon;
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`min-h-[58px] flex flex-col items-center justify-center gap-1 rounded-xl font-extrabold text-xs tracking-wide transition ${
              active
                ? 'bg-[#1B4D2E] text-white border-2 border-[#141714]'
                : 'text-[#474E47] hover:bg-[#F4F1EA] hover:text-[#141714] border-2 border-transparent'
            }`}
          >
            <Icon className={`w-6 h-6 ${active ? 'stroke-[2.5]' : 'stroke-[2.2]'}`} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F1EA] text-[#141714]">
      {/* High-Contrast Field Top Bar */}
      <header className="sticky top-0 z-30 bg-[#1B4D2E] text-white border-b-2 border-[#141714] shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3 min-h-[48px]">
            <div className="w-10 h-10 rounded-xl bg-[#F4F1EA] border-2 border-[#141714] flex items-center justify-center shrink-0">
              {/* Ear-tag silhouette mark */}
              <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none" aria-hidden="true">
                <path
                  d="M12.5 4H19.5L21 10.5L26 15V26C26 27.1 25.1 28 24 28H8C6.9 28 6 27.1 6 26V15L11 10.5L12.5 4Z"
                  fill="#1B4D2E"
                />
                <circle cx="16" cy="8.5" r="1.8" fill="#F4F1EA" />
                <path
                  d="M10.5 16.5C9.8 18.8 10.8 20.5 13 20.8L14.2 24.5H17.8L19 20.8C21.2 20.5 22.2 18.8 21.5 16.5L20 18.5C19 19.2 18 19.1 17.2 19H14.8C14.1 19.1 13 19.2 12 18.5L10.5 16.5Z"
                  fill="#F4F1EA"
                />
              </svg>
            </div>
            <div>
              <span className="block font-extrabold text-lg leading-tight tracking-tight">
                GRanch
              </span>
              <span className="block text-[11px] font-bold uppercase tracking-widest text-[#CDE5D4]">
                Ranch Operations
              </span>
            </div>
          </Link>

          <button
            type="button"
            id="instinct-ai-trigger"
            onClick={() => setAiDrawerOpen(true)}
            className="min-h-[44px] px-3.5 inline-flex items-center gap-2 rounded-xl bg-[#FEF08A] hover:bg-[#FDE047] text-[#141714] border-2 border-[#141714] font-extrabold text-sm shadow-[0_2px_0_#141714] active:translate-y-0.5 transition"
          >
            <Bot className="w-5 h-5 stroke-[2.5]" />
            <span>Instinct AI</span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 pt-5 pb-28">
        {children}
      </main>

      {/* Persistent 4-Tab Field Bottom Navigation */}
      <nav
        aria-label="Primary Navigation"
        className="fixed bottom-0 inset-x-0 z-30 bg-[#FFFFFF] border-t-2 border-[#141714] shadow-[0_-4px_12px_rgba(20,23,20,0.08)] pb-safe"
      >
        <Suspense fallback={<div className="h-[66px]" />}>
          <BottomNavInner />
        </Suspense>
      </nav>

      <InstinctAiDrawer open={aiDrawerOpen} onClose={() => setAiDrawerOpen(false)} />
    </div>
  );
}
