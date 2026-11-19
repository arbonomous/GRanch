import {
  AIAction,
  aiActionSchema,
} from './validation';
import {
  HealthType,
  LogCategory,
  TransactionCategory,
} from './constants';

const KNOWN_TREATMENTS: Array<{
  pattern: RegExp;
  name: string;
  type: HealthType;
  defaultWithdrawalDays?: number;
}> = [
  { pattern: /\bdraxxin\b/i, name: 'Draxxin', type: 'MEDICATION', defaultWithdrawalDays: 18 },
  { pattern: /\bpenicillin\b/i, name: 'Penicillin', type: 'MEDICATION', defaultWithdrawalDays: 10 },
  { pattern: /\bla[\s-]?200\b|\boxytetracycline\b/i, name: 'LA-200 (Oxytetracycline)', type: 'MEDICATION', defaultWithdrawalDays: 28 },
  { pattern: /\bbanamine\b/i, name: 'Banamine', type: 'MEDICATION', defaultWithdrawalDays: 4 },
  { pattern: /\bexcede\b/i, name: 'Excede', type: 'MEDICATION', defaultWithdrawalDays: 13 },
  { pattern: /\bnuflor\b/i, name: 'Nuflor', type: 'MEDICATION', defaultWithdrawalDays: 28 },
  { pattern: /\bivomec\b|\bivermectin\b|\bdeworm(er|ed|ing)?\b/i, name: 'Ivermectin Dewormer', type: 'MEDICATION', defaultWithdrawalDays: 35 },
  { pattern: /\b7[\s-]?way\b|\bblackleg\b/i, name: '7-Way Blackleg', type: 'VACCINATION', defaultWithdrawalDays: 21 },
  { pattern: /\bbovi[\s-]?shield\b/i, name: 'Bovi-Shield Gold', type: 'VACCINATION', defaultWithdrawalDays: 21 },
  { pattern: /\bmultimin\b/i, name: 'Multimin 90', type: 'MEDICATION', defaultWithdrawalDays: 0 },
  { pattern: /\btet(anus)?\b/i, name: 'Tetanus Antitoxin', type: 'VACCINATION', defaultWithdrawalDays: 21 },
  { pattern: /\bvaccin(e|ated|ation)\b/i, name: 'Vaccination', type: 'VACCINATION' },
];

function extractTag(text: string): string | null {
  // Matches: "Cow 214", "cow #214", "tag Yellow-12", "steer 305", "bull B01", "heifer 42", "#214"
  const explicit = text.match(
    /\b(?:cow|bull|heifer|steer|calf|tag|animal)\s*#?\s*([A-Za-z]+-\d+|[A-Za-z]\d+|\d+[A-Za-z]?)\b/i
  );
  if (explicit) return explicit[1];

  const hashOnly = text.match(/#([A-Za-z]+-\d+|[A-Za-z]\d+|\d+[A-Za-z]?)\b/);
  if (hashOnly) return hashOnly[1];

  return null;
}

function extractAmount(text: string): number | null {
  const dollarMatch = text.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  if (dollarMatch) {
    const val = Number(dollarMatch[1].replace(/,/g, ''));
    if (!Number.isNaN(val) && val > 0) return val;
  }
  const wordMatch = text.match(/\b([\d,]+(?:\.\d{1,2})?)\s*(?:dollars|bucks)\b/i);
  if (wordMatch) {
    const val = Number(wordMatch[1].replace(/,/g, ''));
    if (!Number.isNaN(val) && val > 0) return val;
  }
  return null;
}

function extractVendor(text: string): string | null {
  const match = text.match(
    /\b(?:at|from|to)\s+(?:the\s+)?([A-Za-z0-9][A-Za-z0-9\s'&-]{1,36}?)(?=\s*(?:,|and\b|\.|for\b|on\b|today\b|this\b|$))/i
  );
  if (!match) return null;
  const candidate = match[1].trim();
  if (/^(her|him|them|it|morning|afternoon|evening|today|yesterday)$/i.test(candidate)) {
    return null;
  }
  // Title case neat vendor names like "co-op" -> "Co-op"
  return candidate.replace(/\b[a-z]/g, (ch) => ch.toUpperCase());
}

function inferExpenseCategory(text: string): TransactionCategory {
  if (/\b(hay|feed|grain|mineral|salt|pellet|alfalfa|cube|corn|silage)\b/i.test(text)) {
    return 'FEED_HAY';
  }
  if (/\b(vet|med|medicine|antibiotic|vaccine|syringe|penicillin|draxxin|clinic)\b/i.test(text)) {
    return 'VET_MEDS';
  }
  if (/\b(fuel|diesel|gas|tractor|truck|trailer|oil|part|equipment|mower|baler|tire)\b/i.test(text)) {
    return 'FUEL_EQUIPMENT';
  }
  if (/\b(fence|fencing|post|wire|gate|barb|t-post|repair|staple)\b/i.test(text)) {
    return 'FENCING_REPAIRS';
  }
  if (/\b(labor|hand|crew|wage|payroll|helper|contractor)\b/i.test(text)) {
    return 'LABOR';
  }
  if (/\b(electric|water|utility|utilities|tax|lease|rent|property|insurance)\b/i.test(text)) {
    return 'UTILITIES_PROPERTY';
  }
  return 'OTHER_EXPENSE';
}

function inferLogCategory(text: string): LogCategory {
  if (/\b(calv|born|calf|delivery|labor)\b/i.test(text)) return 'CALVING';
  if (/\b(vet|shot|penicillin|draxxin|vaccin|med|sick|limp|injury|treat|checkup|deworm)\b/i.test(text)) {
    return 'HEALTH_VET';
  }
  if (/\b(feed|fed|hay|mineral|salt|bale|grain|water trough|supplement)\b/i.test(text)) {
    return 'FEEDING';
  }
  if (/\b(fence|post|wire|gate|barb|corral|chute|repair)\b/i.test(text)) {
    return 'FENCING_MAINTENANCE';
  }
  if (/\b(pasture|rotat|moved|move herd|paddock|field|graz)\b/i.test(text)) {
    return 'PASTURE_ROTATION';
  }
  if (/\b(tractor|truck|trailer|mower|baler|fuel|diesel|oil|grease|equipment)\b/i.test(text)) {
    return 'EQUIPMENT';
  }
  return 'GENERAL';
}

/**
 * Deterministic natural-language parser tailored for ranch voice notes.
 * Works completely offline without requiring an OpenAI key.
 */
export function parseTranscriptDeterministic(transcript: string): AIAction[] {
  const actions: AIAction[] = [];
  const clauses = transcript
    .split(/(?:,\s*and\s+|,\s+|\s+and\s+|\s*;\s*|\.\s+)/i)
    .map((c) => c.trim())
    .filter(Boolean);

  let lastTag: string | null = extractTag(transcript);

  for (const clause of clauses) {
    const clauseTag = extractTag(clause);
    if (clauseTag) {
      lastTag = clauseTag;
    }
    const effectiveTag = clauseTag ?? lastTag;

    // 1. Calving detection
    if (
      /\b(had\s+a|gave\s+birth|calved|dropped\s+a|birthed)\b/i.test(clause) &&
      /\b(calf|bull\s+calf|heifer\s+calf)\b/i.test(clause) &&
      effectiveTag
    ) {
      const calfSex = /\bbull\s+calf\b/i.test(clause)
        ? 'BULL'
        : /\bheifer\s+calf\b/i.test(clause)
        ? 'HEIFER'
        : 'CALF';

      const calfTagMatch = clause.match(/\btagged\s*#?([A-Za-z0-9-]+)\b/i);

      actions.push({
        type: 'calving',
        dam_tag: effectiveTag,
        calf_sex: calfSex,
        calf_tag: calfTagMatch ? calfTagMatch[1] : undefined,
        notes: clause,
      });
      continue;
    }

    // 2. Sale detection
    if (/\b(sold|auctioned)\b/i.test(clause)) {
      const amount = extractAmount(clause);
      const buyer = extractVendor(clause);

      if (effectiveTag && amount && /\b(cow|bull|heifer|steer|calf|#\w+)\b/i.test(clause)) {
        actions.push({
          type: 'sale',
          cow_tag: effectiveTag,
          amount,
          buyer,
          notes: clause,
        });
        continue;
      }

      if (amount) {
        const isHay = /\b(hay|bale|crop|alfalfa)\b/i.test(clause);
        actions.push({
          type: 'transaction',
          transaction_type: 'INCOME',
          category: isHay ? 'HAY_CROP_SALE' : 'OTHER_INCOME',
          amount,
          vendor_or_buyer: buyer,
          notes: clause,
          summary: clause,
          log_category: isHay ? 'FEEDING' : 'GENERAL',
        });
        continue;
      }
    }

    // 3. Breeding detection
    if (/\b(bred|inseminated|ai'd|ai’d|covered\s+by|confirmed\s+pregnant|preg\s*check(ed)?\s+positive)\b/i.test(clause) && effectiveTag) {
      const sireMatch = clause.match(/\b(?:by|to)\s+(?:bull\s*)?#?([A-Za-z0-9-]+)\b/i);
      actions.push({
        type: 'breeding',
        cow_tag: effectiveTag,
        sire_tag: sireMatch ? sireMatch[1] : undefined,
        notes: clause,
      });
      continue;
    }

    // 4. Health / Treatment detection
    const matchedTreatment = KNOWN_TREATMENTS.find((t) => t.pattern.test(clause));
    const hasHealthKeyword =
      Boolean(matchedTreatment) ||
      /\b(shot\s+of|gave\s+(?:her|him|cow|bull|calf|steer|heifer)?\s*.*?\b(?:ml|cc|dose)|treated|antibiotic|injured|limping|lame|sick|pinkeye|scours|calving\s+assist|vet\s+check)\b/i.test(
        clause
      );

    if (hasHealthKeyword && effectiveTag) {
      let treatmentName = matchedTreatment?.name;
      if (!treatmentName) {
        const shotMatch = clause.match(/\b(?:shot\s+of|gave\s+(?:her|him)?\s*|treated\s+with\s+)([A-Za-z0-9\s-]{2,28})/i);
        treatmentName = shotMatch ? shotMatch[1].trim().replace(/\s+(for|at|this|today).*$/i, '') : 'Treatment / Checkup';
      }

      const dosageMatch = clause.match(/\b(\d+(?:\.\d+)?\s*(?:ml|cc|mg|g|oz|bolus|tablet|dose)s?)\b/i);
      const withdrawalMatch = clause.match(/\b(\d+)\s*-?\s*day\s+withdrawal\b/i);
      const markSick = /\b(sick|limping|lame|fever|scours|pinkeye|pneumonia|injured|ill|down)\b/i.test(clause);

      const healthType: HealthType = matchedTreatment?.type
        ?? (/\b(injur|cut|limp|lame|hoof|wound)\b/i.test(clause)
          ? 'INJURY'
          : /\b(calving\s+assist|pulled\s+calf)\b/i.test(clause)
          ? 'CALVING_ASSIST'
          : /\b(checkup|exam|vet\s+check)\b/i.test(clause)
          ? 'CHECKUP'
          : 'MEDICATION');

      actions.push({
        type: 'health',
        cow_tag: effectiveTag,
        health_type: healthType,
        treatment_name: treatmentName,
        dosage: dosageMatch ? dosageMatch[1] : undefined,
        withdrawal_days: withdrawalMatch
          ? Number(withdrawalMatch[1])
          : matchedTreatment?.defaultWithdrawalDays,
        mark_sick: markSick,
        notes: clause,
      });
      continue;
    }

    // 5. Financial transaction detection (spent / paid / bought / earned / received)
    const amount = extractAmount(clause);
    if (amount) {
      const isIncome = /\b(earned|received|paid\s+us|income|check\s+for|sold)\b/i.test(clause);
      const vendor = extractVendor(clause);
      const category: TransactionCategory = isIncome
        ? /\b(hay|bale|crop)\b/i.test(clause)
          ? 'HAY_CROP_SALE'
          : 'OTHER_INCOME'
        : inferExpenseCategory(clause);

      actions.push({
        type: 'transaction',
        transaction_type: isIncome ? 'INCOME' : 'EXPENSE',
        category,
        amount,
        vendor_or_buyer: vendor,
        cow_tag: clauseTag ?? undefined,
        notes: clause,
        summary: clause.charAt(0).toUpperCase() + clause.slice(1),
        log_category:
          category === 'FEED_HAY'
            ? 'FEEDING'
            : category === 'VET_MEDS'
            ? 'HEALTH_VET'
            : category === 'FENCING_REPAIRS'
            ? 'FENCING_MAINTENANCE'
            : category === 'FUEL_EQUIPMENT'
            ? 'EQUIPMENT'
            : 'GENERAL',
      });
      continue;
    }

    // 6. General / Chore daily log fallback
    actions.push({
      type: 'log',
      category: inferLogCategory(clause),
      summary: clause.charAt(0).toUpperCase() + clause.slice(1),
      cow_tag: clauseTag ?? undefined,
    });
  }

  return actions;
}

/**
 * Optional LLM-powered parser using OpenAI Structured Outputs when OPENAI_API_KEY is configured.
 * Automatically falls back to deterministic parsing if key is absent or request fails.
 */
export async function parseTranscriptToActions(transcript: string): Promise<{
  actions: AIAction[];
  parser: 'openai' | 'deterministic';
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      actions: parseTranscriptDeterministic(transcript),
      parser: 'deterministic',
    };
  }

  try {
    const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You parse cattle ranch voice notes into a JSON object { "actions": [...] }.
Allowed action types:
1. {"type":"calving","dam_tag":"214","calf_sex":"BULL"|"HEIFER"|"CALF","calf_tag"?:string,"sire_tag"?:string,"notes":string}
2. {"type":"health","cow_tag":"214","health_type":"VACCINATION"|"MEDICATION"|"INJURY"|"CHECKUP"|"CALVING_ASSIST","treatment_name":string,"dosage"?:string,"withdrawal_days"?:number,"mark_sick"?:boolean,"notes":string}
3. {"type":"sale","cow_tag":"305","amount":number,"buyer"?:string,"notes":string}
4. {"type":"breeding","cow_tag":"104","sire_tag"?:string,"breeding_date"?:string,"notes":string}
5. {"type":"transaction","transaction_type":"INCOME"|"EXPENSE","category":"CATTLE_SALE"|"HAY_CROP_SALE"|"OTHER_INCOME"|"FEED_HAY"|"VET_MEDS"|"FUEL_EQUIPMENT"|"FENCING_REPAIRS"|"LABOR"|"UTILITIES_PROPERTY"|"OTHER_EXPENSE","amount":number,"vendor_or_buyer"?:string,"cow_tag"?:string,"summary"?:string,"log_category"?:string,"notes":string}
6. {"type":"log","category":"CALVING"|"HEALTH_VET"|"FEEDING"|"FENCING_MAINTENANCE"|"PASTURE_ROTATION"|"EQUIPMENT"|"GENERAL","summary":string,"cow_tag"?:string}
7. {"type":"cow_update","cow_tag":string,"status"?:"ACTIVE"|"PREGNANT"|"NURSING"|"SICK"|"SOLD"|"DECEASED","notes"?:string}
Resolve pronouns ("her", "him") to the previously mentioned cow tag. Output valid JSON only.`,
          },
          {
            role: 'user',
            content: transcript,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI HTTP ${response.status}`);
    }

    const payload = await response.json();
    const rawContent = payload?.choices?.[0]?.message?.content;
    if (!rawContent) {
      throw new Error('Empty OpenAI response');
    }

    const parsed = JSON.parse(rawContent);
    const candidateActions = Array.isArray(parsed?.actions) ? parsed.actions : [];
    const validated: AIAction[] = [];

    for (const item of candidateActions) {
      const check = aiActionSchema.safeParse(item);
      if (check.success) {
        validated.push(check.data);
      }
    }

    if (validated.length > 0) {
      return { actions: validated, parser: 'openai' };
    }
  } catch (err) {
    console.warn('[GRanch AI Parser] Falling back to deterministic parser:', err);
  }

  return {
    actions: parseTranscriptDeterministic(transcript),
    parser: 'deterministic',
  };
}
