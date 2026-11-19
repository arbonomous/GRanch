'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import {
  COW_CATEGORY_LABELS,
  COW_STATUS_LABELS,
  CowCategory,
  CowStatus,
  HEALTH_TYPE_LABELS,
  HealthType,
  LOG_CATEGORY_LABELS,
  LogCategory,
} from '@/lib/constants';

export function StatusBadge({ status }: { status: string }) {
  const s = status as CowStatus;
  const dotColors: Record<string, string> = {
    ACTIVE: 'bg-[#157347]',
    PREGNANT: 'bg-[#B45309]',
    NURSING: 'bg-[#0E6087]',
    SICK: 'bg-[#B42318]',
    SOLD: 'bg-[#767C77]',
    DECEASED: 'bg-[#111312]',
  };
  const textColors: Record<string, string> = {
    SICK: 'text-[#B42318]',
    PREGNANT: 'text-[#92400E]',
    SOLD: 'text-[#525753]',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#E2E0D9] bg-[#FAFAF8] text-[11px] font-semibold uppercase tracking-[0.06em] whitespace-nowrap ${
        textColors[status] ?? 'text-[#111312]'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[status] ?? 'bg-[#767C77]'}`} />
      {COW_STATUS_LABELS[s] ?? status}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  const c = category as CowCategory;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#EFEDE8] text-[#525753] text-[11px] font-semibold uppercase tracking-[0.06em] whitespace-nowrap">
      {COW_CATEGORY_LABELS[c] ?? category}
    </span>
  );
}

export function LogCategoryBadge({ category }: { category: string }) {
  const c = category as LogCategory;
  const dotColors: Record<string, string> = {
    CALVING: 'bg-[#0E6087]',
    HEALTH_VET: 'bg-[#B42318]',
    FEEDING: 'bg-[#157347]',
    FENCING_MAINTENANCE: 'bg-[#B45309]',
    PASTURE_ROTATION: 'bg-[#3F6212]',
    EQUIPMENT: 'bg-[#475569]',
    GENERAL: 'bg-[#767C77]',
  };

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#E2E0D9] bg-[#FAFAF8] text-[#111312] text-[11px] font-semibold uppercase tracking-[0.06em] whitespace-nowrap">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[category] ?? dotColors.GENERAL}`} />
      {LOG_CATEGORY_LABELS[c] ?? category}
    </span>
  );
}

export function HealthTypeBadge({ type }: { type: string }) {
  const t = type as HealthType;
  const dotColors: Record<string, string> = {
    VACCINATION: 'bg-[#157347]',
    MEDICATION: 'bg-[#B45309]',
    INJURY: 'bg-[#B42318]',
    CHECKUP: 'bg-[#0E6087]',
    CALVING_ASSIST: 'bg-[#0E6087]',
  };

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#E2E0D9] bg-white text-[#111312] text-[11px] font-semibold uppercase tracking-[0.06em]">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[type] ?? 'bg-[#767C77]'}`} />
      {HEALTH_TYPE_LABELS[t] ?? type}
    </span>
  );
}

export function EarTagBadge({
  tag,
  size = 'md',
}: {
  tag: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  if (size === 'lg') {
    return (
      <span className="inline-flex items-center px-3.5 py-2 rounded-lg bg-[#111312] text-[#F5F4F0] font-mono text-xl font-bold tracking-tight tabular-nums">
        #{tag}
      </span>
    );
  }
  if (size === 'sm') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#EFEDE8] border border-[#D6D3CB] text-[#111312] font-mono text-xs font-bold tracking-tight tabular-nums">
        #{tag}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center min-w-[60px] px-2.5 py-1.5 rounded-lg bg-[#EFEDE8] border border-[#D6D3CB] text-[#111312] font-mono text-sm font-bold tracking-tight tabular-nums">
      #{tag}
    </span>
  );
}

export function ModalSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#111312]/50 backdrop-blur-[2px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-[#F5F4F0] border-t sm:border border-[#D6D3CB] rounded-t-2xl sm:rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 bg-white border-b border-[#E2E0D9]">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[#111312]">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs font-medium text-[#525753] mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#E2E0D9] bg-[#F5F4F0] text-[#111312] hover:bg-[#EFEDE8] transition"
          >
            <X className="w-5 h-5 stroke-[2]" />
          </button>
        </div>
        <div className="p-5 pb-safe">{children}</div>
      </div>
    </div>
  );
}
