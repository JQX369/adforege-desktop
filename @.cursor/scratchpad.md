# Scratchpad

## Background and Motivation
Make catalog-first recommendations production-ready: reliable 12+ real products per request, fast, with affiliate-safe links.

## Key Challenges and Analysis
- Sparse/heterogeneous data; long-tail queries; intent ambiguity
- Cold-start and freshness for gift inventory
- Balancing performance and cost; vendor lock-in risks

## High-level Task Breakdown
1) Data & ingestion (done): schema, ingest API, CSV script
2) Retrieval & ranking (done): hybrid, filters, remove placeholders
3) Ops & UX polish (prod readiness): below

## Project Status Board
- [ ] Add click redirect logging + simple metrics (coverage, CTR)
- [ ] Add minimal admin moderation table UI (approve/reject inline)
- [ ] Add health checks and rate limiting on ingest/recommend
- [ ] Create seed CSV and ingest 200–500 items
- [ ] Smoke test deploy (Vercel + Prisma migrate deploy)
- [ ] Set up cron (nightly refresh) via Vercel/hosted scheduler
- [ ] Fix Prisma aggregation ordering in admin metrics API
- [ ] Replace vendor dashboard `<img>` with Next `<Image>`

## Current Status / Progress Tracking
- Core ingestion and hybrid ranking merged; env/docs updated

## Executor's Feedback or Assistance Requests
- Confirm preferred metrics sink (console/log drain vs. DB table)

## Lessons
- TBD
