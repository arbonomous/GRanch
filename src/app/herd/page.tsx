'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { CategoryBadge, EarTagBadge, StatusBadge } from '@/components/Badges';
import { CowFormModal } from '@/components/CowFormModal';
import { daysUntil, formatShortDate } from '@/lib/dates';

interface CowRow {
  id: string;
  tag_number: string;
  name: string | null;
  category: string;
  status: string;
  breed: string | null;
  expected_due_date: string | null;
  active_withdrawal: {
    id: string;
    treatment_name: string;
    safe_to_sell_date: string;
  } | null;
  _count: {
    calves_as_dam: number;
    health_records: number;
  };
}

const FILTER_PILLS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'cows', label: 'Cows' },
  { key: 'bulls', label: 'Bulls' },
  { key: 'calves', label: 'Calves' },
  { key: 'pregnant', label: 'Pregnant' },
  { key: 'due_soon', label: 'Due ≤30d' },
  { key: 'sick', label: 'Sick' },
  { key: 'sick_or_withdrawal', label: 'Flags' },
  { key: 'sold', label: 'Sold' },
];

function HerdContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const filter = searchParams.get('filter')?.toLowerCase() || 'all';
  const [query, setQuery] = useState('');
  const [cows, setCows] = useState<CowRow[]>([]);
  const [allHerdOptions, setAllHerdOptions] = useState<
    Array<{ id: string; tag_number: string; name: string | null; category: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (filter) params.set('filter', filter);
    if (query.trim()) params.set('q', query.trim());

    fetch(`/api/cows?${params.toString()}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!active) return;
        if (json?.cows) setCows(json.cows);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filter, query, refreshTick]);

  useEffect(() => {
    let active = true;
    fetch('/api/cows?filter=all', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (active && json?.cows) setAllHerdOptions(json.cows);
      })
      .catch(() => {});

    window.addEventListener('granch:data-changed', triggerRefresh);
    return () => {
      active = false;
      window.removeEventListener('granch:data-changed', triggerRefresh);
    };
  }, [refreshTick, triggerRefresh]);

  function handleSelectFilter(nextFilter: string) {
    setLoading(true);
    const params = new URLSearchParams(searchParams.toString());
    if (nextFilter === 'all') params.delete('filter');
    else params.set('filter', nextFilter);
    const qs = params.toString();
    router.replace(qs ? `/herd?${qs}` : '/herd', { scroll: false });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[#767C77] tabular-nums">
            {loading ? 'Loading inventory' : `${cows.length} ${cows.length === 1 ? 'head' : 'head'} shown`}
          </p>
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-[-0.025em] text-[#111312] mt-0.5">
            Herd Registry
          </h1>
        </div>

        <button
          type="button"
          id="add-animal-btn"
          onClick={() => setAddModalOpen(true)}
          className="min-h-[44px] px-4 inline-flex items-center gap-1.5 rounded-lg bg-[#173324] hover:bg-[#0F2419] text-white font-semibold text-sm transition shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.25]" />
          <span>Add Animal</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-[#767C77] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          id="herd-search-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ear tag (#214, Yellow-12), name, or breed..."
          className="field-input pl-10! pr-10! bg-white!"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md text-[#767C77] hover:text-[#111312]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 -mx-4 px-4">
        {FILTER_PILLS.map((pill) => {
          const active = filter === pill.key;
          return (
            <button
              key={pill.key}
              type="button"
              onClick={() => handleSelectFilter(pill.key)}
              className={`min-h-[38px] px-3.5 rounded-lg font-semibold text-xs whitespace-nowrap border transition shrink-0 ${
                active
                  ? 'bg-[#111312] text-[#F5F4F0] border-[#111312]'
                  : 'bg-white text-[#525753] border-[#E2E0D9] hover:border-[#C9C6BC] hover:text-[#111312]'
              }`}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {/* Unified Animal Registry List */}
      <div className="field-card divide-y divide-[#ECEAE4] overflow-hidden">
        {!loading && cows.length === 0 && (
          <div className="p-8 text-center space-y-1">
            <p className="text-base font-semibold text-[#111312]">No matching animals</p>
            <p className="text-xs text-[#767C77]">
              Adjust your search query or filter selection.
            </p>
          </div>
        )}

        {cows.map((cow) => {
          const dueDays = cow.expected_due_date ? daysUntil(cow.expected_due_date) : null;
          return (
            <Link
              key={cow.id}
              href={`/herd/${cow.id}`}
              className="block px-4 py-3.5 bg-white hover:bg-[#FAFAF8] transition"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <EarTagBadge tag={cow.tag_number} size="md" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[15px] text-[#111312] truncate">
                        {cow.name || `#${cow.tag_number}`}
                      </span>
                      <CategoryBadge category={cow.category} />
                    </div>
                    <p className="text-xs text-[#767C77] truncate mt-0.5">
                      {cow.breed || 'Unspecified breed'}
                      {cow._count.calves_as_dam > 0
                        ? ` · ${cow._count.calves_as_dam} ${
                            cow._count.calves_as_dam === 1 ? 'calf' : 'calves'
                          }`
                        : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={cow.status} />
                  <ChevronRight className="w-4 h-4 text-[#A0A4A0]" />
                </div>
              </div>

              {(cow.expected_due_date || cow.active_withdrawal) && (
                <div className="mt-2.5 pl-[72px] flex flex-wrap gap-2">
                  {cow.expected_due_date && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-[#92400E]">
                      <CalendarClock className="w-3 h-3" />
                      Due {formatShortDate(cow.expected_due_date)}
                      {dueDays !== null
                        ? dueDays >= 0
                          ? ` (${dueDays}d)`
                          : ` (${Math.abs(dueDays)}d over)`
                        : ''}
                    </span>
                  )}
                  {cow.active_withdrawal && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-[#B42318]">
                      <AlertTriangle className="w-3 h-3" />
                      Hold: {cow.active_withdrawal.treatment_name} until{' '}
                      {formatShortDate(cow.active_withdrawal.safe_to_sell_date)}
                    </span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </div>

      <CowFormModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        herdOptions={allHerdOptions}
        onSaved={triggerRefresh}
      />
    </div>
  );
}

export default function HerdPage() {
  return (
    <Suspense
      fallback={
        <div className="field-card p-6 text-center text-sm font-medium text-[#767C77]">
          Loading herd...
        </div>
      }
    >
      <HerdContent />
    </Suspense>
  );
}
