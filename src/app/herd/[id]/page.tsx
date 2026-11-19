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
      <div className="field-card p-8 text-center text-sm font-medium text-[#767C77]">
        Loading animal profile...
      </div>
    );
  }

  if (notFound || !cow) {
    return (
      <div className="field-card p-8 text-center space-y-4">
        <p className="text-lg font-bold text-[#111312]">Animal Not Found</p>
        <Link
          href="/herd"
          className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg bg-[#173324] text-white font-semibold text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Herd
        </Link>
      </div>
    );
  }

  const todayStart = startOfDay(new Date());
  const activeWithdrawals = cow.health_records.filter(
    (h) => h.safe_to_sell_date && new Date(h.safe_to_sell_date) > todayStart
  );
  const dueDays = cow.expected_due_date ? daysUntil(cow.expected_due_date) : null;
  const offspring = cow.category === 'BULL' ? cow.calves_as_sire : cow.calves_as_dam;

  return (
    <div className="space-y-5">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/herd"
          className="min-h-[42px] px-3.5 inline-flex items-center gap-1.5 rounded-lg bg-white border border-[#E2E0D9] hover:border-[#C9C6BC] font-semibold text-xs text-[#111312] transition"
        >
          <ArrowLeft className="w-4 h-4" /> Herd
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            id="quick-edit-btn"
            onClick={() => setEditOpen(true)}
            className="min-h-[42px] px-3.5 inline-flex items-center gap-1.5 rounded-lg bg-[#173324] hover:bg-[#0F2419] text-white font-semibold text-xs transition"
          >
            <Edit3 className="w-3.5 h-3.5" /> Quick Edit
          </button>
          <button
            type="button"
            onClick={handleDeleteCow}
            aria-label="Delete animal"
            className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-lg bg-white border border-[#E2E0D9] hover:border-[#B42318] hover:text-[#B42318] text-[#767C77] transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Profile Card */}
      <section className="field-card overflow-hidden">
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <EarTagBadge tag={cow.tag_number} size="lg" />
              <div>
                <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#111312]">
                  {cow.name || `#${cow.tag_number}`}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <CategoryBadge category={cow.category} />
                  <StatusBadge status={cow.status} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[#ECEAE4]">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#767C77]">
                Breed
              </span>
              <span className="block font-semibold text-sm text-[#111312] mt-0.5">
                {cow.breed || '—'}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#767C77]">
                Birth Date
              </span>
              <span className="block font-mono font-medium text-sm text-[#111312] mt-0.5">
                {formatShortDate(cow.birth_date)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#767C77]">
                Breeding Date
              </span>
              <span className="block font-mono font-medium text-sm text-[#111312] mt-0.5">
                {formatShortDate(cow.breeding_date)}
              </span>
            </div>
          </div>

          {cow.notes && (
            <p className="p-3 rounded-lg bg-[#F5F4F0] border border-[#E2E0D9] text-sm text-[#353936] leading-relaxed">
              {cow.notes}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 divide-x divide-[#ECEAE4] border-t border-[#ECEAE4] bg-[#FAFAF8]">
          <button
            type="button"
            onClick={() => setHealthOpen(true)}
            className="min-h-[48px] px-3 inline-flex items-center justify-center gap-2 hover:bg-[#EFEDE8] text-[#111312] font-semibold text-xs transition"
          >
            <HeartPulse className="w-4 h-4 text-[#B45309]" /> Log Treatment
          </button>
          <button
            type="button"
            disabled={cow.status === 'SOLD'}
            onClick={() => setSaleOpen(true)}
            className="min-h-[48px] px-3 inline-flex items-center justify-center gap-2 hover:bg-[#EFEDE8] disabled:opacity-40 text-[#111312] font-semibold text-xs transition"
          >
            <DollarSign className="w-4 h-4 text-[#157347]" />{' '}
            {cow.status === 'SOLD' ? 'Sold' : 'Record Sale'}
          </button>
        </div>
      </section>

      {/* Due Date Countdown */}
      {cow.expected_due_date && (
        <div className="field-card px-4 py-3.5 border-l-[3px]! border-l-[#B45309]! flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CalendarClock className="w-5 h-5 text-[#B45309] shrink-0" />
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-[0.07em] text-[#92400E]">
                Expected Due Date (283-Day Gestation)
              </span>
              <span className="block font-mono text-base font-semibold text-[#111312]">
                {formatShortDate(cow.expected_due_date)}
              </span>
            </div>
          </div>
          {dueDays !== null && (
            <span className="px-2.5 py-1 rounded-md bg-[#111312] text-[#F5F4F0] font-mono font-semibold text-xs whitespace-nowrap">
              {dueDays === 0
                ? 'DUE TODAY'
                : dueDays > 0
                ? `${dueDays}d left`
                : `${Math.abs(dueDays)}d over`}
            </span>
          )}
        </div>
      )}

      {/* Active Withdrawal Hold */}
      {activeWithdrawals.length > 0 && (
        <div className="field-card px-4 py-3.5 border-l-[3px]! border-l-[#B42318]! space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.07em] text-[#B42318]">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Active Withdrawal — Do Not Sell
          </div>
          {activeWithdrawals.map((w) => (
            <p key={w.id} className="text-sm text-[#111312]">
              <span className="font-semibold">{w.treatment_name}</span> ({w.withdrawal_days}d hold) — Safe on{' '}
              <span className="font-mono font-semibold text-[#B42318]">
                {formatShortDate(w.safe_to_sell_date)}
              </span>
            </p>
          ))}
        </div>
      )}

      {/* Lineage */}
      <section className="field-card overflow-hidden">
        <div className="px-4 py-3 border-b border-[#ECEAE4]">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.09em] text-[#767C77]">
            Lineage &amp; Offspring
          </h2>
        </div>

        <div className="grid grid-cols-2 divide-x divide-[#ECEAE4] border-b border-[#ECEAE4]">
          <div className="p-4">
            <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#767C77] mb-1.5">
              Dam (Mother)
            </span>
            {cow.dam ? (
              <Link
                href={`/herd/${cow.dam.id}`}
                className="inline-flex items-center gap-2 font-semibold text-sm text-[#173324] hover:underline"
              >
                <EarTagBadge tag={cow.dam.tag_number} size="sm" />
                <span>{cow.dam.name || `Cow #${cow.dam.tag_number}`}</span>
              </Link>
            ) : (
              <span className="text-xs text-[#767C77]">Not recorded</span>
            )}
          </div>

          <div className="p-4">
            <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#767C77] mb-1.5">
              Sire (Father)
            </span>
            {cow.sire ? (
              <Link
                href={`/herd/${cow.sire.id}`}
                className="inline-flex items-center gap-2 font-semibold text-sm text-[#173324] hover:underline"
              >
                <EarTagBadge tag={cow.sire.tag_number} size="sm" />
                <span>{cow.sire.name || `Bull #${cow.sire.tag_number}`}</span>
              </Link>
            ) : (
              <span className="text-xs text-[#767C77]">Not recorded</span>
            )}
          </div>
        </div>

        <div className="divide-y divide-[#ECEAE4]">
          <div className="px-4 py-2.5 bg-[#FAFAF8] text-[10px] font-bold uppercase tracking-[0.08em] text-[#767C77]">
            {cow.category === 'BULL' ? 'Sired Offspring' : 'Calves'} ({offspring.length})
          </div>
          {offspring.length === 0 ? (
            <p className="p-4 text-xs text-[#767C77]">No recorded offspring yet.</p>
          ) : (
            offspring.map((calf) => (
              <Link
                key={calf.id}
                href={`/herd/${calf.id}`}
                className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-[#FAFAF8] transition"
              >
                <div className="flex items-center gap-2.5">
                  <EarTagBadge tag={calf.tag_number} size="sm" />
                  <span className="font-semibold text-sm text-[#111312]">
                    {calf.name || `${calf.category} #${calf.tag_number}`}
                  </span>
                  {calf.birth_date && (
                    <span className="text-xs font-mono text-[#767C77]">
                      {formatShortDate(calf.birth_date)}
                    </span>
                  )}
                </div>
                <StatusBadge status={calf.status} />
              </Link>
            ))
          )}
        </div>
      </section>

      {/* Medical History */}
      <section className="field-card overflow-hidden">
        <div className="px-4 py-3 border-b border-[#ECEAE4] flex items-center justify-between gap-2">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.09em] text-[#767C77]">
            Medical History ({cow.health_records.length})
          </h2>
          <button
            type="button"
            onClick={() => setHealthOpen(true)}
            className="min-h-[32px] px-2.5 inline-flex items-center gap-1 rounded-md bg-[#F5F4F0] hover:bg-[#EFEDE8] border border-[#E2E0D9] text-xs font-semibold text-[#111312]"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>

        <div className="divide-y divide-[#ECEAE4]">
          {cow.health_records.length === 0 ? (
            <p className="p-4 text-xs text-[#767C77]">
              No vaccinations, treatments, or injuries recorded.
            </p>
          ) : (
            cow.health_records.map((rec) => {
              const isHolding =
                rec.safe_to_sell_date && new Date(rec.safe_to_sell_date) > todayStart;
              return (
                <div key={rec.id} className="p-4 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <HealthTypeBadge type={rec.type} />
                      <span className="font-semibold text-sm text-[#111312]">
                        {rec.treatment_name}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-[#767C77]">
                      {formatShortDate(rec.date)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs font-mono text-[#525753]">
                    {rec.dosage && <span>Dose: {rec.dosage}</span>}
                    {rec.safe_to_sell_date && (
                      <span className={isHolding ? 'text-[#B42318] font-semibold' : 'text-[#157347]'}>
                        {isHolding ? 'HOLD' : 'Cleared'} · Safe {formatShortDate(rec.safe_to_sell_date)} ({rec.withdrawal_days}d)
                      </span>
                    )}
                  </div>

                  {rec.notes && <p className="text-xs text-[#525753]">{rec.notes}</p>}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Associated Activity Logs */}
      <section className="field-card overflow-hidden">
        <div className="px-4 py-3 border-b border-[#ECEAE4]">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.09em] text-[#767C77]">
            Associated Logs ({cow.daily_logs.length})
          </h2>
        </div>

        <div className="divide-y divide-[#ECEAE4]">
          {cow.daily_logs.length === 0 ? (
            <p className="p-4 text-xs text-[#767C77]">
              No daily logs linked to #{cow.tag_number} yet.
            </p>
          ) : (
            cow.daily_logs.map((log) => (
              <div key={log.id} className="p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <LogCategoryBadge category={log.category} />
                    {log.raw_transcript && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#111312] text-[#F5F4F0] text-[10px] font-semibold uppercase">
                        <Mic className="w-2.5 h-2.5" /> AI Voice
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[11px] text-[#767C77]">
                    {formatShortDate(log.timestamp)} · {formatTime(log.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-[#111312]">{log.summary}</p>
                {log.transaction && (
                  <Link
                    href={`/finances?highlight=${log.transaction.id}`}
                    className={`inline-flex items-center px-2 py-0.5 rounded border border-[#E2E0D9] bg-[#FAFAF8] font-mono text-xs font-semibold ${
                      log.transaction.type === 'INCOME' ? 'text-[#157347]' : 'text-[#B42318]'
                    }`}
                  >
                    {log.transaction.type === 'INCOME' ? '+' : '−'}
                    {formatCurrency(log.transaction.amount)}
                  </Link>
                )}
              </div>
            ))
          )}
        </div>
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
        <div className="field-card p-8 text-center text-sm font-medium text-[#767C77]">
          Loading animal profile...
        </div>
      }
    >
      <AnimalProfileInner />
    </Suspense>
  );
}
