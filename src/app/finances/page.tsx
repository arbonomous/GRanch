'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowDownLeft, ArrowUpRight, Plus } from 'lucide-react';
import { EarTagBadge } from '@/components/Badges';
import { TransactionFormModal } from '@/components/TransactionFormModal';
import {
  TRANSACTION_CATEGORY_LABELS,
  TransactionCategory,
} from '@/lib/constants';
import { formatCurrency, formatShortDate } from '@/lib/dates';

interface TransactionRow {
  id: string;
  date: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  vendor_or_buyer: string | null;
  notes: string;
  cow: { id: string; tag_number: string; name: string | null } | null;
}

interface FinancesResponse {
  timeframe: 'month' | 'year' | 'all';
  income: number;
  expenses: number;
  net: number;
  count: number;
  transactions: TransactionRow[];
}

function FinancesContent() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('highlight');

  const [timeframe, setTimeframe] = useState<'month' | 'year' | 'all'>(
    highlightId ? 'all' : 'month'
  );
  const [data, setData] = useState<FinancesResponse | null>(null);
  const [herdOptions, setHerdOptions] = useState<
    Array<{ id: string; tag_number: string; name: string | null; status: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const fetchFinances = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`/api/transactions?timeframe=${timeframe}`, {
      cache: 'no-store',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (active && json) setData(json);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [timeframe, refreshTick]);

  useEffect(() => {
    let active = true;
    fetch('/api/cows?filter=all', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d?.cows) setHerdOptions(d.cows);
      })
      .catch(() => {});

    window.addEventListener('granch:data-changed', fetchFinances);
    return () => {
      active = false;
      window.removeEventListener('granch:data-changed', fetchFinances);
    };
  }, [fetchFinances]);

  return (
    <div className="space-y-5">
      {/* Header + Log Transaction */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#141714]">
            Ranch Finances
          </h1>
          <p className="text-sm font-bold text-[#474E47]">
            Simple cash-flow ledger
          </p>
        </div>

        <button
          type="button"
          id="log-transaction-btn"
          onClick={() => setAddOpen(true)}
          className="min-h-[50px] px-4 inline-flex items-center gap-2 rounded-xl bg-[#1B4D2E] hover:bg-[#133922] text-white font-extrabold text-sm sm:text-base border-2 border-[#141714] shadow-[0_2px_0_#141714] active:translate-y-0.5 transition shrink-0"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span>Log Transaction</span>
        </button>
      </div>

      {/* Timeframe Toggle */}
      <div className="grid grid-cols-3 gap-2 p-1.5 bg-[#EBE6DC] rounded-2xl border-2 border-[#CFC8BA]">
        {(
          [
            { key: 'month', label: 'This Month' },
            { key: 'year', label: 'This Year' },
            { key: 'all', label: 'All Time' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setTimeframe(tab.key)}
            className={`min-h-[46px] rounded-xl font-extrabold text-sm transition ${
              timeframe === tab.key
                ? 'bg-[#141714] text-white'
                : 'text-[#474E47] hover:bg-white/60 hover:text-[#141714]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Top Summary Bar */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-[#DCFCE7] border-2 border-[#15803D]">
          <span className="flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-[#14532D]">
            <ArrowDownLeft className="w-4 h-4" /> Total Income
          </span>
          <span className="block font-mono text-2xl sm:text-3xl font-extrabold tabular-nums text-[#14532D] mt-1">
            {data ? `+${formatCurrency(data.income)}` : '—'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#FEE2E2] border-2 border-[#B91C1C]">
          <span className="flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-[#7F1D1D]">
            <ArrowUpRight className="w-4 h-4" /> Total Expenses
          </span>
          <span className="block font-mono text-2xl sm:text-3xl font-extrabold tabular-nums text-[#7F1D1D] mt-1">
            {data ? `−${formatCurrency(data.expenses)}` : '—'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border-2 border-[#141714] shadow-[0_2px_0_#141714]">
          <span className="block text-xs font-extrabold uppercase tracking-wider text-[#474E47]">
            Net Profit / Loss
          </span>
          <span
            className={`block font-mono text-2xl sm:text-3xl font-extrabold tabular-nums mt-1 ${
              data && data.net >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
            }`}
          >
            {data
              ? `${data.net >= 0 ? '+' : ''}${formatCurrency(data.net)}`
              : '—'}
          </span>
        </div>
      </section>

      {/* Ledger List */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-[#474E47]">
            Transactions ({data?.count ?? 0})
          </h2>
        </div>

        {loading && (
          <div className="field-card p-6 text-center font-bold text-[#474E47]">
            Loading ledger...
          </div>
        )}

        {!loading && data && data.transactions.length === 0 && (
          <div className="field-card p-8 text-center space-y-2">
            <p className="text-lg font-extrabold text-[#141714]">
              No transactions in this period
            </p>
            <p className="text-sm font-medium text-[#474E47]">
              Switch timeframe or tap &ldquo;+ Log Transaction&rdquo; to record one.
            </p>
          </div>
        )}

        {data?.transactions.map((tx) => {
          const isIncome = tx.type === 'INCOME';
          const isHighlighted = highlightId === tx.id;
          const catLabel =
            TRANSACTION_CATEGORY_LABELS[tx.category as TransactionCategory] ??
            tx.category;

          return (
            <article
              key={tx.id}
              className={`field-card p-4 space-y-2 ${
                isHighlighted ? 'ring-4 ring-[#FEF08A] border-[#141714]!' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-lg border text-xs font-extrabold uppercase tracking-wide ${
                        isIncome
                          ? 'bg-[#DCFCE7] text-[#14532D] border-[#15803D]'
                          : 'bg-[#FEE2E2] text-[#7F1D1D] border-[#B91C1C]'
                      }`}
                    >
                      {catLabel}
                    </span>
                    <span className="font-mono text-xs font-bold text-[#474E47]">
                      {formatShortDate(tx.date)}
                    </span>
                  </div>

                  <p className="font-extrabold text-base text-[#141714] truncate">
                    {tx.vendor_or_buyer || catLabel}
                  </p>
                </div>

                <span
                  className={`font-mono text-xl font-extrabold tabular-nums shrink-0 ${
                    isIncome ? 'text-[#15803D]' : 'text-[#B91C1C]'
                  }`}
                >
                  {isIncome ? '+' : '−'}
                  {formatCurrency(tx.amount)}
                </span>
              </div>

              {(tx.notes || tx.cow) && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#EBE6DC]">
                  {tx.notes ? (
                    <p className="text-sm font-medium text-[#474E47]">{tx.notes}</p>
                  ) : (
                    <span />
                  )}
                  {tx.cow && (
                    <Link href={`/herd/${tx.cow.id}`} className="inline-flex">
                      <EarTagBadge tag={tx.cow.tag_number} size="sm" />
                    </Link>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </section>

      <TransactionFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        herdOptions={herdOptions}
        onSaved={fetchFinances}
      />
    </div>
  );
}

export default function FinancesPage() {
  return (
    <Suspense
      fallback={
        <div className="field-card p-6 text-center font-bold text-[#474E47]">
          Loading finances...
        </div>
      }
    >
      <FinancesContent />
    </Suspense>
  );
}
