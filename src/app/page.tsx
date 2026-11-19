'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Mic,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { EarTagBadge, LogCategoryBadge } from '@/components/Badges';
import { formatCurrency, formatShortDate, formatTime } from '@/lib/dates';

interface DashboardResponse {
  generatedAt?: string;
  herd: {
    totalActiveHead: number;
    cows: number;
    cowsAndHeifers: number;
    heifers: number;
    bulls: number;
    calves: number;
    steers: number;
    pregnant: number;
    dueWithin30Days: number;
    sick: number;
    activeWithdrawals: number;
    sickOrWithdrawal: number;
    sold: number;
  };
  cashFlow: {
    month: { income: number; expenses: number; net: number };
    ytd: { income: number; expenses: number; net: number };
  };
  withdrawalAlerts: Array<{
    id: string;
    cow_id: string;
    tag_number: string;
    cow_name: string | null;
    treatment_name: string;
    safe_to_sell_date: string;
  }>;
  recentLogs: Array<{
    id: string;
    timestamp: string;
    category: string;
    summary: string;
    raw_transcript: string | null;
    cow: { id: string; tag_number: string; name: string | null } | null;
    transaction: { id: string; type: string; amount: number; category: string } | null;
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [cashPeriod, setCashPeriod] = useState<'month' | 'ytd'>('month');

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const onRefresh = () => fetchDashboard();
    window.addEventListener('granch:data-changed', onRefresh);
    return () => window.removeEventListener('granch:data-changed', onRefresh);
  }, [fetchDashboard]);

  const activeCash = data ? data.cashFlow[cashPeriod] : null;
  const todayLabel = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Live Ranch Operations';

  return (
    <div className="space-y-6">
      {/* Page Heading */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#141714]">
            Ranch Overview
          </h1>
          <p className="text-sm font-bold text-[#474E47] mt-0.5">{todayLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            fetchDashboard();
          }}
          aria-label="Refresh dashboard"
          className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-white border-2 border-[#CFC8BA] hover:border-[#141714] text-[#141714] active:scale-95 transition"
        >
          <RefreshCw className={`w-5 h-5 stroke-[2.5] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Live Herd KPI Cards (Tap any card to jump directly to filtered herd) */}
      <section aria-labelledby="herd-kpis-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2
            id="herd-kpis-heading"
            className="text-xs font-extrabold uppercase tracking-widest text-[#474E47]"
          >
            Live Herd Inventory — Tap to Filter
          </h2>
          <Link
            href="/herd"
            className="text-sm font-extrabold text-[#1B4D2E] hover:underline inline-flex items-center gap-1"
          >
            Full Herd <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Hero Active Head + Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            href="/herd?filter=active"
            className="col-span-2 sm:col-span-2 field-card-interactive p-4 bg-[#1B4D2E]! border-[#141714]! text-white flex items-center justify-between"
          >
            <div>
              <span className="block text-xs font-extrabold uppercase tracking-wider text-[#CDE5D4]">
                Total Active Head
              </span>
              <span className="block font-mono text-4xl font-extrabold tabular-nums mt-1">
                {data ? data.herd.totalActiveHead : '—'}
              </span>
              {data && (
                <span className="block text-xs font-bold text-[#CDE5D4] mt-1">
                  {data.herd.steers} Steers · {data.herd.sold} Sold
                </span>
              )}
            </div>
            <ArrowRight className="w-6 h-6 text-[#FEF08A] shrink-0" />
          </Link>

          <Link
            href="/herd?filter=cows"
            className="field-card-interactive p-4 flex flex-col justify-between"
          >
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#474E47]">
              Cows & Heifers
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-mono text-3xl font-extrabold tabular-nums text-[#141714]">
                {data ? data.herd.cowsAndHeifers : '—'}
              </span>
              <span className="text-xs font-bold text-[#474E47]">
                {data ? `${data.herd.cows}C / ${data.herd.heifers}H` : ''}
              </span>
            </div>
          </Link>

          <div className="grid grid-cols-2 gap-3 col-span-1 sm:col-span-1">
            <Link
              href="/herd?filter=bulls"
              className="field-card-interactive p-3.5 flex flex-col justify-between"
            >
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#474E47]">
                Bulls
              </span>
              <span className="font-mono text-2xl font-extrabold tabular-nums text-[#141714] mt-1">
                {data ? data.herd.bulls : '—'}
              </span>
            </Link>
            <Link
              href="/herd?filter=calves"
              className="field-card-interactive p-3.5 flex flex-col justify-between"
            >
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#474E47]">
                Calves
              </span>
              <span className="font-mono text-2xl font-extrabold tabular-nums text-[#141714] mt-1">
                {data ? data.herd.calves : '—'}
              </span>
            </Link>
          </div>
        </div>

        {/* High-Visibility Quick-Filter Alert Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/herd?filter=due_soon"
            className={`field-card-interactive p-4 flex items-center justify-between gap-3 ${
              data && data.herd.dueWithin30Days > 0
                ? 'bg-[#FEF3C7]! border-[#B45309]!'
                : ''
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-[#B45309] text-white flex items-center justify-center shrink-0">
                <CalendarClock className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <span className="block text-xs font-extrabold uppercase tracking-wider text-[#78350F]">
                  Pregnant / Due ≤ 30 Days
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="font-mono text-3xl font-extrabold tabular-nums text-[#141714]">
                    {data ? data.herd.dueWithin30Days : '—'}
                  </span>
                  <span className="text-sm font-bold text-[#78350F]">
                    due soon ({data ? data.herd.pregnant : '—'} total bred)
                  </span>
                </div>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-[#78350F] shrink-0" />
          </Link>

          <Link
            href="/herd?filter=sick_or_withdrawal"
            className={`field-card-interactive p-4 flex items-center justify-between gap-3 ${
              data && data.herd.sickOrWithdrawal > 0
                ? 'bg-[#FEE2E2]! border-[#B91C1C]!'
                : ''
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-[#B91C1C] text-white flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <span className="block text-xs font-extrabold uppercase tracking-wider text-[#7F1D1D]">
                  Sick / Withdrawal Flags
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="font-mono text-3xl font-extrabold tabular-nums text-[#141714]">
                    {data ? data.herd.sickOrWithdrawal : '—'}
                  </span>
                  <span className="text-sm font-bold text-[#7F1D1D]">
                    {data
                      ? `${data.herd.sick} sick · ${data.herd.activeWithdrawals} hold`
                      : ''}
                  </span>
                </div>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-[#7F1D1D] shrink-0" />
          </Link>
        </div>

        {/* Active Withdrawal Banner */}
        {data && data.withdrawalAlerts.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-[#FEF3C7] border-2 border-[#B45309] space-y-2">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#78350F]">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Active Medication Withdrawals (Do Not Sell)
            </div>
            <div className="flex flex-wrap gap-2">
              {data.withdrawalAlerts.map((w) => (
                <Link
                  key={w.id}
                  href={`/herd/${w.cow_id}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border-2 border-[#B45309] text-sm font-bold text-[#141714] hover:bg-[#FFFBEB]"
                >
                  <span className="font-mono font-extrabold">#{w.tag_number}</span>
                  <span className="text-[#474E47]">{w.treatment_name}</span>
                  <span className="text-xs font-extrabold text-[#B45309] font-mono">
                    Clear {formatShortDate(w.safe_to_sell_date)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Cash Flow Snapshot */}
      <section aria-labelledby="cashflow-heading" className="field-card p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id="cashflow-heading"
            className="text-lg font-extrabold tracking-tight text-[#141714]"
          >
            Cash Flow Snapshot
          </h2>
          <div className="inline-flex p-1 rounded-xl bg-[#EBE6DC] border-2 border-[#CFC8BA]">
            <button
              type="button"
              onClick={() => setCashPeriod('month')}
              className={`min-h-[38px] px-3.5 rounded-lg text-xs font-extrabold uppercase tracking-wide transition ${
                cashPeriod === 'month'
                  ? 'bg-[#141714] text-white'
                  : 'text-[#474E47] hover:text-[#141714]'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setCashPeriod('ytd')}
              className={`min-h-[38px] px-3.5 rounded-lg text-xs font-extrabold uppercase tracking-wide transition ${
                cashPeriod === 'ytd'
                  ? 'bg-[#141714] text-white'
                  : 'text-[#474E47] hover:text-[#141714]'
              }`}
            >
              Year to Date
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <div className="p-3 sm:p-3.5 rounded-xl bg-[#DCFCE7] border-2 border-[#15803D]">
            <span className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wide text-[#14532D]">
              <ArrowDownLeft className="w-3.5 h-3.5" /> Money In
            </span>
            <span className="block font-mono text-lg sm:text-xl font-extrabold tabular-nums text-[#14532D] mt-1">
              {activeCash ? formatCurrency(activeCash.income) : '—'}
            </span>
          </div>

          <div className="p-3 sm:p-3.5 rounded-xl bg-[#FEE2E2] border-2 border-[#B91C1C]">
            <span className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wide text-[#7F1D1D]">
              <ArrowUpRight className="w-3.5 h-3.5" /> Money Out
            </span>
            <span className="block font-mono text-lg sm:text-xl font-extrabold tabular-nums text-[#7F1D1D] mt-1">
              {activeCash ? formatCurrency(activeCash.expenses) : '—'}
            </span>
          </div>

          <div className="p-3 sm:p-3.5 rounded-xl bg-[#F4F1EA] border-2 border-[#141714]">
            <span className="block text-[11px] font-extrabold uppercase tracking-wide text-[#474E47]">
              Net Flow
            </span>
            <span
              className={`block font-mono text-lg sm:text-xl font-extrabold tabular-nums mt-1 ${
                activeCash && activeCash.net >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
              }`}
            >
              {activeCash
                ? `${activeCash.net >= 0 ? '+' : ''}${formatCurrency(activeCash.net)}`
                : '—'}
            </span>
          </div>
        </div>

        <div className="pt-1 flex justify-end">
          <Link
            href="/finances"
            className="text-sm font-extrabold text-[#1B4D2E] hover:underline inline-flex items-center gap-1"
          >
            Open Full Ledger <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Recent Activity Feed (Last 5 daily_logs) */}
      <section aria-labelledby="recent-activity-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2
            id="recent-activity-heading"
            className="text-lg font-extrabold tracking-tight text-[#141714]"
          >
            Recent Activity
          </h2>
          <Link
            href="/logs"
            className="text-sm font-extrabold text-[#1B4D2E] hover:underline inline-flex items-center gap-1"
          >
            All Logs <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="space-y-2.5">
          {!data && loading && (
            <div className="field-card p-6 text-center font-bold text-[#474E47]">
              Loading ranch activity...
            </div>
          )}

          {data && data.recentLogs.length === 0 && (
            <div className="field-card p-6 text-center font-bold text-[#474E47]">
              No activity logged yet.
            </div>
          )}

          {data?.recentLogs.map((log) => (
            <article key={log.id} className="field-card p-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <LogCategoryBadge category={log.category} />
                  {log.raw_transcript && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#141714] text-[#FEF08A] text-[11px] font-extrabold uppercase tracking-wide">
                      <Mic className="w-3 h-3" /> Instinct AI
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold font-mono text-[#474E47]">
                  {formatShortDate(log.timestamp)} · {formatTime(log.timestamp)}
                </span>
              </div>

              <p className="text-base font-semibold leading-snug text-[#141714]">
                {log.summary}
              </p>

              {(log.cow || log.transaction) && (
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {log.cow && (
                    <Link href={`/herd/${log.cow.id}`} className="inline-flex">
                      <EarTagBadge tag={log.cow.tag_number} size="sm" />
                    </Link>
                  )}
                  {log.transaction && (
                    <Link
                      href={`/finances?highlight=${log.transaction.id}`}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-md border font-mono text-xs font-extrabold tabular-nums ${
                        log.transaction.type === 'INCOME'
                          ? 'bg-[#DCFCE7] text-[#14532D] border-[#15803D]'
                          : 'bg-[#FEE2E2] text-[#7F1D1D] border-[#B91C1C]'
                      }`}
                    >
                      {log.transaction.type === 'INCOME' ? '+' : '−'}
                      {formatCurrency(log.transaction.amount)}
                    </Link>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
