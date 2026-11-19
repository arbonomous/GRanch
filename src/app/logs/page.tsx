'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Mic, Plus } from 'lucide-react';
import { EarTagBadge, LogCategoryBadge } from '@/components/Badges';
import { LogFormModal } from '@/components/LogFormModal';
import { LOG_CATEGORIES, LOG_CATEGORY_LABELS } from '@/lib/constants';
import {
  formatCurrency,
  formatDateGroupHeading,
  formatTime,
} from '@/lib/dates';

interface LogRow {
  id: string;
  timestamp: string;
  category: string;
  summary: string;
  raw_transcript: string | null;
  cow: { id: string; tag_number: string; name: string | null } | null;
  transaction: {
    id: string;
    type: string;
    category: string;
    amount: number;
    vendor_or_buyer: string | null;
  } | null;
}

export default function DailyLogsPage() {
  const [category, setCategory] = useState('ALL');
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [herdOptions, setHerdOptions] = useState<
    Array<{ id: string; tag_number: string; name: string | null }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const fetchLogs = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const qs = category === 'ALL' ? '' : `?category=${category}`;
    fetch(`/api/logs${qs}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (active && json?.logs) setLogs(json.logs);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [category, refreshTick]);

  useEffect(() => {
    let active = true;
    fetch('/api/cows?filter=all', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d?.cows) setHerdOptions(d.cows);
      })
      .catch(() => {});

    window.addEventListener('granch:data-changed', fetchLogs);
    return () => {
      active = false;
      window.removeEventListener('granch:data-changed', fetchLogs);
    };
  }, [fetchLogs]);

  const groupedLogs = useMemo(() => {
    const groups: Array<{ heading: string; items: LogRow[] }> = [];
    const byHeading = new Map<string, LogRow[]>();

    for (const log of logs) {
      const heading = formatDateGroupHeading(log.timestamp);
      if (!byHeading.has(heading)) {
        const list: LogRow[] = [];
        byHeading.set(heading, list);
        groups.push({ heading, items: list });
      }
      byHeading.get(heading)!.push(log);
    }
    return groups;
  }, [logs]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#141714]">
            Daily Ranch Log
          </h1>
          <p className="text-sm font-bold text-[#474E47]">
            Unified voice & field activity feed
          </p>
        </div>

        <button
          type="button"
          id="add-log-btn"
          onClick={() => setAddOpen(true)}
          className="min-h-[50px] px-4 inline-flex items-center gap-2 rounded-xl bg-[#1B4D2E] hover:bg-[#133922] text-white font-extrabold text-sm sm:text-base border-2 border-[#141714] shadow-[0_2px_0_#141714] active:translate-y-0.5 transition shrink-0"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span>Log Activity</span>
        </button>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4">
        <button
          type="button"
          onClick={() => setCategory('ALL')}
          className={`min-h-[44px] px-4 rounded-xl font-extrabold text-sm whitespace-nowrap border-2 transition shrink-0 ${
            category === 'ALL'
              ? 'bg-[#141714] text-white border-[#141714]'
              : 'bg-white text-[#141714] border-[#CFC8BA] hover:border-[#141714]'
          }`}
        >
          All
        </button>
        {LOG_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`min-h-[44px] px-4 rounded-xl font-extrabold text-sm whitespace-nowrap border-2 transition shrink-0 ${
              category === cat
                ? 'bg-[#141714] text-white border-[#141714]'
                : 'bg-white text-[#141714] border-[#CFC8BA] hover:border-[#141714]'
            }`}
          >
            {LOG_CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Chronological Timeline Grouped by Date */}
      {loading && (
        <div className="field-card p-6 text-center font-bold text-[#474E47]">
          Loading ranch logs...
        </div>
      )}

      {!loading && groupedLogs.length === 0 && (
        <div className="field-card p-8 text-center space-y-2">
          <p className="text-lg font-extrabold text-[#141714]">No logs in this category</p>
          <p className="text-sm font-medium text-[#474E47]">
            Speak to Instinct AI or tap &ldquo;+ Log Activity&rdquo; to add an entry.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {groupedLogs.map((group) => (
          <section key={group.heading} className="space-y-2.5">
            <div className="sticky top-[64px] z-10 py-1.5 bg-[#F4F1EA]/95 backdrop-blur-xs">
              <h2 className="inline-flex items-center px-3 py-1 rounded-lg bg-[#141714] text-white text-xs font-extrabold uppercase tracking-wider">
                {group.heading}
              </h2>
            </div>

            <div className="space-y-3">
              {group.items.map((log) => (
                <article key={log.id} className="field-card p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <LogCategoryBadge category={log.category} />
                      {log.raw_transcript && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#141714] text-[#FEF08A] text-[11px] font-extrabold uppercase">
                          <Mic className="w-3 h-3" /> Instinct AI
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs font-bold text-[#474E47]">
                      {formatTime(log.timestamp)}
                    </span>
                  </div>

                  <p className="text-base font-semibold leading-snug text-[#141714]">
                    {log.summary}
                  </p>

                  {log.raw_transcript && (
                    <details className="text-xs">
                      <summary className="cursor-pointer font-extrabold text-[#474E47] hover:text-[#141714]">
                        Original voice note
                      </summary>
                      <p className="mt-1.5 p-2.5 rounded-lg bg-[#F4F1EA] border border-[#CFC8BA] italic font-medium text-[#141714]">
                        &ldquo;{log.raw_transcript}&rdquo;
                      </p>
                    </details>
                  )}

                  {(log.cow || log.transaction) && (
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#EBE6DC]">
                      {log.cow && (
                        <Link
                          href={`/herd/${log.cow.id}`}
                          className="inline-flex items-center gap-1.5 min-h-[36px]"
                        >
                          <EarTagBadge tag={log.cow.tag_number} size="sm" />
                          {log.cow.name && (
                            <span className="text-xs font-extrabold text-[#1B4D2E] underline">
                              {log.cow.name}
                            </span>
                          )}
                        </Link>
                      )}
                      {log.transaction && (
                        <Link
                          href={`/finances?highlight=${log.transaction.id}`}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border-2 font-mono text-xs font-extrabold tabular-nums ${
                            log.transaction.type === 'INCOME'
                              ? 'bg-[#DCFCE7] text-[#14532D] border-[#15803D]'
                              : 'bg-[#FEE2E2] text-[#7F1D1D] border-[#B91C1C]'
                          }`}
                        >
                          {log.transaction.type === 'INCOME' ? '+' : '−'}
                          {formatCurrency(log.transaction.amount)}
                          {log.transaction.vendor_or_buyer
                            ? ` · ${log.transaction.vendor_or_buyer}`
                            : ''}
                        </Link>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <LogFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        herdOptions={herdOptions}
        onSaved={fetchLogs}
      />
    </div>
  );
}
