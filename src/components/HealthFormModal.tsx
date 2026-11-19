'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, ShieldPlus } from 'lucide-react';
import { ModalSheet } from './Badges';
import { HEALTH_TYPES, HEALTH_TYPE_LABELS } from '@/lib/constants';
import {
  calculateSafeToSellDate,
  formatDateInputValue,
  formatShortDate,
  parseDateInput,
} from '@/lib/dates';

function HealthFormInner({
  onClose,
  cowId,
  cowTag,
  onSaved,
}: {
  onClose: () => void;
  cowId: string;
  cowTag: string;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(() => formatDateInputValue(new Date()));
  const [type, setType] = useState('MEDICATION');
  const [treatmentName, setTreatmentName] = useState('');
  const [dosage, setDosage] = useState('');
  const [withdrawalDays, setWithdrawalDays] = useState('');
  const [notes, setNotes] = useState('');
  const [markSick, setMarkSick] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const safeDatePreview = useMemo(() => {
    const days = Number(withdrawalDays);
    if (!days || Number.isNaN(days) || days <= 0) return null;
    const base = parseDateInput(date) ?? new Date();
    return calculateSafeToSellDate(base, days);
  }, [date, withdrawalDays]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cow_id: cowId,
          date,
          type,
          treatment_name: treatmentName.trim(),
          dosage: dosage.trim() || null,
          withdrawal_days: withdrawalDays ? Number(withdrawalDays) : null,
          notes: notes.trim(),
          mark_sick: markSick,
          create_log: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not save health record.');
        return;
      }

      onSaved();
      onClose();
    } catch {
      setError('Network error saving health record.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3.5 rounded-xl bg-[#FEE2E2] border-2 border-[#B91C1C] text-[#7F1D1D] font-bold text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="health-type" className="field-label">
            Record Type
          </label>
          <select
            id="health-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="field-input"
          >
            {HEALTH_TYPES.map((t) => (
              <option key={t} value={t}>
                {HEALTH_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="health-date" className="field-label">
            Date
          </label>
          <input
            id="health-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="field-input font-mono"
          />
        </div>
      </div>

      <div>
        <label htmlFor="health-treatment" className="field-label">
          Treatment / Vaccine Name *
        </label>
        <input
          id="health-treatment"
          required
          value={treatmentName}
          onChange={(e) => setTreatmentName(e.target.value)}
          placeholder="e.g. Draxxin, Penicillin, 7-Way Blackleg"
          className="field-input"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="health-dosage" className="field-label">
            Dosage
          </label>
          <input
            id="health-dosage"
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            placeholder="e.g. 10 ml SubQ"
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="health-withdrawal" className="field-label">
            Withdrawal Days
          </label>
          <input
            id="health-withdrawal"
            type="number"
            min={0}
            max={365}
            value={withdrawalDays}
            onChange={(e) => setWithdrawalDays(e.target.value)}
            placeholder="e.g. 18"
            className="field-input font-mono"
          />
        </div>
      </div>

      {safeDatePreview && (
        <div className="p-3.5 rounded-xl bg-[#FEF3C7] border-2 border-[#B45309] text-[#78350F] flex items-center gap-2.5 text-sm font-extrabold">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>Safe to Sell Date: {formatShortDate(safeDatePreview)}</span>
        </div>
      )}

      <label className="flex items-center gap-3 p-3.5 rounded-xl bg-white border-2 border-[#CFC8BA] cursor-pointer min-h-[54px]">
        <input
          type="checkbox"
          checked={markSick}
          onChange={(e) => setMarkSick(e.target.checked)}
          className="w-6 h-6 accent-[#B91C1C]"
        />
        <span className="font-bold text-sm text-[#141714]">
          Set animal #{cowTag} status to <strong className="text-[#B91C1C]">SICK</strong>
        </span>
      </label>

      <div>
        <label htmlFor="health-notes" className="field-label">
          Notes
        </label>
        <textarea
          id="health-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Symptoms, temperature, follow-up plan..."
          className="field-input resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full min-h-[54px] flex items-center justify-center gap-2 rounded-xl bg-[#1B4D2E] hover:bg-[#133922] disabled:opacity-50 text-white font-extrabold text-base border-2 border-[#141714] shadow-[0_2px_0_#141714] active:translate-y-0.5 transition"
      >
        <ShieldPlus className="w-5 h-5" />
        {submitting ? 'Saving...' : 'Save Health Record'}
      </button>
    </form>
  );
}

export function HealthFormModal({
  open,
  onClose,
  cowId,
  cowTag,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  cowId: string;
  cowTag: string;
  onSaved: () => void;
}) {
  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={`Log Health Record — #${cowTag}`}
      subtitle="Automatically calculates withdrawal clear date & adds a Daily Log"
    >
      {open && (
        <HealthFormInner
          onClose={onClose}
          cowId={cowId}
          cowTag={cowTag}
          onSaved={onSaved}
        />
      )}
    </ModalSheet>
  );
}
