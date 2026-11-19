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
  const styles: Record<string, string> = {
    ACTIVE: 'bg-[#DCFCE7] text-[#14532D] border-[#15803D]',
    PREGNANT: 'bg-[#FEF3C7] text-[#78350F] border-[#B45309]',
    NURSING: 'bg-[#E0F2FE] text-[#0C4A6E] border-[#0369A1]',
    SICK: 'bg-[#FEE2E2] text-[#7F1D1D] border-[#B91C1C]',
    SOLD: 'bg-[#E5E7EB] text-[#1F2937] border-[#6B7280]',
    DECEASED: 'bg-[#27272A] text-[#F4F4F5] border-[#18181B]',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-lg border-2 text-xs font-extrabold uppercase tracking-wide whitespace-nowrap ${
        styles[status] ?? 'bg-[#EBE6DC] text-[#141714] border-[#CFC8BA]'
      }`}
    >
      {COW_STATUS_LABELS[s] ?? status}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  const c = category as CowCategory;
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#EBE6DC] text-[#141714] border border-[#CFC8BA] text-xs font-bold uppercase tracking-wide whitespace-nowrap">
      {COW_CATEGORY_LABELS[c] ?? category}
    </span>
  );
}

export function LogCategoryBadge({ category }: { category: string }) {
  const c = category as LogCategory;
  const styles: Record<string, string> = {
    CALVING: 'bg-[#E0F2FE] text-[#0C4A6E] border-[#0369A1]',
    HEALTH_VET: 'bg-[#FEE2E2] text-[#7F1D1D] border-[#B91C1C]',
    FEEDING: 'bg-[#DCFCE7] text-[#14532D] border-[#15803D]',
    FENCING_MAINTENANCE: 'bg-[#FEF3C7] text-[#78350F] border-[#B45309]',
    PASTURE_ROTATION: 'bg-[#ECFCCB] text-[#365314] border-[#4D7C0F]',
    EQUIPMENT: 'bg-[#F3E8FF] text-[#4C1D95] border-[#6D28D9]',
    GENERAL: 'bg-[#EBE6DC] text-[#141714] border-[#8C8577]',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-extrabold uppercase tracking-wide whitespace-nowrap ${
        styles[category] ?? styles.GENERAL
      }`}
    >
      {LOG_CATEGORY_LABELS[c] ?? category}
    </span>
  );
}

export function HealthTypeBadge({ type }: { type: string }) {
  const t = type as HealthType;
  const styles: Record<string, string> = {
    VACCINATION: 'bg-[#DCFCE7] text-[#14532D] border-[#15803D]',
    MEDICATION: 'bg-[#FEF3C7] text-[#78350F] border-[#B45309]',
    INJURY: 'bg-[#FEE2E2] text-[#7F1D1D] border-[#B91C1C]',
    CHECKUP: 'bg-[#E0F2FE] text-[#0C4A6E] border-[#0369A1]',
    CALVING_ASSIST: 'bg-[#E0F2FE] text-[#0C4A6E] border-[#0369A1]',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-xs font-extrabold uppercase tracking-wide ${
        styles[type] ?? 'bg-[#EBE6DC] text-[#141714] border-[#8C8577]'
      }`}
    >
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
  const sizeClasses =
    size === 'lg'
      ? 'px-4 py-2 text-2xl rounded-xl border-2'
      : size === 'sm'
      ? 'px-2 py-0.5 text-xs rounded-md border'
      : 'px-3 py-1.5 text-base rounded-xl border-2';

  return (
    <span
      className={`inline-flex items-center font-mono font-extrabold tracking-tight bg-[#FEF08A] text-[#141714] border-[#141714] tabular-nums shadow-[0_2px_0_#141714] ${sizeClasses}`}
    >
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#141714]/65 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-[#F4F1EA] border-t-2 sm:border-2 border-[#141714] rounded-t-3xl sm:rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 bg-[#FFFFFF] border-b-2 border-[#CFC8BA]">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-[#141714]">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm font-medium text-[#474E47] mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl border-2 border-[#CFC8BA] bg-[#F4F1EA] text-[#141714] hover:border-[#141714] active:scale-95 transition"
          >
            <X className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>
        <div className="p-5 pb-safe">{children}</div>
      </div>
    </div>
  );
}
