# AI Gift Finder

A production-ready AI-powered gift recommendation platform with automated catalog ingestion, vendor analytics, and a Tinder-style swipe experience.

## Features

- 🎁 **Smart Gift Questionnaire** – multi-step form to capture recipient preferences
- 🤖 **Hybrid Recommendation Engine** – vector retrieval + rule ranking with optional LLM re-rank
- 👆 **Tinder-Style Swipe Interface** – swipe left/right/save with realtime scoring & reroll caching
- 📥 **Automated Catalog Ingestion** – Rainforest (Amazon) + eBay APIs with enrichment & availability refresh
- 📊 **Vendor Analytics & Billing** – Stripe subscription tiers, vendor dashboard metrics, curated boosts
- 🔗 **Affiliate Support** – Amazon, eBay, Etsy link localization with region-aware tracking

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes (Node runtime), Prisma ORM
- **Database**: Supabase PostgreSQL + pgvector
- **AI**: OpenAI embeddings + optional rerank model
- **Payments**: Stripe Checkout & Billing Portal
- **Deployment**: Vercel + cron-style API triggers

## Prerequisites

- Node.js 18+
- Supabase project with pgvector enabled
- OpenAI API key
- Stripe account (with subscription price IDs)
- Rainforest API key & eBay developer credentials
- Amazon Associates / Etsy IDs (optional)

## Installation

```bash
git clone https://github.com/yourusername/ai-gift-finder.git
cd ai-gift-finder
npm install
cp env.example .env.local
```

Populate `.env.local` (see [docs/CURRENT_ENV_SETUP.md](docs/CURRENT_ENV_SETUP.md)).

### Database Setup

```sql
-- Supabase SQL editor
create extension if not exists vector;
```

```bash
npx prisma generate
npx prisma migrate dev
```

To create recommended indexes: `psql < sql/setup-indexes.sql` or run in Supabase SQL editor.

## Running Locally

```bash
npm run dev
# optional helpers
npm run enrich         # enriches products via OpenAI
npm run ingest         # full API ingestion (rainforest + eBay)
npm run recs:lint      # lint recommendation modules
```

Visit http://localhost:3000

## Project Structure (excerpt)

```
├── app/
│   ├── api/
│   │   ├── recommend/            – recommendation endpoint
│   │   ├── recommend-more/       – pagination/reroll endpoint
│   │   ├── refresh/availability/ – nightly stock refresh API
│   │   ├── admin/curation/       – curated boost CRUD
│   │   └── vendor/...            – vendor analytics + billing
│   ├── page.tsx                  – main landing page
│   └── vendor/dashboard/page.tsx – vendor portal
├── components/
│   ├── GiftForm.tsx, SwipeDeck.tsx, ProductCard.tsx, etc.
├── docs/                        – ops guides & rollout plans
├── lib/
│   ├── recs/                    – recommendation engine modules
│   ├── providers/               – Rainforest/eBay ingestion providers
│   ├── geo.ts, affiliates.ts    – localization helpers
│   └── ...
├── prisma/schema.prisma
├── scripts/
│   ├── ingest-from-apis.ts      – ingestion orchestrator
│   ├── enrich-products.ts       – LLM enrichment
│   └── nightly-refresh.ts       – cron orchestrator
└── sql/setup-indexes.sql
```

## Key API Endpoints

- `POST /api/recommend` – generate recommendations
- `POST /api/recommend-more` – fetch additional results for rerolls/pagination
- `POST /api/swipe` – record swipe/like/save interactions
- `POST /api/admin/curation` – create curated boosts (admin)
- `GET /api/admin/curation` – list boosts
- `DELETE /api/admin/curation?id=...` – remove a boost
- `POST /api/refresh/availability` – refresh stock/pricing via cron
- `GET /api/vendor/stats` – vendor analytics (auth required)

## Deployment

1. Push to GitHub, import into Vercel
2. Configure environment variables (match `.env.local`)
3. Set `RECS_LLM_RERANK_ENABLED`, `RECS_CURATED_BOOSTS_ENABLED`, etc.
4. Deploy via `vercel --prod`
5. Schedule availability + enrichment runs using Vercel cron or external scheduler hitting `/api/refresh/availability`

```bash
npx prisma migrate deploy
npm run enrich
npm run ingest:rainforest
npm run ingest:ebay
```

## Testing

Comprehensive test suite covering unit, integration, E2E, and SEO validation. See [docs/TESTING.md](docs/TESTING.md) for detailed guide.

### Quick Test Commands

```bash
# Run unit tests
npm test

# Run E2E tests
npm run test:e2e

# Generate coverage report
npm run test:coverage

# Run all tests (unit + E2E)
npm run test:all

# Pre-push validation (Windows)
.\scripts\pre-push-tests.ps1

# Pre-push validation (Linux/Mac)
./scripts/pre-push-tests.sh
```

### Test Coverage
- ✅ Unit tests for core utilities (currency, prices, middleware)
- ✅ Integration tests for API endpoints
- ✅ E2E tests for user journeys (Playwright)
- ✅ SEO validation tests
- ✅ Currency switching and localization
- ✅ Performance and accessibility checks

### Manual Testing Checklist
- [ ] Landing form → recommendations → swipe interactions
- [ ] Currency switching (USD → GBP → EUR)
- [ ] Gift guides load correctly
- [ ] Vendor signup → choose plan → Stripe checkout
- [ ] Vendor dashboard metrics & curated boosts
- [ ] Mobile responsiveness
- [ ] SEO meta tags and structured data

## Operations & Runbooks

- [docs/OPS_RUNBOOK.md](docs/OPS_RUNBOOK.md) – cron jobs, scripts, recovery steps
- [docs/VENDOR_PORTAL_GUIDE.md](docs/VENDOR_PORTAL_GUIDE.md) – onboarding vendors & tier benefits
- [docs/testing-rollout-plan.md](docs/testing-rollout-plan.md) – testing + rollout guardrails

## Contributing

1. Fork & branch (`git checkout -b feature/foo`)
2. `npm run lint && npm test`
3. Submit PR

## License

MIT – see LICENSE 