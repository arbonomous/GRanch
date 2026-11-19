import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { AIAction } from './validation';
import {
  calculateExpectedDueDate,
  calculateSafeToSellDate,
  formatCurrency,
  parseDateInput,
} from './dates';
import { TRANSACTION_CATEGORY_LABELS } from './constants';

export interface IngestExecutionSummary {
  message: string;
  confirmations: string[];
  results: {
    cows_created: Array<{ id: string; tag_number: string; category: string; status: string }>;
    cows_updated: Array<{ id: string; tag_number: string; status: string }>;
    health_records: Array<{ id: string; cow_id: string; treatment_name: string; safe_to_sell_date: Date | null }>;
    transactions: Array<{ id: string; type: string; category: string; amount: number; vendor_or_buyer: string | null }>;
    daily_logs: Array<{ id: string; category: string; summary: string }>;
  };
}

async function findCowByTag(tx: Prisma.TransactionClient, rawTag: string) {
  const clean = rawTag.trim().replace(/^#/, '');
  // Case-insensitive match via SQLite fallback query
  const exact = await tx.cow.findUnique({ where: { tag_number: clean } });
  if (exact) return exact;

  const all = await tx.cow.findMany({
    select: { id: true, tag_number: true },
  });
  const match = all.find((c) => c.tag_number.toLowerCase() === clean.toLowerCase());
  if (!match) return null;
  return tx.cow.findUnique({ where: { id: match.id } });
}

async function generateUniqueCalfTag(
  tx: Prisma.TransactionClient,
  damTag: string,
  requestedTag?: string | null
): Promise<string> {
  if (requestedTag && requestedTag.trim()) {
    const existing = await findCowByTag(tx, requestedTag);
    if (!existing) return requestedTag.trim();
  }

  const base = `${damTag}-C`;
  for (let i = 1; i <= 99; i++) {
    const candidate = `${base}${i}`;
    const exists = await tx.cow.findUnique({ where: { tag_number: candidate } });
    if (!exists) return candidate;
  }
  return `${damTag}-C${Date.now().toString().slice(-4)}`;
}

/**
 * Executes multiple ranch actions inside a single atomic Prisma database transaction.
 */
export async function executeAiActionsAtomically(
  actions: AIAction[],
  rawTranscript?: string | null
): Promise<IngestExecutionSummary> {
  return prisma.$transaction(async (tx) => {
    const confirmations: string[] = [];
    const results: IngestExecutionSummary['results'] = {
      cows_created: [],
      cows_updated: [],
      health_records: [],
      transactions: [],
      daily_logs: [],
    };

    for (const action of actions) {
      if (action.type === 'calving') {
        let dam = await findCowByTag(tx, action.dam_tag);
        if (!dam) {
          // Auto-create mother record so field notes never fail when an untagged/new cow calves
          dam = await tx.cow.create({
            data: {
              tag_number: action.dam_tag.trim().replace(/^#/, ''),
              category: 'COW',
              status: 'NURSING',
              notes: 'Auto-created from calving log.',
            },
          });
          results.cows_created.push({
            id: dam.id,
            tag_number: dam.tag_number,
            category: dam.category,
            status: dam.status,
          });
        } else {
          dam = await tx.cow.update({
            where: { id: dam.id },
            data: {
              status: 'NURSING',
              expected_due_date: null,
            },
          });
          results.cows_updated.push({
            id: dam.id,
            tag_number: dam.tag_number,
            status: dam.status,
          });
        }

        const sire = action.sire_tag ? await findCowByTag(tx, action.sire_tag) : null;
        const calfTag = await generateUniqueCalfTag(tx, dam.tag_number, action.calf_tag);
        const birthDate = parseDateInput(action.birth_date) ?? new Date();
        const sexLabel =
          action.calf_sex === 'BULL'
            ? 'Bull calf'
            : action.calf_sex === 'HEIFER'
            ? 'Heifer calf'
            : 'Calf';

        const calf = await tx.cow.create({
          data: {
            tag_number: calfTag,
            name: action.calf_name || null,
            category: 'CALF',
            status: 'ACTIVE',
            breed: action.calf_breed || dam.breed || null,
            birth_date: birthDate,
            dam_id: dam.id,
            sire_id: sire?.id ?? null,
            notes: [sexLabel, action.notes].filter(Boolean).join(' — '),
          },
        });

        results.cows_created.push({
          id: calf.id,
          tag_number: calf.tag_number,
          category: calf.category,
          status: calf.status,
        });

        const log = await tx.dailyLog.create({
          data: {
            category: 'CALVING',
            summary: `${sexLabel} (#${calf.tag_number}) born to Cow #${dam.tag_number}. Dam set to Nursing.`,
            raw_transcript: rawTranscript ?? null,
            cow_id: dam.id,
          },
        });
        results.daily_logs.push({
          id: log.id,
          category: log.category,
          summary: log.summary,
        });

        confirmations.push(`${sexLabel} (#${calf.tag_number}) born to Cow #${dam.tag_number}`);
      } else if (action.type === 'health') {
        const cow = await findCowByTag(tx, action.cow_tag);
        if (!cow) {
          throw new Error(`Cow with tag #${action.cow_tag} was not found.`);
        }

        const treatmentDate = parseDateInput(action.date) ?? new Date();
        const safeToSellDate = calculateSafeToSellDate(
          treatmentDate,
          action.withdrawal_days
        );

        const health = await tx.healthRecord.create({
          data: {
            cow_id: cow.id,
            date: treatmentDate,
            type: action.health_type,
            treatment_name: action.treatment_name,
            dosage: action.dosage ?? null,
            withdrawal_days: action.withdrawal_days ?? null,
            safe_to_sell_date: safeToSellDate,
            notes: action.notes ?? '',
          },
        });
        results.health_records.push({
          id: health.id,
          cow_id: health.cow_id,
          treatment_name: health.treatment_name,
          safe_to_sell_date: health.safe_to_sell_date,
        });

        if (action.mark_sick && cow.status !== 'SOLD' && cow.status !== 'DECEASED') {
          const updated = await tx.cow.update({
            where: { id: cow.id },
            data: { status: 'SICK' },
          });
          results.cows_updated.push({
            id: updated.id,
            tag_number: updated.tag_number,
            status: updated.status,
          });
        }

        const dosageText = action.dosage ? ` (${action.dosage})` : '';
        const withdrawalText =
          action.withdrawal_days && action.withdrawal_days > 0
            ? ` [${action.withdrawal_days}d withdrawal]`
            : '';

        const log = await tx.dailyLog.create({
          data: {
            category: 'HEALTH_VET',
            summary: `${action.treatment_name}${dosageText} administered to #${cow.tag_number}${withdrawalText}.`,
            raw_transcript: rawTranscript ?? null,
            cow_id: cow.id,
          },
        });
        results.daily_logs.push({
          id: log.id,
          category: log.category,
          summary: log.summary,
        });

        confirmations.push(
          `${action.treatment_name} treatment recorded for #${cow.tag_number}`
        );
      } else if (action.type === 'sale') {
        const cow = await findCowByTag(tx, action.cow_tag);
        if (!cow) {
          throw new Error(`Cow with tag #${action.cow_tag} was not found.`);
        }

        const saleDate = parseDateInput(action.date) ?? new Date();
        const updatedCow = await tx.cow.update({
          where: { id: cow.id },
          data: { status: 'SOLD' },
        });
        results.cows_updated.push({
          id: updatedCow.id,
          tag_number: updatedCow.tag_number,
          status: updatedCow.status,
        });

        const transaction = await tx.transaction.create({
          data: {
            date: saleDate,
            type: 'INCOME',
            category: 'CATTLE_SALE',
            amount: new Prisma.Decimal(action.amount.toFixed(2)),
            vendor_or_buyer: action.buyer ?? null,
            cow_id: cow.id,
            notes: action.notes ?? '',
          },
        });
        results.transactions.push({
          id: transaction.id,
          type: transaction.type,
          category: transaction.category,
          amount: Number(transaction.amount),
          vendor_or_buyer: transaction.vendor_or_buyer,
        });

        const buyerSuffix = action.buyer ? ` to ${action.buyer}` : '';
        const log = await tx.dailyLog.create({
          data: {
            category: 'GENERAL',
            summary: `Sold #${cow.tag_number} for ${formatCurrency(action.amount)}${buyerSuffix}. Status set to Sold.`,
            raw_transcript: rawTranscript ?? null,
            cow_id: cow.id,
            transaction_id: transaction.id,
          },
        });
        results.daily_logs.push({
          id: log.id,
          category: log.category,
          summary: log.summary,
        });

        confirmations.push(
          `#${cow.tag_number} marked Sold with ${formatCurrency(action.amount)} Cattle Sale income`
        );
      } else if (action.type === 'breeding') {
        const cow = await findCowByTag(tx, action.cow_tag);
        if (!cow) {
          throw new Error(`Cow with tag #${action.cow_tag} was not found.`);
        }

        const breedingDate = parseDateInput(action.breeding_date) ?? new Date();
        const dueDate = calculateExpectedDueDate(breedingDate);

        const updatedCow = await tx.cow.update({
          where: { id: cow.id },
          data: {
            status: 'PREGNANT',
            breeding_date: breedingDate,
            expected_due_date: dueDate,
          },
        });
        results.cows_updated.push({
          id: updatedCow.id,
          tag_number: updatedCow.tag_number,
          status: updatedCow.status,
        });

        const dueStr = dueDate
          ? dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : '';
        const log = await tx.dailyLog.create({
          data: {
            category: 'GENERAL',
            summary: `Cow #${cow.tag_number} recorded as Pregnant (expected due ${dueStr}).`,
            raw_transcript: rawTranscript ?? null,
            cow_id: cow.id,
          },
        });
        results.daily_logs.push({
          id: log.id,
          category: log.category,
          summary: log.summary,
        });

        confirmations.push(`Cow #${cow.tag_number} marked Pregnant (due ${dueStr})`);
      } else if (action.type === 'transaction') {
        const cow = action.cow_tag ? await findCowByTag(tx, action.cow_tag) : null;
        const txDate = parseDateInput(action.date) ?? new Date();

        const transaction = await tx.transaction.create({
          data: {
            date: txDate,
            type: action.transaction_type,
            category: action.category,
            amount: new Prisma.Decimal(action.amount.toFixed(2)),
            vendor_or_buyer: action.vendor_or_buyer ?? null,
            cow_id: cow?.id ?? null,
            notes: action.notes ?? '',
          },
        });
        results.transactions.push({
          id: transaction.id,
          type: transaction.type,
          category: transaction.category,
          amount: Number(transaction.amount),
          vendor_or_buyer: transaction.vendor_or_buyer,
        });

        if (action.category === 'CATTLE_SALE' && cow) {
          const updated = await tx.cow.update({
            where: { id: cow.id },
            data: { status: 'SOLD' },
          });
          results.cows_updated.push({
            id: updated.id,
            tag_number: updated.tag_number,
            status: updated.status,
          });
        }

        const catLabel = TRANSACTION_CATEGORY_LABELS[action.category];
        const vendorSuffix = action.vendor_or_buyer ? ` (${action.vendor_or_buyer})` : '';
        const logSummary =
          action.summary ||
          `${action.transaction_type === 'INCOME' ? 'Received' : 'Spent'} ${formatCurrency(action.amount)} — ${catLabel}${vendorSuffix}.`;

        const log = await tx.dailyLog.create({
          data: {
            category: action.log_category ?? 'GENERAL',
            summary: logSummary,
            raw_transcript: rawTranscript ?? null,
            cow_id: cow?.id ?? null,
            transaction_id: transaction.id,
          },
        });
        results.daily_logs.push({
          id: log.id,
          category: log.category,
          summary: log.summary,
        });

        confirmations.push(
          `${formatCurrency(action.amount)} ${catLabel} ${action.transaction_type.toLowerCase()} added`
        );
      } else if (action.type === 'cow_update') {
        const cow = await findCowByTag(tx, action.cow_tag);
        if (!cow) {
          throw new Error(`Cow with tag #${action.cow_tag} was not found.`);
        }
        const updated = await tx.cow.update({
          where: { id: cow.id },
          data: {
            ...(action.status ? { status: action.status } : {}),
            ...(action.category ? { category: action.category } : {}),
            ...(action.name !== undefined ? { name: action.name } : {}),
            ...(action.breed !== undefined ? { breed: action.breed } : {}),
            ...(action.notes !== undefined && action.notes !== null ? { notes: action.notes } : {}),
          },
        });
        results.cows_updated.push({
          id: updated.id,
          tag_number: updated.tag_number,
          status: updated.status,
        });

        const log = await tx.dailyLog.create({
          data: {
            category: 'GENERAL',
            summary: `Updated #${updated.tag_number}${action.status ? ` status to ${action.status}` : ''}.`,
            raw_transcript: rawTranscript ?? null,
            cow_id: updated.id,
          },
        });
        results.daily_logs.push({
          id: log.id,
          category: log.category,
          summary: log.summary,
        });
        confirmations.push(`Updated #${updated.tag_number}`);
      } else if (action.type === 'log') {
        const cow = action.cow_tag ? await findCowByTag(tx, action.cow_tag) : null;
        const log = await tx.dailyLog.create({
          data: {
            timestamp: parseDateInput(action.timestamp) ?? new Date(),
            category: action.category,
            summary: action.summary,
            raw_transcript: rawTranscript ?? null,
            cow_id: cow?.id ?? null,
          },
        });
        results.daily_logs.push({
          id: log.id,
          category: log.category,
          summary: log.summary,
        });
        confirmations.push(action.summary);
      }
    }

    const message =
      confirmations.length === 0
        ? 'No actions were executed.'
        : confirmations.length === 1
        ? `Logged: ${confirmations[0]}.`
        : `Logged: ${confirmations.slice(0, -1).join(', ')}, and ${confirmations[confirmations.length - 1]}.`;

    return {
      message,
      confirmations,
      results,
    };
  });
}
