'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
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
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[#767C77]">
            Cash-Flow Ledger
          </p>
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-[-0.025em] text-[#111312] mt-0.5">
            Finances
          </h1>
        </div>

        <button
          type="button"
          id="log-transaction-btn"
          onClick={() => setAddOpen(true)}
          className="min-h-[44px] px-4 inline-flex items-center gap-1.5 rounded-lg bg-[#173324] hover:bg-[#0F2419] text-white font-semibold text-sm transition shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.25]" />
          <span>Log Transaction</span>
        </button>
      </div>

      {/* Segmented Timeframe Control */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-[#EFEDE8] rounded-xl border border-[#E2E0D9]">
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
            className={`min-h-[40px] rounded-lg font-semibold text-xs transition ${
              timeframe === tab.key
                ? 'bg-white text-[#111312] shadow-xs border border-[#E2E0D9]'
                : 'text-[#525753] hover:text-[#111312]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Unified Summary Strip */}
      <section className="field-card grid grid-cols-3 divide-x divide-[#ECEAE4] overflow-hidden">
        <div className="p-3.5 sm:p-4">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#767C77]">
            Income
          </span>
          <span className="block font-mono text-base sm:text-2xl font-semibold tabular-nums text-[#157347] mt-1">
            {data ? `+${formatCurrency(data.income)}` : '—'}
          </span>
        </div>

        <div className="p-3.5 sm:p-4">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#767C77]">
            Expenses
          </span>
          <span className="block font-mono text-base sm:text-2xl font-semibold tabular-nums text-[#B42318] mt-1">
            {data ? `−${formatCurrency(data.expenses)}` : '—'}
          </span>
        </div>

        <div className="p-3.5 sm:p-4 bg-[#FAFAF8]">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#767C77]">
            Net P&amp;L
          </span>
          <span
            className={`block font-mono text-base sm:text-2xl font-semibold tabular-nums mt-1 ${
              data && data.net >= 0 ? 'text-[#111312]' : 'text-[#B42318]'
            }`}
          >
            {data
              ? `${data.net >= 0 ? '+' : ''}${formatCurrency(data.net)}`
              : '—'}
          </span>
        </div>
      </section>

      {/* Ledger Table / Rows */}
      <section className="space-y-2">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.09em] text-[#767C77] px-0.5">
          Ledger Entries ({data?.count ?? 0})
        </h2>

        <div className="field-card divide-y divide-[#ECEAE4] overflow-hidden">
          {loading && (
            <div className="p-6 text-center text-sm font-medium text-[#767C77]">
              Loading ledger...
            </div>
          )}

          {!loading && data && data.transactions.length === 0 && (
            <div className="p-8 text-center space-y-1">
              <p className="text-base font-semibold text-[#111312]">
                No transactions in this period
              </p>
              <p className="text-xs text-[#767C77]">
                Switch timeframe or record a new transaction.
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
                className={`p-4 space-y-1.5 bg-white ${
                  isHighlighted ? 'bg-[#FAFAF5] border-l-[3px] border-l-[#173324]' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#E2E0D9] bg-[#FAFAF8] text-[11px] font-semibold uppercase tracking-[0.05em] text-[#111312]">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isIncome ? 'bg-[#157347]' : 'bg-[#B42318]'
                          }`}
                        />
                        {catLabel}
                      </span>
                      <span className="font-mono text-[11px] text-[#767C77]">
                        {formatShortDate(tx.date)}
                      </span>
                    </div>

                    <p className="font-semibold text-[15px] text-[#111312] truncate">
                      {tx.vendor_or_buyer || catLabel}
                    </p>
                  </div>

                  <span
                    className={`font-mono text-base sm:text-lg font-semibold tabular-nums shrink-0 ${
                      isIncome ? 'text-[#157347]' : 'text-[#B42318]'
                    }`}
                  >
                    {isIncome ? '+' : '−'}
                    {formatCurrency(tx.amount)}
                  </span>
                </div>

                {(tx.notes || tx.cow) && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    {tx.notes ? (
                      <p className="text-xs text-[#525753]">{tx.notes}</p>
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
        </div>
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
        <div className="field-card p-6 text-center text-sm font-medium text-[#767C77]">
          Loading finances...
        </div>
      }
    >
      <FinancesContent />
    </Suspense>
  );
}
