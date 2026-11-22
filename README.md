# GRanch — Cattle & Ranch Operations Web App & Instinct AI API

A mobile-first, high-contrast Progressive Web App (PWA) and relational PostgreSQL REST API built for outdoor cattle & ranch operations. Designed to be operated primarily by **Instinct AI** via voice/text commands while providing a clean, sunlight-legible UI for manual field review and quick edits.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Farbonomous%2FGRanch&env=DATABASE_URL,AI_API_KEY&envDescription=PostgreSQL%20DATABASE_URL%20and%20secret%20AI_API_KEY%20for%20Instinct%20AI&project-name=granch&repository-name=GRanch)

---

## Table of Contents
1. [2-Minute Cloud Deployment (Vercel or Railway)](#cloud-deployment-vercel--railway--render)
2. [Instinct AI Handoff & Integration Guide](#instinct-ai-handoff--integration-guide)
3. [Endpoint Reference: `/api/ai/ingest` (Atomic Multi-Action Writer)](#1-post-apiaiingest-atomic-multi-action-writer)
4. [Endpoint Reference: `/api/ai/query` (Ranch Read & Reporting)](#2-post-apiaiquery-ranch-read--reporting)
5. [Standard REST CRUD Endpoints](#3-standard-rest-crud-endpoints)
6. [Database Schema & Allowed Enum Values](#database-schema--allowed-enum-values)
7. [Environment Variables](#environment-variables)
8. [Local Setup & Seed Data](#local-setup--seed-data)

---

## Instinct AI Handoff & Integration Guide

### Machine-Readable Schemas
- **OpenAPI 3.1.0 Spec (Protected):** `GET /api/openapi` — requires `Authorization: Bearer <AI_API_KEY>` (or signed-in owner session). Source file: `src/lib/openapi.json`.
- **Tool / Function Definitions:** `docs/instinct-ai-tools.json`

### Authentication & Access Matrix (All Routes Locked Down)
GRanch fails closed until `RANCH_PASSCODE` is configured. Every UI route and API route requires authentication:

| Route Group | Auth Accepted | Notes |
| --- | --- | --- |
| UI pages (`/`, `/herd`, `/logs`, `/finances`) | Signed 30-day `HttpOnly` cookie (`RANCH_PASSCODE` via `/login`) | Brute-force rate-limited in Postgres (5 failed attempts / 15 min per IP). |
| `POST /api/ai/ingest` & `POST /api/ai/query` | `Authorization: Bearer <AI_API_KEY>` **or** owner session | Supports `Idempotency-Key` header on `/api/ai/ingest` and writes every call to `ai_audit_logs`. |
| `GET / POST / PATCH` on `/api/cows`, `/api/health`, `/api/logs`, `/api/transactions`, `/api/dashboard`, `/api/openapi` | `Authorization: Bearer <AI_API_KEY>` **or** owner session | Constant-time token verification (`401` if unauthenticated). |
| `DELETE` on all CRUD routes + `/api/admin/*` (Export, Audit Log, Clear Sample Data) | **Owner session ONLY** | Instinct AI Bearer tokens receive `403 Forbidden` so an AI agent can never delete cattle or financial records. |

Every external Instinct AI request must include:

```http
Authorization: Bearer <AI_API_KEY>
Content-Type: application/json
Idempotency-Key: <optional-unique-request-id>   # recommended on POST /api/ai/ingest
```

### Recommended Agent Routing Rules for Instinct AI
1. **Logging ranch events (voice or text):** Call `POST /api/ai/ingest` with a unique `Idempotency-Key` header so network retries never double-log calves or expenses.
   - Pass `{ "transcript": "<user's raw utterance>" }` for automatic multi-action parsing, **or** pass pre-parsed `{ "actions": [...], "raw_transcript": "<utterance>" }` for deterministic execution.
   - Read the returned `message` string directly back to the user as confirmation.
2. **Answering ranch questions:** Call `POST /api/ai/query`.
   - Pass `{ "question": "<user's question>" }` for compound natural-language queries, **or** `{ "action": "<action>", "params": { ... } }` for deterministic structured lookups.
   - Read the returned `summary` string directly back to the user.
3. **Exact record lookups / updates:** Use `GET / POST / PATCH` on `/api/cows`, `/api/health`, `/api/logs`, `/api/transactions`. (`DELETE` is intentionally owner-only.)

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
| `DATABASE_URL` | Yes | `postgresql://...` | PostgreSQL connection string (Neon, Supabase, Vercel Postgres, Railway, or local Postgres). |
| `RANCH_PASSCODE` | Yes | *(set in Vercel)* | Passcode required on `/login` to unlock the GRanch web app (app fails closed until configured). |
| `AI_API_KEY` | Yes | `granch-instinct-dev-key-change-me` | **Change in production.** Secret Bearer token for Instinct AI API access. |
| `SESSION_SECRET` | No | *(auto-derived)* | Optional dedicated HMAC secret for 30-day session cookies (derives via SHA-256 from `RANCH_PASSCODE + AI_API_KEY` if omitted). |
| `SEED_ON_EMPTY` | No | `true` | Automatically seeds 15 sample cattle, 10 logs, and 8 transactions on first cloud deploy if the database is empty. Never overwrites existing cattle on future deploys. Set to `false` to start blank. |
| `OPENAI_API_KEY` | No | *(empty)* | Optional OpenAI key for LLM-powered parsing on `/api/ai/ingest`. Falls back to built-in deterministic parser if unset. |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | Model used when `OPENAI_API_KEY` is provided. |

---

## Local Setup & Seed Data

```bash
git clone https://github.com/arbonomous/GRanch.git
cd GRanch
npm install
cp .env.example .env
# Set DATABASE_URL in .env to your PostgreSQL URL
npm run db:push
npm run db:seed
npm run dev
```

### NPM Scripts
- `npm run dev` — Start Next.js development server on port 3000
- `npm run build` / `npm run start` — Runs `scripts/cloud-prepare.mjs` (Prisma generate + automatic PostgreSQL `db push` + safe `--if-empty` seed) and builds/starts Next.js
- `npm run db:push` — Sync `prisma/schema.prisma` to PostgreSQL
- `npm run db:seed` — Seed realistic ranch sample data (15 cattle, 6 health records, 10 daily logs, 8 transactions)
- `npm run db:seed:if-empty` — Seed sample data only if the `cows` table has 0 rows
- `npm run db:reset` — Wipe and re-seed the database cleanly

---

## Cloud Deployment (Vercel / Railway / Render)

`prisma/schema.prisma` is preconfigured for **PostgreSQL**, and `npm run build` automatically pushes the database tables and seeds sample data on first deploy (`--if-empty`, so subsequent deploys never overwrite live ranch data).

### Option A: Vercel + Neon Postgres (Free Tier, ~2 Minutes)
1. Click **Deploy with Vercel** above (or go to [vercel.com/new](https://vercel.com/new) and import `arbonomous/GRanch`).
2. Attach a free PostgreSQL database:
   - In Vercel, open **Storage → Create Database → Neon (Serverless Postgres)** (or paste a free `DATABASE_URL` from [neon.tech](https://neon.tech) / [supabase.com](https://supabase.com)).
3. Set Environment Variables in Vercel:
   - `DATABASE_URL` *(auto-filled if you use Vercel Storage / Neon integration)*
   - `AI_API_KEY` *(pick any strong secret string, e.g. `granch-prod-9f8e7d6c`)*
   - `OPENAI_API_KEY` *(optional)*
4. Click **Deploy**. On deploy, `scripts/cloud-prepare.mjs` automatically creates all 4 PostgreSQL tables and seeds the initial 15 cattle, 10 logs, and 8 transactions.
5. Open your live `https://<your-project>.vercel.app` URL on desktop or phone (tap **Add to Home Screen** to install as a PWA).
6. Connect **Instinct AI** to `https://<your-project>.vercel.app/api/openapi` (which automatically advertises your live HTTPS domain) with `Authorization: Bearer <AI_API_KEY>`.

### Option B: Railway (~2 Minutes)
1. Go to [railway.com/new](https://railway.com/new) → **Deploy from GitHub repo** → select `arbonomous/GRanch`.
2. Click **+ New → Database → Add PostgreSQL**.
3. In the GRanch service **Variables** tab, add:
   - `DATABASE_URL=${{Postgres.DATABASE_URL}}`
   - `AI_API_KEY=<your-secret-key>`
4. Click **Generate Domain** under Settings → Networking to get your live HTTPS URL.

---

## UI Views (4-Tab Mobile PWA)
- **Overview (`/`)**: Live herd KPI matrix, Due ≤30d & Sick/Withdrawal left-rail alert cards, Month/YTD cash flow, recent 5 activity logs, and built-in **Instinct AI Console** header drawer.
- **Herd (`/herd` & `/herd/[id]`)**: Instant tag search, filter pills, `+ Add Animal`, `Quick Edit`, 283-day due countdown, withdrawal holds, clickable Dam/Sire/Calves lineage, medical history timeline, and associated logs.
- **Daily Log (`/logs`)**: Date-grouped timeline (`Today`, `Yesterday`, etc.), category filters, expandable Instinct AI voice transcripts, and clickable Cow Tag / Transaction links.
- **Finances (`/finances`)**: `This Month` / `This Year` / `All Time` summary strip, color-coded cash-flow ledger, and `+ Log Transaction`.
