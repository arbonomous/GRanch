'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  DollarSign,
  Edit3,
  HeartPulse,
  Mic,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import {
  CategoryBadge,
  EarTagBadge,
  HealthTypeBadge,
  LogCategoryBadge,
  StatusBadge,
} from '@/components/Badges';
import { CowFormModal } from '@/components/CowFormModal';
import { HealthFormModal } from '@/components/HealthFormModal';
import { TransactionFormModal } from '@/components/TransactionFormModal';
import {
  daysUntil,
  formatCurrency,
  formatShortDate,
  formatTime,
  startOfDay,
} from '@/lib/dates';

interface CowProfile {
  id: string;
  tag_number: string;
  name: string | null;
  category: string;
  status: string;
  breed: string | null;
  birth_date: string | null;
  breeding_date: string | null;
  expected_due_date: string | null;
  dam_id: string | null;
  sire_id: string | null;
  notes: string;
  dam: { id: string; tag_number: string; name: string | null; category: string } | null;
  sire: { id: string; tag_number: string; name: string | null; category: string } | null;
  calves_as_dam: Array<{
    id: string;
    tag_number: string;
    name: string | null;
    category: string;
    status: string;
    birth_date: string | null;
  }>;
  calves_as_sire: Array<{
    id: string;
    tag_number: string;
    name: string | null;
    category: string;
    status: string;
    birth_date: string | null;
  }>;
  health_records: Array<{
    id: string;
    date: string;
    type: string;
    treatment_name: string;
    dosage: string | null;
    withdrawal_days: number | null;
    safe_to_sell_date: string | null;
    notes: string;
  }>;
  daily_logs: Array<{
    id: string;
    timestamp: string;
    category: string;
    summary: string;
    raw_transcript: string | null;
    transaction: {
      id: string;
      type: string;
      amount: number;
      category: string;
    } | null;
  }>;
}

function AnimalProfileInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const cowId = params.id;

  const [cow, setCow] = useState<CowProfile | null>(null);
  const [herdOptions, setHerdOptions] = useState<
    Array<{ id: string; tag_number: string; name: string | null; category: string; status: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const fetchProfile = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`/api/cows/${cowId}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!active) return;
        if (res.status === 404) {
          setNotFound(true);
          setCow(null);
          return;
        }
        if (res.ok) {
          const json = await res.json();
          if (active) setCow(json.cow);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    fetch('/api/cows?filter=all', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (active && json?.cows) setHerdOptions(json.cows);
      })
      .catch(() => {});

    window.addEventListener('granch:data-changed', fetchProfile);
    return () => {
      active = false;
      window.removeEventListener('granch:data-changed', fetchProfile);
    };
  }, [cowId, refreshTick, fetchProfile]);

  async function handleDeleteCow() {
    if (!cow) return;
    if (!window.confirm(`Delete animal #${cow.tag_number} and its health history?`)) {
      return;
    }
    const res = await fetch(`/api/cows/${cow.id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/herd');
    }
  }

  if (loading) {
    return (
      <div className="field-card p-8 text-center font-bold text-[#474E47]">
        Loading animal profile...
      </div>
    );
  }

  if (notFound || !cow) {
    return (
      <div className="field-card p-8 text-center space-y-4">
        <p className="text-xl font-extrabold text-[#141714]">Animal Not Found</p>
        <Link
          href="/herd"
          className="inline-flex items-center gap-2 min-h-[48px] px-5 rounded-xl bg-[#1B4D2E] text-white font-extrabold"
        >
          <ArrowLeft className="w-5 h-5" /> Back to Herd
        </Link>
      </div>
    );
  }

  const todayStart = startOfDay(new Date());
  const activeWithdrawals = cow.health_records.filter(
    (h) => h.safe_to_sell_date && new Date(h.safe_to_sell_date) > todayStart
  );
  const dueDays = cow.expected_due_date ? daysUntil(cow.expected_due_date) : null;
  const offspring =
    cow.category === 'BULL' ? cow.calves_as_sire : cow.calves_as_dam;

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/herd"
          className="min-h-[48px] px-3.5 inline-flex items-center gap-2 rounded-xl bg-white border-2 border-[#CFC8BA] hover:border-[#141714] font-extrabold text-sm text-[#141714]"
        >
          <ArrowLeft className="w-5 h-5" /> Herd
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            id="quick-edit-btn"
            onClick={() => setEditOpen(true)}
            className="min-h-[48px] px-4 inline-flex items-center gap-2 rounded-xl bg-[#1B4D2E] hover:bg-[#133922] text-white font-extrabold text-sm border-2 border-[#141714] shadow-[0_2px_0_#141714]"
          >
            <Edit3 className="w-4 h-4" /> Quick Edit
          </button>
          <button
            type="button"
            onClick={handleDeleteCow}
            aria-label="Delete animal"
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-white border-2 border-[#CFC8BA] hover:border-[#B91C1C] hover:text-[#B91C1C] text-[#474E47]"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Hero Profile Card */}
      <section className="field-card p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            <EarTagBadge tag={cow.tag_number} size="lg" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#141714]">
                {cow.name || `#${cow.tag_number}`}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <CategoryBadge category={cow.category} />
                <StatusBadge status={cow.status} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t-2 border-[#EBE6DC]">
          <div>
            <span className="block text-[11px] font-extrabold uppercase tracking-wider text-[#474E47]">
              Breed
            </span>
            <span className="block font-bold text-base text-[#141714] mt-0.5">
              {cow.breed || '—'}
            </span>
          </div>
          <div>
            <span className="block text-[11px] font-extrabold uppercase tracking-wider text-[#474E47]">
              Birth Date
            </span>
            <span className="block font-mono font-bold text-base text-[#141714] mt-0.5">
              {formatShortDate(cow.birth_date)}
            </span>
          </div>
          <div>
            <span className="block text-[11px] font-extrabold uppercase tracking-wider text-[#474E47]">
              Breeding Date
            </span>
            <span className="block font-mono font-bold text-base text-[#141714] mt-0.5">
              {formatShortDate(cow.breeding_date)}
            </span>
          </div>
        </div>

        {cow.notes && (
          <p className="p-3.5 rounded-xl bg-[#F4F1EA] border border-[#CFC8BA] text-sm font-semibold text-[#141714] leading-relaxed">
            {cow.notes}
          </p>
        )}

        {/* Quick Field Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => setHealthOpen(true)}
            className="min-h-[52px] px-3 inline-flex items-center justify-center gap-2 rounded-xl bg-[#FEF3C7] hover:bg-[#FDE68A] border-2 border-[#B45309] text-[#78350F] font-extrabold text-sm"
          >
            <HeartPulse className="w-5 h-5" /> + Health / Shot
          </button>
          <button
            type="button"
            disabled={cow.status === 'SOLD'}
            onClick={() => setSaleOpen(true)}
            className="min-h-[52px] px-3 inline-flex items-center justify-center gap-2 rounded-xl bg-[#DCFCE7] hover:bg-[#BBF7D0] disabled:opacity-45 border-2 border-[#15803D] text-[#14532D] font-extrabold text-sm"
          >
            <DollarSign className="w-5 h-5" />{' '}
            {cow.status === 'SOLD' ? 'Already Sold' : 'Record Sale'}
          </button>
        </div>
      </section>

      {/* Expected Due Date Countdown Banner */}
      {cow.expected_due_date && (
        <div className="p-4 rounded-2xl bg-[#FEF3C7] border-2 border-[#B45309] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#B45309] text-white flex items-center justify-center shrink-0">
              <CalendarClock className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-xs font-extrabold uppercase tracking-wider text-[#78350F]">
                Expected Due Date (283-Day Gestation)
              </span>
              <span className="block font-mono text-xl font-extrabold text-[#141714]">
                {formatShortDate(cow.expected_due_date)}
              </span>
            </div>
          </div>
          {dueDays !== null && (
            <span className="px-3.5 py-2 rounded-xl bg-[#141714] text-[#FEF08A] font-mono font-extrabold text-sm whitespace-nowrap">
              {dueDays === 0
                ? 'DUE TODAY'
                : dueDays > 0
                ? `${dueDays}d left`
                : `${Math.abs(dueDays)}d over`}
            </span>
          )}
        </div>
      )}

      {/* Active Withdrawal Warning Banner */}
      {activeWithdrawals.length > 0 && (
        <div className="p-4 rounded-2xl bg-[#FEE2E2] border-2 border-[#B91C1C] space-y-2">
          <div className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-[#7F1D1D]">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            Active Withdrawal — Do Not Sell or Slaughter
          </div>
          {activeWithdrawals.map((w) => (
            <p key={w.id} className="text-sm font-bold text-[#141714]">
              {w.treatment_name} ({w.withdrawal_days}d hold) — Safe to sell on{' '}
              <span className="font-mono underline">
                {formatShortDate(w.safe_to_sell_date)}
              </span>
            </p>
          ))}
        </div>
      )}

      {/* Lineage Section (Dam, Sire & Offspring) */}
      <section className="field-card p-5 space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#141714]">
          <Users className="w-5 h-5 text-[#1B4D2E]" /> Lineage & Offspring
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-[#F4F1EA] border-2 border-[#CFC8BA]">
            <span className="block text-[11px] font-extrabold uppercase tracking-wider text-[#474E47] mb-1.5">
              Dam (Mother)
            </span>
            {cow.dam ? (
              <Link
                href={`/herd/${cow.dam.id}`}
                className="inline-flex items-center gap-2.5 font-extrabold text-base text-[#1B4D2E] hover:underline"
              >
                <EarTagBadge tag={cow.dam.tag_number} size="sm" />
                <span>{cow.dam.name || `Cow #${cow.dam.tag_number}`}</span>
              </Link>
            ) : (
              <span className="text-sm font-bold text-[#474E47]">Not recorded</span>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-[#F4F1EA] border-2 border-[#CFC8BA]">
            <span className="block text-[11px] font-extrabold uppercase tracking-wider text-[#474E47] mb-1.5">
              Sire (Father)
            </span>
            {cow.sire ? (
              <Link
                href={`/herd/${cow.sire.id}`}
                className="inline-flex items-center gap-2.5 font-extrabold text-base text-[#1B4D2E] hover:underline"
              >
                <EarTagBadge tag={cow.sire.tag_number} size="sm" />
                <span>{cow.sire.name || `Bull #${cow.sire.tag_number}`}</span>
              </Link>
            ) : (
              <span className="text-sm font-bold text-[#474E47]">Not recorded</span>
            )}
          </div>
        </div>

        <div>
          <span className="block text-xs font-extrabold uppercase tracking-wider text-[#474E47] mb-2">
            {cow.category === 'BULL' ? 'Sired Offspring' : 'Calves'} ({offspring.length})
          </span>
          {offspring.length === 0 ? (
            <p className="text-sm font-semibold text-[#474E47]">No recorded offspring yet.</p>
          ) : (
            <div className="space-y-2">
              {offspring.map((calf) => (
                <Link
                  key={calf.id}
                  href={`/herd/${calf.id}`}
                  className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[#F4F1EA] border-2 border-[#CFC8BA] hover:border-[#141714] transition"
                >
                  <div className="flex items-center gap-2.5">
                    <EarTagBadge tag={calf.tag_number} size="sm" />
                    <span className="font-extrabold text-sm text-[#141714]">
                      {calf.name || `${calf.category} #${calf.tag_number}`}
                    </span>
                    {calf.birth_date && (
                      <span className="text-xs font-mono font-bold text-[#474E47]">
                        Born {formatShortDate(calf.birth_date)}
                      </span>
                    )}
                  </div>
                  <StatusBadge status={calf.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Medical History Timeline */}
      <section className="field-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#141714]">
            <HeartPulse className="w-5 h-5 text-[#B91C1C]" /> Medical History (
            {cow.health_records.length})
          </h2>
          <button
            type="button"
            onClick={() => setHealthOpen(true)}
            className="min-h-[42px] px-3 inline-flex items-center gap-1 rounded-xl bg-[#EBE6DC] hover:bg-[#DFD9CC] border-2 border-[#141714] text-xs font-extrabold text-[#141714]"
          >
            <Plus className="w-4 h-4" /> Add Record
          </button>
        </div>

        {cow.health_records.length === 0 ? (
          <p className="text-sm font-semibold text-[#474E47]">
            No vaccinations, treatments, or injuries recorded.
          </p>
        ) : (
          <div className="space-y-3">
            {cow.health_records.map((rec) => {
              const isHolding =
                rec.safe_to_sell_date && new Date(rec.safe_to_sell_date) > todayStart;
              return (
                <div
                  key={rec.id}
                  className="p-4 rounded-xl bg-[#F4F1EA] border-2 border-[#CFC8BA] space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <HealthTypeBadge type={rec.type} />
                      <span className="font-extrabold text-base text-[#141714]">
                        {rec.treatment_name}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold text-[#474E47]">
                      {formatShortDate(rec.date)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs font-bold text-[#474E47]">
                    {rec.dosage && (
                      <span className="px-2 py-0.5 rounded bg-white border border-[#CFC8BA] text-[#141714]">
                        Dosage: {rec.dosage}
                      </span>
                    )}
                    {rec.safe_to_sell_date && (
                      <span
                        className={`px-2 py-0.5 rounded border font-mono ${
                          isHolding
                            ? 'bg-[#FEE2E2] border-[#B91C1C] text-[#7F1D1D]'
                            : 'bg-[#DCFCE7] border-[#15803D] text-[#14532D]'
                        }`}
                      >
                        {isHolding ? 'HOLD' : 'Cleared'} — Safe{' '}
                        {formatShortDate(rec.safe_to_sell_date)} ({rec.withdrawal_days}d)
                      </span>
                    )}
                  </div>

                  {rec.notes && (
                    <p className="text-sm font-medium text-[#141714]">{rec.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Associated Daily Logs */}
      <section className="field-card p-5 space-y-4">
        <h2 className="text-lg font-extrabold text-[#141714]">
          Associated Activity Logs ({cow.daily_logs.length})
        </h2>

        {cow.daily_logs.length === 0 ? (
          <p className="text-sm font-semibold text-[#474E47]">
            No daily logs linked to #{cow.tag_number} yet.
          </p>
        ) : (
          <div className="space-y-3">
            {cow.daily_logs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 rounded-xl bg-[#F4F1EA] border-2 border-[#CFC8BA] space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <LogCategoryBadge category={log.category} />
                    {log.raw_transcript && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#141714] text-[#FEF08A] text-[11px] font-extrabold">
                        <Mic className="w-3 h-3" /> Voice
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-xs font-bold text-[#474E47]">
                    {formatShortDate(log.timestamp)} · {formatTime(log.timestamp)}
                  </span>
                </div>
                <p className="text-sm font-semibold text-[#141714]">{log.summary}</p>
                {log.transaction && (
                  <Link
                    href={`/finances?highlight=${log.transaction.id}`}
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-md border font-mono text-xs font-extrabold ${
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
            ))}
          </div>
        )}
      </section>

      <CowFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initialCow={cow}
        herdOptions={herdOptions}
        onSaved={fetchProfile}
      />

      <HealthFormModal
        open={healthOpen}
        onClose={() => setHealthOpen(false)}
        cowId={cow.id}
        cowTag={cow.tag_number}
        onSaved={fetchProfile}
      />

      <TransactionFormModal
        open={saleOpen}
        onClose={() => setSaleOpen(false)}
        herdOptions={herdOptions}
        defaultCowId={cow.id}
        defaultType="INCOME"
        defaultCategory="CATTLE_SALE"
        onSaved={fetchProfile}
      />
    </div>
  );
}

export default function AnimalProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="field-card p-8 text-center font-bold text-[#474E47]">
          Loading animal profile...
        </div>
      }
    >
      <AnimalProfileInner />
    </Suspense>
  );
}
