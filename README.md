# GRanch — Cattle & Ranch Operations Web App

A mobile-first, high-contrast Progressive Web App (PWA) and REST API built for outdoor cattle & ranch operations. Designed to be driven primarily by **Instinct AI** via voice/text commands while providing a fast, sunlight-legible UI with large touch targets for manual field review and overrides.

## Tech Stack
- **Frontend:** Next.js (App Router) + React 19 + Tailwind CSS + PWA (`manifest.json` + service worker)
- **Backend & Database:** Prisma ORM + SQLite (strict relational foreign keys & atomic multi-table transactions; swap `provider = "postgresql"` in `prisma/schema.prisma` for PostgreSQL)
- **Validation & Security:** Zod schema validation + constant-time `Authorization: Bearer <AI_API_KEY>` protection on all `/api/ai/*` endpoints
- **AI Integration:** OpenAI Structured Output parser (when `OPENAI_API_KEY` is configured) with a built-in deterministic ranch-domain NLP fallback parser that runs out of the box without any external API key

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env

# 3. Create database tables & seed realistic ranch sample data
npm run db:push
npm run db:seed

# 4. Run the development server
npm run dev
```

Open `http://localhost:3000` on desktop or mobile (supports "Add to Home Screen" as a PWA).

### Sample Seed Data Included (`prisma/seed.ts`)
- **15 cattle** across cows, bulls, calves, steers, and pregnant heifers (including lineage via `dam_id`/`sire_id`, expected due dates within 30 days, a sick cow with active withdrawal hold, and a sold steer)
- **6 health records** (including active Draxxin & Penicillin withdrawal periods)
- **10 daily logs** across Calving, Health/Vet, Feeding, Fencing, Pasture Rotation, Equipment, and General
- **8 cash-flow transactions** across Income & Expenses

---

## Environment Variables (`.env.example`)

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | SQLite file path (`file:./dev.db`) or PostgreSQL connection URL |
| `AI_API_KEY` | Yes | Bearer token checked on all `/api/ai/*` endpoints |
| `OPENAI_API_KEY` | No | Optional OpenAI key for LLM structured parsing on `/api/ai/ingest` (falls back to built-in deterministic parser if empty) |
| `OPENAI_MODEL` | No | OpenAI model name (default: `gpt-4o-mini`) |

---

## Connecting Instinct AI

Import the OpenAPI 3.1 schema directly from `GET /api/openapi` (also saved at `public/openapi.json`) or use the ready-to-import tool definitions in `docs/instinct-ai-tools.json`.

All `/api/ai/*` endpoints require:
```http
Authorization: Bearer <AI_API_KEY>
Content-Type: application/json
```

### 1. Multi-Action Voice/Text Logger — `POST /api/ai/ingest`

Executes calving, health/withdrawal, cattle sales, breeding, expenses, and farm chores **in a single atomic database transaction** and returns a concise spoken-ready confirmation string.

**Natural-Language Transcript Example:**
```bash
curl -X POST http://localhost:3000/api/ai/ingest \
  -H "Authorization: Bearer granch-instinct-dev-key-change-me" \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "Cow 214 had a bull calf this morning, gave her a shot of penicillin, and spent $320 on hay at the co-op"
  }'
```

**Sample Response (`201 Created`):**
```json
{
  "ok": true,
  "parser": "deterministic",
  "message": "Logged: Bull calf (#214-C1) born to Cow #214, Penicillin treatment recorded for #214, and $320.00 Feed & Hay expense added.",
  "results": {
    "cows_created": [{ "tag_number": "214-C1", "category": "CALF", "status": "ACTIVE" }],
    "cows_updated": [{ "tag_number": "214", "status": "NURSING" }],
    "health_records": [{ "treatment_name": "Penicillin" }],
    "transactions": [{ "type": "EXPENSE", "category": "FEED_HAY", "amount": 320 }],
    "daily_logs": ["..."]
  }
}
```

**Structured JSON Actions Example:**
```bash
curl -X POST http://localhost:3000/api/ai/ingest \
  -H "Authorization: Bearer granch-instinct-dev-key-change-me" \
  -H "Content-Type: application/json" \
  -d '{
    "raw_transcript": "Sold steer 205 at Livestock Auction for $1920",
    "actions": [
      { "type": "sale", "cow_tag": "205", "amount": 1920, "buyer": "Livestock Auction" }
    ]
  }'
```

### 2. Natural-Language & Structured Ranch Query — `POST /api/ai/query`

**Natural-Language Compound Question:**
```bash
curl -X POST http://localhost:3000/api/ai/query \
  -H "Authorization: Bearer granch-instinct-dev-key-change-me" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How many cows are pregnant and what did I spend on feed this month?"
  }'
```

**Structured Action Query:**
Supported `action` values: `herd_summary`, `due_dates`, `cow_lookup`, `financial_summary`, `recent_logs`, `sick_and_withdrawals`.

```bash
curl -X POST http://localhost:3000/api/ai/query \
  -H "Authorization: Bearer granch-instinct-dev-key-change-me" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "cow_lookup",
    "params": { "tag_number": "108" }
  }'
```

### 3. Direct REST CRUD Endpoints
- `/api/cows` (`GET`, `POST`) & `/api/cows/:id` (`GET`, `PATCH`, `DELETE`) — auto-calculates `expected_due_date = breeding_date + 283 days`
- `/api/health` (`GET`, `POST`) & `/api/health/:id` (`GET`, `PATCH`, `DELETE`) — auto-calculates `safe_to_sell_date = date + withdrawal_days`
- `/api/logs` (`GET`, `POST`) & `/api/logs/:id` (`GET`, `PATCH`, `DELETE`)
- `/api/transactions` (`GET`, `POST`) & `/api/transactions/:id` (`GET`, `PATCH`, `DELETE`) — `CATTLE_SALE` linked to a `cow_id` atomically updates that cow's status to `SOLD`
- `/api/dashboard` (`GET`) — live herd KPIs, withdrawal alerts, cash-flow snapshot, and recent 5 logs
- `/api/openapi` (`GET`) — OpenAPI 3.1.0 specification

---

## Switching to PostgreSQL

1. Update `datasource db` in `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Set `DATABASE_URL="postgresql://user:password@host:5432/granch"` in `.env`.
3. Run `npm run db:push && npm run db:seed`.
