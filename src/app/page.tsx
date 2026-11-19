'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ChevronRight,
  Mic,
  RefreshCw,
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
      {/* Header */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[#767C77]">
            {todayLabel}
          </p>
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-[-0.025em] text-[#111312] mt-0.5">
            Operations Overview
          </h1>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            fetchDashboard();
          }}
          aria-label="Refresh dashboard"
          className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-lg bg-white border border-[#E2E0D9] hover:border-[#C9C6BC] text-[#525753] hover:text-[#111312] transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Herd Telemetry Matrix */}
      <section aria-labelledby="herd-kpis-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2
            id="herd-kpis-heading"
            className="text-[11px] font-bold uppercase tracking-[0.09em] text-[#767C77]"
          >
            Herd Inventory
          </h2>
          <Link
            href="/herd"
            className="text-xs font-semibold text-[#173324] hover:underline inline-flex items-center gap-0.5"
          >
            View all <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Unified KPI Grid */}
        <div className="field-card overflow-hidden">
          <Link
            href="/herd?filter=active"
            className="flex items-center justify-between px-5 py-4 bg-[#173324] text-[#F5F4F0] hover:bg-[#11281C] transition"
          >
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.09em] text-[#A8C2B3]">
                Active Head Count
              </span>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="font-mono text-4xl font-semibold tabular-nums tracking-tight">
                  {data ? data.herd.totalActiveHead : '—'}
                </span>
                {data && (
                  <span className="text-xs font-medium text-[#C5D8CD]">
                    {data.herd.steers} steers · {data.herd.sold} sold
                  </span>
                )}
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#A8C2B3]" />
          </Link>

          <div className="grid grid-cols-3 divide-x divide-[#ECEAE4] bg-white">
            <Link
              href="/herd?filter=cows"
              className="px-4 py-3.5 hover:bg-[#FAFAF8] transition"
            >
              <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#767C77]">
                Cows / Hfrs
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="font-mono text-2xl font-semibold tabular-nums text-[#111312]">
                  {data ? data.herd.cowsAndHeifers : '—'}
                </span>
                <span className="text-[11px] font-mono text-[#767C77]">
                  {data ? `${data.herd.cows}/${data.herd.heifers}` : ''}
                </span>
              </div>
            </Link>

            <Link
              href="/herd?filter=bulls"
              className="px-4 py-3.5 hover:bg-[#FAFAF8] transition"
            >
              <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#767C77]">
                Bulls
              </span>
              <span className="block font-mono text-2xl font-semibold tabular-nums text-[#111312] mt-1">
                {data ? data.herd.bulls : '—'}
              </span>
            </Link>

            <Link
              href="/herd?filter=calves"
              className="px-4 py-3.5 hover:bg-[#FAFAF8] transition"
            >
              <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#767C77]">
                Calves
              </span>
              <span className="block font-mono text-2xl font-semibold tabular-nums text-[#111312] mt-1">
                {data ? data.herd.calves : '—'}
              </span>
            </Link>
          </div>
        </div>

        {/* Precision Left-Rail Priority Alert Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/herd?filter=due_soon"
            className="field-card-interactive px-4 py-3.5 border-l-[3px]! border-l-[#B45309]! flex items-center justify-between gap-3"
          >
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-[0.07em] text-[#92400E]">
                Due Within 30 Days
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-mono text-2xl font-semibold tabular-nums text-[#111312]">
                  {data ? data.herd.dueWithin30Days : '—'}
                </span>
                <span className="text-xs font-medium text-[#525753]">
                  of {data ? data.herd.pregnant : '—'} pregnant
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#767C77]" />
          </Link>

          <Link
            href="/herd?filter=sick_or_withdrawal"
            className="field-card-interactive px-4 py-3.5 border-l-[3px]! border-l-[#B42318]! flex items-center justify-between gap-3"
          >
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-[0.07em] text-[#B42318]">
                Sick &amp; Withdrawal Hold
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-mono text-2xl font-semibold tabular-nums text-[#111312]">
                  {data ? data.herd.sickOrWithdrawal : '—'}
                </span>
                <span className="text-xs font-medium text-[#525753]">
                  {data ? `${data.herd.sick} sick · ${data.herd.activeWithdrawals} hold` : ''}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#767C77]" />
          </Link>
        </div>

        {/* Active Withdrawal Holds Strip */}
        {data && data.withdrawalAlerts.length > 0 && (
          <div className="field-card px-4 py-3 border-l-[3px]! border-l-[#B42318]! space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.07em] text-[#B42318]">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Active Withdrawal Holds — Do Not Sell
            </div>
            <div className="flex flex-wrap gap-2">
              {data.withdrawalAlerts.map((w) => (
                <Link
                  key={w.id}
                  href={`/herd/${w.cow_id}`}
                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[#F5F4F0] hover:bg-[#EFEDE8] border border-[#E2E0D9] text-xs transition"
                >
                  <span className="font-mono font-bold text-[#111312]">#{w.tag_number}</span>
                  <span className="text-[#525753] font-medium">{w.treatment_name}</span>
                  <span className="font-mono font-semibold text-[#B42318]">
                    Clear {formatShortDate(w.safe_to_sell_date)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Cash Flow Snapshot */}
      <section aria-labelledby="cashflow-heading" className="field-card overflow-hidden">
        <div className="px-4 py-3.5 border-b border-[#ECEAE4] flex items-center justify-between gap-2">
          <h2
            id="cashflow-heading"
            className="text-[11px] font-bold uppercase tracking-[0.09em] text-[#767C77]"
          >
            Cash Flow
          </h2>
          <div className="inline-flex p-0.5 rounded-lg bg-[#EFEDE8] border border-[#E2E0D9]">
            <button
              type="button"
              onClick={() => setCashPeriod('month')}
              className={`min-h-[30px] px-2.5 rounded-md text-[11px] font-semibold transition ${
                cashPeriod === 'month'
                  ? 'bg-white text-[#111312] shadow-xs'
                  : 'text-[#525753] hover:text-[#111312]'
              }`}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setCashPeriod('ytd')}
              className={`min-h-[30px] px-2.5 rounded-md text-[11px] font-semibold transition ${
                cashPeriod === 'ytd'
                  ? 'bg-white text-[#111312] shadow-xs'
                  : 'text-[#525753] hover:text-[#111312]'
              }`}
            >
              YTD
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x divide-[#ECEAE4]">
          <div className="p-3.5 sm:p-4">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#767C77]">
              Inflow
            </span>
            <span className="block font-mono text-base sm:text-xl font-semibold tabular-nums text-[#157347] mt-1">
              {activeCash ? formatCurrency(activeCash.income) : '—'}
            </span>
          </div>

          <div className="p-3.5 sm:p-4">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#767C77]">
              Outflow
            </span>
            <span className="block font-mono text-base sm:text-xl font-semibold tabular-nums text-[#B42318] mt-1">
              {activeCash ? formatCurrency(activeCash.expenses) : '—'}
            </span>
          </div>

          <div className="p-3.5 sm:p-4 bg-[#FAFAF8]">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#767C77]">
              Net
            </span>
            <span
              className={`block font-mono text-base sm:text-xl font-semibold tabular-nums mt-1 ${
                activeCash && activeCash.net >= 0 ? 'text-[#111312]' : 'text-[#B42318]'
              }`}
            >
              {activeCash
                ? `${activeCash.net >= 0 ? '+' : ''}${formatCurrency(activeCash.net)}`
                : '—'}
            </span>
          </div>
        </div>

        <Link
          href="/finances"
          className="px-4 py-2.5 border-t border-[#ECEAE4] bg-[#FAFAF8] hover:bg-[#F5F4F0] flex items-center justify-between text-xs font-semibold text-[#525753] hover:text-[#111312] transition"
        >
          <span>Open Cash-Flow Ledger</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </section>

      {/* Recent Activity Feed */}
      <section aria-labelledby="recent-activity-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2
            id="recent-activity-heading"
            className="text-[11px] font-bold uppercase tracking-[0.09em] text-[#767C77]"
          >
            Recent Activity
          </h2>
          <Link
            href="/logs"
            className="text-xs font-semibold text-[#173324] hover:underline inline-flex items-center gap-0.5"
          >
            Full log <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="field-card divide-y divide-[#ECEAE4] overflow-hidden">
          {!data && loading && (
            <div className="p-6 text-center text-sm font-medium text-[#767C77]">
              Loading ranch activity...
            </div>
          )}

          {data && data.recentLogs.length === 0 && (
            <div className="p-6 text-center text-sm font-medium text-[#767C77]">
              No activity logged yet.
            </div>
          )}

          {data?.recentLogs.map((log) => (
            <article key={log.id} className="p-4 space-y-2 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <LogCategoryBadge category={log.category} />
                  {log.raw_transcript && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#111312] text-[#F5F4F0] text-[10px] font-semibold uppercase tracking-wider">
                      <Mic className="w-2.5 h-2.5" /> AI Voice
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-mono text-[#767C77]">
                  {formatShortDate(log.timestamp)} · {formatTime(log.timestamp)}
                </span>
              </div>

              <p className="text-sm sm:text-[15px] font-medium leading-snug text-[#111312]">
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
                      className={`inline-flex items-center px-2 py-0.5 rounded border border-[#E2E0D9] bg-[#FAFAF8] font-mono text-xs font-semibold tabular-nums ${
                        log.transaction.type === 'INCOME'
                          ? 'text-[#157347]'
                          : 'text-[#B42318]'
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
