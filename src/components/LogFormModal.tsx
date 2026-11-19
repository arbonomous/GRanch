'use client';

import React, { useState } from 'react';
import { ClipboardPlus } from 'lucide-react';
import { ModalSheet } from './Badges';
import { LOG_CATEGORIES, LOG_CATEGORY_LABELS } from '@/lib/constants';

interface CowOption {
  id: string;
  tag_number: string;
  name: string | null;
}

function LogFormInner({
  onClose,
  herdOptions,
  onSaved,
}: {
  onClose: () => void;
  herdOptions: CowOption[];
  onSaved: () => void;
}) {
  const [category, setCategory] = useState('GENERAL');
  const [summary, setSummary] = useState('');
  const [cowId, setCowId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          summary: summary.trim(),
          cow_id: cowId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not save activity log.');
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError('Network error saving activity log.');
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

      <div>
        <label htmlFor="log-category" className="field-label">
          Activity Category
        </label>
        <select
          id="log-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="field-input"
        >
          {LOG_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {LOG_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="log-summary" className="field-label">
          What was done? *
        </label>
        <textarea
          id="log-summary"
          required
          rows={3}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="e.g. Fixed south pasture gate latch and checked water trough float."
          className="field-input resize-none"
        />
      </div>

      <div>
        <label htmlFor="log-cow" className="field-label">
          Link Animal (Optional)
        </label>
        <select
          id="log-cow"
          value={cowId}
          onChange={(e) => setCowId(e.target.value)}
          className="field-input"
        >
          <option value="">No specific animal</option>
          {herdOptions.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.tag_number} {c.name ? `(${c.name})` : ''}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full min-h-[50px] flex items-center justify-center gap-2 rounded-lg bg-[#173324] hover:bg-[#0F2419] disabled:opacity-50 text-white font-semibold text-sm transition"
      >
        <ClipboardPlus className="w-4 h-4" />
        {submitting ? 'Logging...' : 'Save Activity Log'}
      </button>
    </form>
  );
}

export function LogFormModal({
  open,
  onClose,
  herdOptions,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  herdOptions: CowOption[];
  onSaved: () => void;
}) {
  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title="Log Ranch Activity"
      subtitle="Add a manual note to the chronological ranch feed"
    >
      {open && (
        <LogFormInner
          onClose={onClose}
          herdOptions={herdOptions}
          onSaved={onSaved}
        />
      )}
    </ModalSheet>
  );
}
