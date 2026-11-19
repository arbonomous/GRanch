'use client';

import React, { useState } from 'react';
import { AlertCircle, DollarSign } from 'lucide-react';
import { ModalSheet } from './Badges';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  TRANSACTION_CATEGORY_LABELS,
} from '@/lib/constants';
import { formatDateInputValue } from '@/lib/dates';

interface CowOption {
  id: string;
  tag_number: string;
  name: string | null;
  status: string;
}

function TransactionFormInner({
  onClose,
  herdOptions,
  defaultCowId,
  defaultType,
  defaultCategory,
  onSaved,
}: {
  onClose: () => void;
  herdOptions: CowOption[];
  defaultCowId?: string;
  defaultType?: 'INCOME' | 'EXPENSE';
  defaultCategory?: string;
  onSaved: () => void;
}) {
  const initType = defaultType ?? 'EXPENSE';
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>(initType);
  const [category, setCategory] = useState(
    defaultCategory ?? (initType === 'INCOME' ? 'CATTLE_SALE' : 'FEED_HAY')
  );
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => formatDateInputValue(new Date()));
  const [vendorOrBuyer, setVendorOrBuyer] = useState('');
  const [cowId, setCowId] = useState(defaultCowId ?? '');
  const [notes, setNotes] = useState('');
  const [createLog, setCreateLog] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const selectedCow = herdOptions.find((c) => c.id === cowId);

  function switchType(next: 'INCOME' | 'EXPENSE') {
    setType(next);
    setCategory(next === 'INCOME' ? 'CATTLE_SALE' : 'FEED_HAY');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          category,
          amount: Number(amount),
          date,
          vendor_or_buyer: vendorOrBuyer.trim() || null,
          cow_id: cowId || null,
          notes: notes.trim(),
          create_log: createLog,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not save transaction.');
        return;
      }

      onSaved();
      onClose();
    } catch {
      setError('Network error saving transaction.');
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

      <div className="grid grid-cols-2 gap-2 p-1.5 bg-[#EBE6DC] rounded-xl border-2 border-[#CFC8BA]">
        <button
          type="button"
          onClick={() => switchType('EXPENSE')}
          className={`min-h-[50px] rounded-lg font-extrabold text-base transition ${
            type === 'EXPENSE'
              ? 'bg-[#B91C1C] text-white border-2 border-[#141714]'
              : 'text-[#141714] hover:bg-white/60'
          }`}
        >
          − Expense
        </button>
        <button
          type="button"
          onClick={() => switchType('INCOME')}
          className={`min-h-[50px] rounded-lg font-extrabold text-base transition ${
            type === 'INCOME'
              ? 'bg-[#15803D] text-white border-2 border-[#141714]'
              : 'text-[#141714] hover:bg-white/60'
          }`}
        >
          + Income
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="tx-amount" className="field-label">
            Amount (USD) *
          </label>
          <input
            id="tx-amount"
            required
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="field-input font-mono font-extrabold text-lg tabular-nums"
          />
        </div>
        <div>
          <label htmlFor="tx-date" className="field-label">
            Date
          </label>
          <input
            id="tx-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="field-input font-mono"
          />
        </div>
      </div>

      <div>
        <label htmlFor="tx-category" className="field-label">
          Category
        </label>
        <select
          id="tx-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="field-input"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {TRANSACTION_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="tx-vendor" className="field-label">
          {type === 'INCOME' ? 'Buyer' : 'Vendor / Store'}
        </label>
        <input
          id="tx-vendor"
          value={vendorOrBuyer}
          onChange={(e) => setVendorOrBuyer(e.target.value)}
          placeholder={
            type === 'INCOME'
              ? 'e.g. County Livestock Auction'
              : 'e.g. Valley Ag Co-op'
          }
          className="field-input"
        />
      </div>

      <div>
        <label htmlFor="tx-cow" className="field-label">
          Link Animal (Optional)
        </label>
        <select
          id="tx-cow"
          value={cowId}
          onChange={(e) => setCowId(e.target.value)}
          className="field-input"
        >
          <option value="">No specific animal</option>
          {herdOptions.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.tag_number} {c.name ? `(${c.name})` : ''} — {c.status}
            </option>
          ))}
        </select>
      </div>

      {category === 'CATTLE_SALE' && selectedCow && (
        <div className="p-3.5 rounded-xl bg-[#FEF3C7] border-2 border-[#B45309] text-[#78350F] flex items-center gap-2.5 text-sm font-extrabold">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>
            Saving this Cattle Sale will automatically set #{selectedCow.tag_number} to{' '}
            <strong>SOLD</strong>.
          </span>
        </div>
      )}

      <div>
        <label htmlFor="tx-notes" className="field-label">
          Notes
        </label>
        <textarea
          id="tx-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Bales, weight, receipt reference..."
          className="field-input resize-none"
        />
      </div>

      <label className="flex items-center gap-3 p-3.5 rounded-xl bg-white border-2 border-[#CFC8BA] cursor-pointer min-h-[50px]">
        <input
          type="checkbox"
          checked={createLog}
          onChange={(e) => setCreateLog(e.target.checked)}
          className="w-5 h-5 accent-[#1B4D2E]"
        />
        <span className="font-bold text-sm text-[#141714]">
          Also add an entry to the Daily Activity Log
        </span>
      </label>

      <button
        type="submit"
        disabled={submitting}
        className={`w-full min-h-[54px] flex items-center justify-center gap-2 rounded-xl text-white font-extrabold text-base border-2 border-[#141714] shadow-[0_2px_0_#141714] active:translate-y-0.5 transition disabled:opacity-50 ${
          type === 'INCOME'
            ? 'bg-[#15803D] hover:bg-[#166534]'
            : 'bg-[#B91C1C] hover:bg-[#991B1B]'
        }`}
      >
        <DollarSign className="w-5 h-5" />
        {submitting
          ? 'Saving...'
          : type === 'INCOME'
          ? 'Log Income'
          : 'Log Expense'}
      </button>
    </form>
  );
}

export function TransactionFormModal({
  open,
  onClose,
  herdOptions,
  defaultCowId,
  defaultType,
  defaultCategory,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  herdOptions: CowOption[];
  defaultCowId?: string;
  defaultType?: 'INCOME' | 'EXPENSE';
  defaultCategory?: string;
  onSaved: () => void;
}) {
  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title="Log Transaction"
      subtitle="Record cash in or cash out on the ranch ledger"
    >
      {open && (
        <TransactionFormInner
          onClose={onClose}
          herdOptions={herdOptions}
          defaultCowId={defaultCowId}
          defaultType={defaultType}
          defaultCategory={defaultCategory}
          onSaved={onSaved}
        />
      )}
    </ModalSheet>
  );
}
