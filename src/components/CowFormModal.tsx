'use client';

import React, { useMemo, useState } from 'react';
import { Calendar, Save } from 'lucide-react';
import { ModalSheet } from './Badges';
import {
  COW_CATEGORIES,
  COW_CATEGORY_LABELS,
  COW_STATUSES,
  COW_STATUS_LABELS,
} from '@/lib/constants';
import {
  calculateExpectedDueDate,
  formatDateInputValue,
  formatShortDate,
  parseDateInput,
} from '@/lib/dates';

export interface CowFormData {
  id?: string;
  tag_number: string;
  name?: string | null;
  category: string;
  status: string;
  breed?: string | null;
  birth_date?: string | null;
  breeding_date?: string | null;
  expected_due_date?: string | null;
  dam_id?: string | null;
  sire_id?: string | null;
  notes?: string;
}

interface CowOption {
  id: string;
  tag_number: string;
  name: string | null;
  category: string;
}

function CowFormInner({
  onClose,
  initialCow,
  herdOptions,
  onSaved,
}: {
  onClose: () => void;
  initialCow?: CowFormData | null;
  herdOptions: CowOption[];
  onSaved: () => void;
}) {
  const isEdit = Boolean(initialCow?.id);
  const [tagNumber, setTagNumber] = useState(initialCow?.tag_number ?? '');
  const [name, setName] = useState(initialCow?.name ?? '');
  const [category, setCategory] = useState(initialCow?.category ?? 'COW');
  const [status, setStatus] = useState(initialCow?.status ?? 'ACTIVE');
  const [breed, setBreed] = useState(initialCow?.breed ?? '');
  const [birthDate, setBirthDate] = useState(
    formatDateInputValue(initialCow?.birth_date)
  );
  const [breedingDate, setBreedingDate] = useState(
    formatDateInputValue(initialCow?.breeding_date)
  );
  const [damId, setDamId] = useState(initialCow?.dam_id ?? '');
  const [sireId, setSireId] = useState(initialCow?.sire_id ?? '');
  const [notes, setNotes] = useState(initialCow?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewDueDate = useMemo(() => {
    const parsed = parseDateInput(breedingDate);
    return calculateExpectedDueDate(parsed);
  }, [breedingDate]);

  const damCandidates = herdOptions.filter(
    (c) => c.id !== initialCow?.id && (c.category === 'COW' || c.category === 'HEIFER')
  );
  const sireCandidates = herdOptions.filter(
    (c) => c.id !== initialCow?.id && c.category === 'BULL'
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        tag_number: tagNumber.trim(),
        name: name.trim() || null,
        category,
        status,
        breed: breed.trim() || null,
        birth_date: birthDate || null,
        breeding_date: breedingDate || null,
        dam_id: damId || null,
        sire_id: sireId || null,
        notes: notes.trim(),
      };

      const url = isEdit ? `/api/cows/${initialCow!.id}` : '/api/cows';
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not save animal.');
        return;
      }

      onSaved();
      onClose();
    } catch {
      setError('Network error saving animal.');
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
          <label htmlFor="cow-tag" className="field-label">
            Ear Tag # *
          </label>
          <input
            id="cow-tag"
            required
            value={tagNumber}
            onChange={(e) => setTagNumber(e.target.value)}
            placeholder="e.g. 104, Yellow-12"
            className="field-input font-mono font-bold"
          />
        </div>
        <div>
          <label htmlFor="cow-name" className="field-label">
            Name (Optional)
          </label>
          <input
            id="cow-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Bessie"
            className="field-input"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="cow-category" className="field-label">
            Category
          </label>
          <select
            id="cow-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="field-input"
          >
            {COW_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {COW_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="cow-status" className="field-label">
            Status
          </label>
          <select
            id="cow-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="field-input"
          >
            {COW_STATUSES.map((s) => (
              <option key={s} value={s}>
                {COW_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="cow-breed" className="field-label">
            Breed
          </label>
          <input
            id="cow-breed"
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
            placeholder="e.g. Black Angus"
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="cow-birth" className="field-label">
            Birth Date
          </label>
          <input
            id="cow-birth"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="field-input font-mono"
          />
        </div>
      </div>

      <div>
        <label htmlFor="cow-breeding" className="field-label">
          Breeding Date (Auto-Calculates Due Date +283 Days)
        </label>
        <input
          id="cow-breeding"
          type="date"
          value={breedingDate}
          onChange={(e) => setBreedingDate(e.target.value)}
          className="field-input font-mono"
        />
        {previewDueDate && (
          <p className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FEF3C7] border border-[#B45309] text-[#78350F] text-xs font-extrabold">
            <Calendar className="w-4 h-4" />
            Expected Due Date: {formatShortDate(previewDueDate)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="cow-dam" className="field-label">
            Dam (Mother)
          </label>
          <select
            id="cow-dam"
            value={damId}
            onChange={(e) => setDamId(e.target.value)}
            className="field-input"
          >
            <option value="">None</option>
            {damCandidates.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.tag_number} {c.name ? `(${c.name})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cow-sire" className="field-label">
            Sire (Father)
          </label>
          <select
            id="cow-sire"
            value={sireId}
            onChange={(e) => setSireId(e.target.value)}
            className="field-input"
          >
            <option value="">None</option>
            {sireCandidates.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.tag_number} {c.name ? `(${c.name})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="cow-notes" className="field-label">
          Notes
        </label>
        <textarea
          id="cow-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Temperament, pasture location, calving notes..."
          className="field-input resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full min-h-[50px] flex items-center justify-center gap-2 rounded-lg bg-[#173324] hover:bg-[#0F2419] disabled:opacity-50 text-white font-semibold text-sm transition"
      >
        <Save className="w-4 h-4" />
        {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Animal to Herd'}
      </button>
    </form>
  );
}

export function CowFormModal({
  open,
  onClose,
  initialCow,
  herdOptions,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initialCow?: CowFormData | null;
  herdOptions: CowOption[];
  onSaved: () => void;
}) {
  const isEdit = Boolean(initialCow?.id);
  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit #${initialCow?.tag_number}` : 'Add Animal'}
      subtitle={
        isEdit
          ? 'Update tag, status, breeding date, or lineage'
          : 'Register a new head in your herd inventory'
      }
    >
      {open && (
        <CowFormInner
          key={initialCow?.id ?? 'new'}
          onClose={onClose}
          initialCow={initialCow}
          herdOptions={herdOptions}
          onSaved={onSaved}
        />
      )}
    </ModalSheet>
  );
}
