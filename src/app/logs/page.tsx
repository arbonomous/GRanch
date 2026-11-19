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
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[#767C77]">
            Field Activity Feed
          </p>
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-[-0.025em] text-[#111312] mt-0.5">
            Daily Log
          </h1>
        </div>

        <button
          type="button"
          id="add-log-btn"
          onClick={() => setAddOpen(true)}
          className="min-h-[44px] px-4 inline-flex items-center gap-1.5 rounded-lg bg-[#173324] hover:bg-[#0F2419] text-white font-semibold text-sm transition shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.25]" />
          <span>Log Activity</span>
        </button>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 -mx-4 px-4">
        <button
          type="button"
          onClick={() => setCategory('ALL')}
          className={`min-h-[38px] px-3.5 rounded-lg font-semibold text-xs whitespace-nowrap border transition shrink-0 ${
            category === 'ALL'
              ? 'bg-[#111312] text-[#F5F4F0] border-[#111312]'
              : 'bg-white text-[#525753] border-[#E2E0D9] hover:border-[#C9C6BC] hover:text-[#111312]'
          }`}
        >
          All
        </button>
        {LOG_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`min-h-[38px] px-3.5 rounded-lg font-semibold text-xs whitespace-nowrap border transition shrink-0 ${
              category === cat
                ? 'bg-[#111312] text-[#F5F4F0] border-[#111312]'
                : 'bg-white text-[#525753] border-[#E2E0D9] hover:border-[#C9C6BC] hover:text-[#111312]'
            }`}
          >
            {LOG_CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {loading && (
        <div className="field-card p-6 text-center text-sm font-medium text-[#767C77]">
          Loading ranch logs...
        </div>
      )}

      {!loading && groupedLogs.length === 0 && (
        <div className="field-card p-8 text-center space-y-1">
          <p className="text-base font-semibold text-[#111312]">No entries in this category</p>
          <p className="text-xs text-[#767C77]">
            Log via Instinct AI or add a manual activity entry.
          </p>
        </div>
      )}

      <div className="space-y-5">
        {groupedLogs.map((group) => (
          <section key={group.heading} className="space-y-2">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.09em] text-[#767C77] px-0.5">
              {group.heading}
            </h2>

            <div className="field-card divide-y divide-[#ECEAE4] overflow-hidden">
              {group.items.map((log) => (
                <article key={log.id} className="p-4 space-y-2.5 bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <LogCategoryBadge category={log.category} />
                      {log.raw_transcript && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#111312] text-[#F5F4F0] text-[10px] font-semibold uppercase tracking-wider">
                          <Mic className="w-2.5 h-2.5" /> AI Voice
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[11px] text-[#767C77]">
                      {formatTime(log.timestamp)}
                    </span>
                  </div>

                  <p className="text-sm sm:text-[15px] font-medium leading-snug text-[#111312]">
                    {log.summary}
                  </p>

                  {log.raw_transcript && (
                    <details className="text-xs">
                      <summary className="cursor-pointer font-semibold text-[#767C77] hover:text-[#111312]">
                        Voice transcript
                      </summary>
                      <p className="mt-1.5 p-2.5 rounded-lg bg-[#F5F4F0] border border-[#E2E0D9] text-[#353936] italic">
                        &ldquo;{log.raw_transcript}&rdquo;
                      </p>
                    </details>
                  )}

                  {(log.cow || log.transaction) && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {log.cow && (
                        <Link
                          href={`/herd/${log.cow.id}`}
                          className="inline-flex items-center gap-1.5"
                        >
                          <EarTagBadge tag={log.cow.tag_number} size="sm" />
                          {log.cow.name && (
                            <span className="text-xs font-semibold text-[#173324] hover:underline">
                              {log.cow.name}
                            </span>
                          )}
                        </Link>
                      )}
                      {log.transaction && (
                        <Link
                          href={`/finances?highlight=${log.transaction.id}`}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded border border-[#E2E0D9] bg-[#FAFAF8] font-mono text-xs font-semibold tabular-nums ${
                            log.transaction.type === 'INCOME'
                              ? 'text-[#157347]'
                              : 'text-[#B42318]'
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
