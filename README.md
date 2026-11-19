# GRanch — Cattle & Ranch Operations Web App & Instinct AI API

A mobile-first, high-contrast Progressive Web App (PWA) and relational REST API built for outdoor cattle & ranch operations. Designed to be operated primarily by **Instinct AI** via voice/text commands while providing a clean, sunlight-legible UI for manual field review and quick edits.

---

## Table of Contents
1. [Instinct AI Handoff & Integration Guide](#instinct-ai-handoff--integration-guide)
2. [Endpoint Reference: `/api/ai/ingest` (Atomic Multi-Action Writer)](#1-post-apiaiingest-atomic-multi-action-writer)
3. [Endpoint Reference: `/api/ai/query` (Ranch Read & Reporting)](#2-post-apiaiquery-ranch-read--reporting)
4. [Standard REST CRUD Endpoints](#3-standard-rest-crud-endpoints)
5. [Database Schema & Allowed Enum Values](#database-schema--allowed-enum-values)
6. [Environment Variables](#environment-variables)
7. [Local Setup & Seed Data](#local-setup--seed-data)
8. [Cloud Deployment (Vercel / Railway / Render)](#cloud-deployment-vercel--railway--render)

---

## Instinct AI Handoff & Integration Guide

### Machine-Readable Schemas
- **OpenAPI 3.1.0 Spec:** `GET /api/openapi` (source file: `public/openapi.json`)
- **Tool / Function Definitions:** `docs/instinct-ai-tools.json`

### Authentication (Required on All `/api/ai/*` Routes)
Every request to `/api/ai/ingest` and `/api/ai/query` must include:

```http
Authorization: Bearer <AI_API_KEY>
Content-Type: application/json
```

- Verified using constant-time comparison (`crypto.timingSafeEqual`) against `process.env.AI_API_KEY`.
- Missing or invalid tokens return `401 Unauthorized` with `{ "error": "..." }`.

### Recommended Agent Routing Rules for Instinct AI
1. **Logging ranch events (voice or text):** Call `POST /api/ai/ingest`.
   - Pass `{ "transcript": "<user's raw utterance>" }` for automatic multi-action parsing, **or** pass pre-parsed `{ "actions": [...], "raw_transcript": "<utterance>" }` for deterministic execution.
   - Read the returned `message` string directly back to the user as confirmation.
2. **Answering ranch questions:** Call `POST /api/ai/query`.
   - Pass `{ "question": "<user's question>" }` for compound natural-language queries, **or** `{ "action": "<action>", "params": { ... } }` for deterministic structured lookups.
   - Read the returned `summary` string directly back to the user.
3. **Exact record lookups / manual overrides / deletes:** Use the standard REST endpoints (`/api/cows`, `/api/health`, `/api/logs`, `/api/transactions`).

---

## 1. `POST /api/ai/ingest` (Atomic Multi-Action Writer)

Executes one or more ranch actions inside a **single atomic Prisma database transaction** (`prisma.$transaction`). If any step fails (e.g., an unknown tag on a health/sale update), the entire transaction rolls back cleanly.

### Mode A: Natural-Language Voice Transcript
When `OPENAI_API_KEY` is configured, GRanch parses the transcript with OpenAI JSON structured outputs (`OPENAI_MODEL`, default `gpt-4o-mini`). When `OPENAI_API_KEY` is omitted, GRanch automatically uses its built-in deterministic ranch NLP parser (`src/lib/ai-parser.ts`).

```bash
curl -X POST https://<YOUR_DOMAIN>/api/ai/ingest \
  -H "Authorization: Bearer <AI_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "Cow 214 had a bull calf this morning, gave her a shot of penicillin, and spent $320 on hay at the co-op"
  }'
```

**Response (`201 Created`):**
```json
{
  "ok": true,
  "parser": "deterministic",
  "parsed_actions": [
    { "type": "calving", "dam_tag": "214", "calf_sex": "BULL", "notes": "Cow 214 had a bull calf this morning" },
    { "type": "health", "cow_tag": "214", "health_type": "MEDICATION", "treatment_name": "Penicillin", "withdrawal_days": 10, "mark_sick": false },
    { "type": "transaction", "transaction_type": "EXPENSE", "category": "FEED_HAY", "amount": 320, "vendor_or_buyer": "Co-op" }
  ],
  "message": "Logged: Bull calf (#214-C1) born to Cow #214, Penicillin treatment recorded for #214, and $320.00 Feed & Hay expense added.",
  "results": {
    "cows_created": [{ "id": "...", "tag_number": "214-C1", "category": "CALF", "status": "ACTIVE" }],
    "cows_updated": [{ "id": "...", "tag_number": "214", "status": "NURSING" }],
    "health_records": [{ "id": "...", "cow_id": "...", "treatment_name": "Penicillin", "safe_to_sell_date": "..." }],
    "transactions": [{ "id": "...", "type": "EXPENSE", "category": "FEED_HAY", "amount": 320, "vendor_or_buyer": "Co-op" }],
    "daily_logs": [{ "id": "...", "category": "CALVING", "summary": "..." }]
  }
}
```

### Mode B: Structured JSON `actions` Array
Instinct AI can send pre-parsed deterministic actions directly (and optionally include `raw_transcript` to preserve the original voice note in `daily_logs`):

```json
{
  "raw_transcript": "Sold steer 205 at Livestock Auction for $1920",
  "actions": [
    {
      "type": "sale",
      "cow_tag": "205",
      "amount": 1920,
      "buyer": "Livestock Auction",
      "notes": "860 lbs"
    }
  ]
}
```

#### Supported Structured Action Types & Atomic Side Effects

| `type` | Required Fields | Optional Fields | Atomic Database Side Effects |
| --- | --- | --- | --- |
| `calving` | `dam_tag` | `calf_tag`, `calf_name`, `calf_sex` (`BULL`\|`HEIFER`\|`CALF`), `calf_breed`, `sire_tag`, `birth_date`, `notes` | Creates new `CALF` linked to `dam_id` (and `sire_id`), auto-generates unique tag (`<dam_tag>-C1`) if omitted, sets dam status to `NURSING` and clears `expected_due_date`, creates `CALVING` daily log. |
| `health` | `cow_tag`, `treatment_name` | `health_type` (default `MEDICATION`), `dosage`, `withdrawal_days`, `date`, `mark_sick` (boolean), `notes` | Creates `health_records` row, auto-calculates `safe_to_sell_date = date + withdrawal_days`, sets cow status to `SICK` if `mark_sick: true`, creates `HEALTH_VET` daily log. |
| `sale` | `cow_tag`, `amount` | `buyer`, `date`, `notes` | Sets cow status to `SOLD`, creates `INCOME` (`CATTLE_SALE`) transaction linked to `cow_id`, creates linked `daily_logs` entry. |
| `breeding` | `cow_tag` | `breeding_date` (default today), `sire_tag`, `notes` | Sets cow status to `PREGNANT`, sets `breeding_date`, auto-calculates `expected_due_date = breeding_date + 283 days`, creates daily log. |
| `transaction` | `transaction_type` (`INCOME`\|`EXPENSE`), `category`, `amount` | `vendor_or_buyer`, `cow_tag`, `date`, `notes`, `summary`, `log_category` | Creates `transactions` row; if `category == "CATTLE_SALE"` and `cow_tag` is set, marks cow `SOLD`; creates linked `daily_logs` entry. |
| `cow_update` | `cow_tag` | `status`, `category`, `name`, `breed`, `notes` | Updates cow fields and creates a `GENERAL` daily log. |
| `log` | `summary` | `category` (default `GENERAL`), `cow_tag`, `timestamp` | Creates `daily_logs` row linked to `cow_id` if `cow_tag` matches. |

---

## 2. `POST /api/ai/query` (Ranch Read & Reporting)

Returns both structured JSON (`data`) and a concise, spoken-ready reply string (`summary`).

### Mode A: Natural-Language Compound Question
```bash
curl -X POST https://<YOUR_DOMAIN>/api/ai/query \
  -H "Authorization: Bearer <AI_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How many cows are pregnant and what did I spend on feed this month?"
  }'
```

**Response (`200 OK`):**
```json
{
  "ok": true,
  "question": "How many cows are pregnant and what did I spend on feed this month?",
  "summary": "4 pregnant total; 3 due within 30 days: #214 (Nov 22, 2026, in 3d), #104 (Dec 1, 2026, in 12d), #Yellow-12 (Dec 7, 2026, in 18d). You spent $640.00 on Feed & Hay this month (1 entry).",
  "data": { "due_dates": { "...": "..." }, "financial_summary": { "...": "..." } }
}
```

### Mode B: Structured Query Actions
```bash
curl -X POST https://<YOUR_DOMAIN>/api/ai/query \
  -H "Authorization: Bearer <AI_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "cow_lookup",
    "params": { "tag_number": "108" }
  }'
```

| `action` | `params` | Returns |
| --- | --- | --- |
| `herd_summary` | *(none)* | Active head count breakdown by category, pregnant/due ≤30d, sick, and active withdrawals. |
| `due_dates` | `days` (default `30`) | All pregnant animals sorted by `expected_due_date` with days remaining. |
| `cow_lookup` | `tag_number` (required) | Full animal profile: status, due date, active withdrawal, dam/sire/calves lineage, health history, logs. |
| `financial_summary` | `timeframe` (`month`\|`year`\|`all`), `category` (optional) | Total income, total expenses, net P&L, category breakdown, and matching transactions. |
| `recent_logs` | `limit` (default `10`), `category` (optional) | Most recent `daily_logs` entries. |
| `sick_and_withdrawals` | *(none)* | All `SICK` animals + all active medication withdrawal holds with `safe_to_sell_date`. |

---

## 3. Standard REST CRUD Endpoints

| Resource | Endpoints | Built-In Business Logic |
| --- | --- | --- |
| **Dashboard** | `GET /api/dashboard` | Live herd KPIs, withdrawal alerts, Month/YTD cash flow, last 5 logs. |
| **Herd** | `GET / POST /api/cows`<br>`GET / PATCH / DELETE /api/cows/:id` | Supports `?q=`, `?filter=` (`all`, `active`, `cows`, `bulls`, `calves`, `pregnant`, `due_soon`, `sick`, `withdrawal`, `sick_or_withdrawal`, `sold`), `?tag_number=`, `?category=`, `?status=`. Auto-calculates `expected_due_date = breeding_date + 283 days`. |
| **Health** | `GET / POST /api/health`<br>`GET / PATCH / DELETE /api/health/:id` | Supports `?cow_id=`, `?active_withdrawal=true`. Auto-calculates `safe_to_sell_date = date + withdrawal_days`. Optional `mark_sick` and automatic `HEALTH_VET` daily log creation. |
| **Daily Logs** | `GET / POST /api/logs`<br>`GET / PATCH / DELETE /api/logs/:id` | Supports `?category=`, `?cow_id=`, `?limit=`. |
| **Finances** | `GET / POST /api/transactions`<br>`GET / PATCH / DELETE /api/transactions/:id` | Supports `?timeframe=month\|year\|all`, `?type=`, `?category=`. Atomic rule: `CATTLE_SALE` with a `cow_id` automatically sets that cow's status to `SOLD`. |
| **OpenAPI** | `GET /api/openapi` | Serves `public/openapi.json` (OpenAPI 3.1.0). |

---

## Database Schema & Allowed Enum Values

Defined in `prisma/schema.prisma` and strictly validated via Zod in `src/lib/validation.ts`:

### Tables & Foreign Keys
1. **`cows`**: `id` (UUID PK), `tag_number` (Unique, Indexed), `name`, `category`, `status`, `breed`, `birth_date`, `breeding_date`, `expected_due_date`, `dam_id` (FK → `cows.id`), `sire_id` (FK → `cows.id`), `notes`, `created_at`, `updated_at`.
2. **`health_records`**: `id` (UUID PK), `cow_id` (FK → `cows.id`, Cascade), `date`, `type`, `treatment_name`, `dosage`, `withdrawal_days`, `safe_to_sell_date`, `notes`, `created_at`.
3. **`daily_logs`**: `id` (UUID PK), `timestamp`, `category`, `summary`, `raw_transcript`, `cow_id` (FK → `cows.id`, SetNull), `transaction_id` (FK → `transactions.id`, SetNull), `created_at`.
4. **`transactions`**: `id` (UUID PK), `date`, `type`, `category`, `amount` (Decimal, 2dp), `vendor_or_buyer`, `cow_id` (FK → `cows.id`, SetNull), `notes`, `created_at`.

### Allowed Enum Values
- **`CowCategory`**: `COW`, `BULL`, `HEIFER`, `STEER`, `CALF`
- **`CowStatus`**: `ACTIVE`, `PREGNANT`, `NURSING`, `SICK`, `SOLD`, `DECEASED`
- **`HealthType`**: `VACCINATION`, `MEDICATION`, `INJURY`, `CHECKUP`, `CALVING_ASSIST`
- **`LogCategory`**: `CALVING`, `HEALTH_VET`, `FEEDING`, `FENCING_MAINTENANCE`, `PASTURE_ROTATION`, `EQUIPMENT`, `GENERAL`
- **`TransactionType`**: `INCOME`, `EXPENSE`
- **`TransactionCategory`**:
  - Income: `CATTLE_SALE`, `HAY_CROP_SALE`, `OTHER_INCOME`
  - Expense: `FEED_HAY`, `VET_MEDS`, `FUEL_EQUIPMENT`, `FENCING_REPAIRS`, `LABOR`, `UTILITIES_PROPERTY`, `OTHER_EXPENSE`

---

## Environment Variables

Copy `.env.example` to `.env`:

| Variable | Required | Default / Example | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | `file:./dev.db` | SQLite file path or PostgreSQL connection string (`postgresql://...`). |
| `AI_API_KEY` | Yes | `granch-instinct-dev-key-change-me` | **Change in production.** Secret Bearer token for all `/api/ai/*` routes. |
| `OPENAI_API_KEY` | No | *(empty)* | Optional OpenAI key for LLM-powered parsing on `/api/ai/ingest`. Falls back to built-in deterministic parser if unset. |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | Model used when `OPENAI_API_KEY` is provided. |

---

## Local Setup & Seed Data

```bash
git clone https://github.com/arbonomous/GRanch.git
cd GRanch
npm install
cp .env.example .env
npm run db:push
npm run db:seed
npm run dev
```

### NPM Scripts
- `npm run dev` — Start Next.js development server on port 3000
- `npm run build` / `npm run start` — Production build and start
- `npm run db:push` — Sync `prisma/schema.prisma` to the database
- `npm run db:seed` — Seed realistic ranch sample data (15 cattle, 6 health records, 10 daily logs, 8 transactions)
- `npm run db:reset` — Wipe and re-seed the database cleanly

---

## Cloud Deployment (Vercel / Railway / Render)

For **Instinct AI** to reach GRanch over public HTTPS and to install the PWA on your phone in the field, deploy to a cloud host with PostgreSQL:

### Vercel + PostgreSQL (Neon / Supabase / Vercel Postgres)
1. In `prisma/schema.prisma`, change the datasource provider from `sqlite` to `postgresql`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Import `arbonomous/GRanch` into Vercel and attach a managed PostgreSQL database (`DATABASE_URL`).
3. Add environment variables in Vercel Project Settings:
   - `DATABASE_URL` (PostgreSQL URL)
   - `AI_API_KEY` (generate a strong random secret and share it with Instinct AI)
   - `OPENAI_API_KEY` (optional)
4. Push schema & optional initial seed once against your production DB:
   ```bash
   DATABASE_URL="<PROD_POSTGRES_URL>" npx prisma db push
   # Optional sample data:
   DATABASE_URL="<PROD_POSTGRES_URL>" npm run db:seed
   ```
5. Point Instinct AI at `https://<your-vercel-domain>/api/openapi` (or configure `POST /api/ai/ingest` and `POST /api/ai/query` with `Authorization: Bearer <AI_API_KEY>`).

### Railway / Render
1. Connect `arbonomous/GRanch` and attach a PostgreSQL plugin (or mount a persistent disk if keeping SQLite).
2. Set `DATABASE_URL`, `AI_API_KEY`, and optionally `OPENAI_API_KEY`.
3. Set start command to `npx prisma db push && npm run start`.

---

## UI Views (4-Tab Mobile PWA)
- **Overview (`/`)**: Live herd KPI matrix, Due ≤30d & Sick/Withdrawal left-rail alert cards, Month/YTD cash flow, recent 5 activity logs, and built-in **Instinct AI Console** header drawer.
- **Herd (`/herd` & `/herd/[id]`)**: Instant tag search, filter pills, `+ Add Animal`, `Quick Edit`, 283-day due countdown, withdrawal holds, clickable Dam/Sire/Calves lineage, medical history timeline, and associated logs.
- **Daily Log (`/logs`)**: Date-grouped timeline (`Today`, `Yesterday`, etc.), category filters, expandable Instinct AI voice transcripts, and clickable Cow Tag / Transaction links.
- **Finances (`/finances`)**: `This Month` / `This Year` / `All Time` summary strip, color-coded cash-flow ledger, and `+ Log Transaction`.
