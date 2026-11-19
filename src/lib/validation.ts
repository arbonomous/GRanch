import { z } from 'zod';
import {
  COW_CATEGORIES,
  COW_STATUSES,
  HEALTH_TYPES,
  LOG_CATEGORIES,
  TRANSACTION_CATEGORIES,
  TRANSACTION_TYPES,
} from './constants';

const optionalString = z.string().trim().optional().nullable();
const optionalDate = z.string().trim().optional().nullable();

export const createCowSchema = z.object({
  tag_number: z.string().trim().min(1, 'Tag number is required').max(64),
  name: optionalString,
  category: z.enum(COW_CATEGORIES).default('COW'),
  status: z.enum(COW_STATUSES).default('ACTIVE'),
  breed: optionalString,
  birth_date: optionalDate,
  breeding_date: optionalDate,
  expected_due_date: optionalDate,
  dam_id: optionalString,
  sire_id: optionalString,
  notes: z.string().optional().default(''),
});

export const updateCowSchema = createCowSchema.partial();

export const createHealthRecordSchema = z.object({
  cow_id: z.string().trim().min(1, 'Cow ID is required'),
  date: optionalDate,
  type: z.enum(HEALTH_TYPES),
  treatment_name: z.string().trim().min(1, 'Treatment name is required').max(160),
  dosage: optionalString,
  withdrawal_days: z.coerce.number().int().min(0).max(365).optional().nullable(),
  notes: z.string().optional().default(''),
  mark_sick: z.boolean().optional(),
  create_log: z.boolean().optional(),
});

export const updateHealthRecordSchema = createHealthRecordSchema
  .omit({ cow_id: true, mark_sick: true, create_log: true })
  .partial();

export const createDailyLogSchema = z.object({
  timestamp: optionalDate,
  category: z.enum(LOG_CATEGORIES).default('GENERAL'),
  summary: z.string().trim().min(1, 'Summary is required').max(500),
  raw_transcript: optionalString,
  cow_id: optionalString,
  transaction_id: optionalString,
});

export const updateDailyLogSchema = createDailyLogSchema.partial();

export const createTransactionSchema = z.object({
  date: optionalDate,
  type: z.enum(TRANSACTION_TYPES),
  category: z.enum(TRANSACTION_CATEGORIES),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  vendor_or_buyer: optionalString,
  cow_id: optionalString,
  notes: z.string().optional().default(''),
  create_log: z.boolean().optional(),
});

export const updateTransactionSchema = createTransactionSchema
  .omit({ create_log: true })
  .partial();

// Structured Instinct AI Actions
export const aiCalvingActionSchema = z.object({
  type: z.literal('calving'),
  dam_tag: z.string().trim().min(1),
  calf_tag: optionalString,
  calf_name: optionalString,
  calf_sex: z.enum(['BULL', 'HEIFER', 'CALF']).optional(),
  calf_breed: optionalString,
  sire_tag: optionalString,
  birth_date: optionalDate,
  notes: z.string().optional().default(''),
});

export const aiHealthActionSchema = z.object({
  type: z.literal('health'),
  cow_tag: z.string().trim().min(1),
  health_type: z.enum(HEALTH_TYPES).default('MEDICATION'),
  treatment_name: z.string().trim().min(1),
  dosage: optionalString,
  withdrawal_days: z.coerce.number().int().min(0).max(365).optional().nullable(),
  date: optionalDate,
  mark_sick: z.boolean().optional().default(false),
  notes: z.string().optional().default(''),
});

export const aiSaleActionSchema = z.object({
  type: z.literal('sale'),
  cow_tag: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  buyer: optionalString,
  date: optionalDate,
  notes: z.string().optional().default(''),
});

export const aiBreedingActionSchema = z.object({
  type: z.literal('breeding'),
  cow_tag: z.string().trim().min(1),
  breeding_date: optionalDate,
  sire_tag: optionalString,
  notes: z.string().optional().default(''),
});

export const aiTransactionActionSchema = z.object({
  type: z.literal('transaction'),
  transaction_type: z.enum(TRANSACTION_TYPES),
  category: z.enum(TRANSACTION_CATEGORIES),
  amount: z.coerce.number().positive(),
  vendor_or_buyer: optionalString,
  cow_tag: optionalString,
  date: optionalDate,
  notes: z.string().optional().default(''),
  summary: optionalString,
  log_category: z.enum(LOG_CATEGORIES).optional(),
});

export const aiLogActionSchema = z.object({
  type: z.literal('log'),
  category: z.enum(LOG_CATEGORIES).default('GENERAL'),
  summary: z.string().trim().min(1),
  cow_tag: optionalString,
  timestamp: optionalDate,
});

export const aiCowUpdateActionSchema = z.object({
  type: z.literal('cow_update'),
  cow_tag: z.string().trim().min(1),
  status: z.enum(COW_STATUSES).optional(),
  category: z.enum(COW_CATEGORIES).optional(),
  name: optionalString,
  breed: optionalString,
  notes: optionalString,
});

export const aiActionSchema = z.discriminatedUnion('type', [
  aiCalvingActionSchema,
  aiHealthActionSchema,
  aiSaleActionSchema,
  aiBreedingActionSchema,
  aiTransactionActionSchema,
  aiLogActionSchema,
  aiCowUpdateActionSchema,
]);

export type AIAction = z.infer<typeof aiActionSchema>;

export const aiIngestRequestSchema = z
  .object({
    transcript: z.string().trim().optional(),
    raw_transcript: z.string().trim().optional(),
    actions: z.array(aiActionSchema).optional(),
  })
  .refine(
    (data) => Boolean(data.transcript || (data.actions && data.actions.length > 0)),
    { message: 'Provide either "transcript" or a non-empty "actions" array.' }
  );

export const aiQueryRequestSchema = z
  .object({
    question: z.string().trim().optional(),
    action: z
      .enum([
        'herd_summary',
        'due_dates',
        'cow_lookup',
        'financial_summary',
        'recent_logs',
        'sick_and_withdrawals',
      ])
      .optional(),
    params: z
      .object({
        tag_number: z.string().trim().optional(),
        timeframe: z.enum(['month', 'year', 'all']).optional(),
        category: z.string().trim().optional(),
        days: z.coerce.number().int().min(1).max(365).optional(),
        limit: z.coerce.number().int().min(1).max(50).optional(),
      })
      .optional(),
  })
  .refine((data) => Boolean(data.question || data.action), {
    message: 'Provide either "question" or "action".',
  });
