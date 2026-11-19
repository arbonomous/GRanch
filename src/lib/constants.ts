export const GESTATION_DAYS = 283;

export const COW_CATEGORIES = ['COW', 'BULL', 'HEIFER', 'STEER', 'CALF'] as const;
export type CowCategory = (typeof COW_CATEGORIES)[number];

export const COW_STATUSES = [
  'ACTIVE',
  'PREGNANT',
  'NURSING',
  'SICK',
  'SOLD',
  'DECEASED',
] as const;
export type CowStatus = (typeof COW_STATUSES)[number];

export const ACTIVE_COW_STATUSES: CowStatus[] = ['ACTIVE', 'PREGNANT', 'NURSING', 'SICK'];

export const HEALTH_TYPES = [
  'VACCINATION',
  'MEDICATION',
  'INJURY',
  'CHECKUP',
  'CALVING_ASSIST',
] as const;
export type HealthType = (typeof HEALTH_TYPES)[number];

export const LOG_CATEGORIES = [
  'CALVING',
  'HEALTH_VET',
  'FEEDING',
  'FENCING_MAINTENANCE',
  'PASTURE_ROTATION',
  'EQUIPMENT',
  'GENERAL',
] as const;
export type LogCategory = (typeof LOG_CATEGORIES)[number];

export const TRANSACTION_TYPES = ['INCOME', 'EXPENSE'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const INCOME_CATEGORIES = [
  'CATTLE_SALE',
  'HAY_CROP_SALE',
  'OTHER_INCOME',
] as const;

export const EXPENSE_CATEGORIES = [
  'FEED_HAY',
  'VET_MEDS',
  'FUEL_EQUIPMENT',
  'FENCING_REPAIRS',
  'LABOR',
  'UTILITIES_PROPERTY',
  'OTHER_EXPENSE',
] as const;

export const TRANSACTION_CATEGORIES = [
  ...INCOME_CATEGORIES,
  ...EXPENSE_CATEGORIES,
] as const;
export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

export const COW_CATEGORY_LABELS: Record<CowCategory, string> = {
  COW: 'Cow',
  BULL: 'Bull',
  HEIFER: 'Heifer',
  STEER: 'Steer',
  CALF: 'Calf',
};

export const COW_STATUS_LABELS: Record<CowStatus, string> = {
  ACTIVE: 'Active',
  PREGNANT: 'Pregnant',
  NURSING: 'Nursing',
  SICK: 'Sick',
  SOLD: 'Sold',
  DECEASED: 'Deceased',
};

export const HEALTH_TYPE_LABELS: Record<HealthType, string> = {
  VACCINATION: 'Vaccination',
  MEDICATION: 'Medication',
  INJURY: 'Injury',
  CHECKUP: 'Checkup',
  CALVING_ASSIST: 'Calving Assist',
};

export const LOG_CATEGORY_LABELS: Record<LogCategory, string> = {
  CALVING: 'Calving',
  HEALTH_VET: 'Health / Vet',
  FEEDING: 'Feeding',
  FENCING_MAINTENANCE: 'Fencing',
  PASTURE_ROTATION: 'Pasture',
  EQUIPMENT: 'Equipment',
  GENERAL: 'General',
};

export const TRANSACTION_CATEGORY_LABELS: Record<TransactionCategory, string> = {
  CATTLE_SALE: 'Cattle Sale',
  HAY_CROP_SALE: 'Hay / Crop Sale',
  OTHER_INCOME: 'Other Income',
  FEED_HAY: 'Feed & Hay',
  VET_MEDS: 'Vet & Meds',
  FUEL_EQUIPMENT: 'Fuel & Equipment',
  FENCING_REPAIRS: 'Fencing & Repairs',
  LABOR: 'Labor',
  UTILITIES_PROPERTY: 'Utilities & Property',
  OTHER_EXPENSE: 'Other Expense',
};
