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
  { key: 'cows', label: 'Cows' },
  { key: 'bulls', label: 'Bulls' },
  { key: 'calves', label: 'Calves' },
  { key: 'pregnant', label: 'Pregnant' },
  { key: 'due_soon', label: 'Due ≤30d' },
  { key: 'sick', label: 'Sick' },
  { key: 'sick_or_withdrawal', label: 'Health Flags' },
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
      {/* Header + Add Animal */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#141714]">
            Herd Inventory
          </h1>
          <p className="text-sm font-bold text-[#474E47] tabular-nums">
            {loading ? 'Loading...' : `${cows.length} ${cows.length === 1 ? 'animal' : 'animals'} shown`}
          </p>
        </div>

        <button
          type="button"
          id="add-animal-btn"
          onClick={() => setAddModalOpen(true)}
          className="min-h-[50px] px-4 inline-flex items-center gap-2 rounded-xl bg-[#1B4D2E] hover:bg-[#133922] text-white font-extrabold text-sm sm:text-base border-2 border-[#141714] shadow-[0_2px_0_#141714] active:translate-y-0.5 transition shrink-0"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span>Add Animal</span>
        </button>
      </div>

      {/* Instant Tag Search Bar */}
      <div className="relative">
        <Search className="w-5 h-5 text-[#474E47] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          id="herd-search-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by Ear Tag # (e.g. 214, Yellow-12) or name..."
          className="field-input pl-12! pr-12! bg-white!"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#474E47] hover:text-[#141714]"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Scrollable High-Contrast Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4">
        {FILTER_PILLS.map((pill) => {
          const active = filter === pill.key;
          return (
            <button
              key={pill.key}
              type="button"
              onClick={() => handleSelectFilter(pill.key)}
              className={`min-h-[44px] px-4 rounded-xl font-extrabold text-sm whitespace-nowrap border-2 transition shrink-0 ${
                active
                  ? 'bg-[#141714] text-white border-[#141714]'
                  : 'bg-white text-[#141714] border-[#CFC8BA] hover:border-[#141714]'
              }`}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {/* Animal List */}
      <div className="space-y-3">
        {!loading && cows.length === 0 && (
          <div className="field-card p-8 text-center space-y-2">
            <p className="text-lg font-extrabold text-[#141714]">No matching animals</p>
            <p className="text-sm font-medium text-[#474E47]">
              Try clearing your search or switching filter pills.
            </p>
          </div>
        )}

        {cows.map((cow) => {
          const dueDays = cow.expected_due_date ? daysUntil(cow.expected_due_date) : null;
          return (
            <Link
              key={cow.id}
              href={`/herd/${cow.id}`}
              className="field-card-interactive block p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <EarTagBadge tag={cow.tag_number} size="md" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-lg text-[#141714] truncate">
                        {cow.name || `${cow.category.charAt(0) + cow.category.slice(1).toLowerCase()} #${cow.tag_number}`}
                      </span>
                      <CategoryBadge category={cow.category} />
                    </div>
                    <p className="text-sm font-semibold text-[#474E47] truncate mt-0.5">
                      {cow.breed || 'Breed unspecified'}
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
                  <ChevronRight className="w-5 h-5 text-[#474E47]" />
                </div>
              </div>

              {/* Contextual Field Alerts (Due Date / Withdrawal Hold) */}
              {(cow.expected_due_date || cow.active_withdrawal) && (
                <div className="mt-3 pt-3 border-t border-[#EBE6DC] flex flex-wrap gap-2">
                  {cow.expected_due_date && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FEF3C7] border border-[#B45309] text-[#78350F] text-xs font-extrabold font-mono">
                      <CalendarClock className="w-3.5 h-3.5" />
                      Due {formatShortDate(cow.expected_due_date)}
                      {dueDays !== null
                        ? dueDays >= 0
                          ? ` (${dueDays}d)`
                          : ` (${Math.abs(dueDays)}d overdue)`
                        : ''}
                    </span>
                  )}
                  {cow.active_withdrawal && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FEE2E2] border border-[#B91C1C] text-[#7F1D1D] text-xs font-extrabold font-mono">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      HOLD: {cow.active_withdrawal.treatment_name} until{' '}
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
        <div className="field-card p-6 text-center font-bold text-[#474E47]">
          Loading herd...
        </div>
      }
    >
      <HerdContent />
    </Suspense>
  );
}
