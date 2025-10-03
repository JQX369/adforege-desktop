2025-10-03T00:20Z • [backend-architect] • Replaced vendor dashboard image with Next <Image> to satisfy lint, refactored Prisma aggregations for metrics API, and persisted product embeddings via relation to fix build. • Commit 6478f89 • next lint, npm run build pending Vercel
# Project Activity Log

## Entry
- Timestamp (UTC): 2025-10-03T12:10:00Z
- Prompt (verbatim): You are a principal engineer. Audit this repository for scalability, modularity, and long-term maintainability.

Context:
- Repo: {{repo_path_or_url}}
- Stack: {{frontend_stack}} + {{backend_stack}} + {{infra}}
- Targets: horizontal feature growth, low coupling, clean layering.

Tasks:
1) Map the architecture (1-paragraph overview + bullet list of modules, key deps, data flows).
2) Identify anti-patterns (tight coupling, god components, cross-layer leaks, circular deps, duplicated logic).
3) Check conventions (lint/format, naming, folder structure, state mgmt, error handling, logging, ENV config).
4) Review dependency health (versions, deprecations, security risk).
5) Suggest a refactor plan in 3 stages (Now/Next/Later) with risk, effort, and expected impact.

Output (JSON):
{
  "architecture_overview": "...",
  "key_modules": ["..."],
  "anti_patterns": [{"area":"", "issue":"","why_it_matters":"","evidence":""}],
  "conventions_gaps": [{"rule":"","files":[],"fix":""}],
  "dependency_findings": [{"pkg":"","current":"","latest":"","action":""}],
  "refactor_plan": {
    "now": [{"task":"","files":[],"est_hours":0,"risk":"low|med|high","impact":"low|med|high"}],
    "next": [...],
    "later": [...]
  }
}
Only propose changes that align with the stack and code you observe. Cite file paths for every finding.
- Current focus: Executed "Now" refactor tasks (shared Prisma client, saved drawer delete API, logging helper) from architecture audit
- Decisions:
  - Added `lib/prisma.ts` singleton; updated API/recs modules to import shared client
  - Implemented `DELETE /api/saved/[userId]` and aligned `SavedDrawer` remove action
  - Introduced `lib/log.ts` helper; swapped console logs in recommend, redirect, ingest, Stripe webhook routes
- Next step: Provide patch diffs and commit messages for Now tasks; hand off Next/Later plan
- Links (commits/PRs/artifacts): .cursor/scratchpad.md, lib/prisma.ts, app/api/saved/[userId]/route.ts, components/SavedDrawer.tsx, app/api/recommend/route.ts, app/api/r/route.ts, app/api/stripe/webhook/route.ts, app/api/admin/ingest/batch/route.ts
- Timestamp (UTC): 2025-08-14
- Prompt (verbatim): execute\n\nMy Favorite Aunty\njust change where name is written
- Current focus: Update site visible name and metadata title
- Decisions:
  - Brand text changed in header to "My Favorite Aunty"
  - Metadata title set to "My Favorite Aunty"
- Next step: None
- Links (commits/PRs/artifacts): components/site/SiteHeader.tsx, app/layout.tsx

## Entry
- Timestamp (UTC): 2025-08-14
- Prompt (verbatim): add a section to the home page bout the swiping feature\nuse the new swipesection image as the hero
- Current focus: Add SwipeSection and set hero to use Swipeingsection.png
- Decisions:
  - Added `components/site/SwipeSection.tsx` and included it on home when not swiping
  - Updated `components/site/Hero.tsx` to render `Swipeingsection.png` image
- Next step: None
- Links (commits/PRs/artifacts): components/site/SwipeSection.tsx, components/site/Hero.tsx, app/page.tsx
- Timestamp (UTC): 2025-08-14
- Prompt (verbatim): planner\n1. YES\n2. sounds good \n3. NO trial\n4. no\n5. Yes\n6. Yes
- Current focus: Plan vendor subscriptions, auth, dashboard, and conversion page
- Decisions:
  - Auth provider: Supabase Auth (Yes)
  - Plans: Basic $9/mo, Featured $39/mo, Premium $99/mo
  - Free trial: No
  - Keep one-time listing: No
  - Enable Stripe Customer Portal: Yes
  - Require login before purchase/dashboard: Yes
- Next step: Prepare environment/docs and schema plan in scratchpad; then create tasks for Executor
- Links (commits/PRs/artifacts): 

## Entry
- Timestamp (UTC): 2025-08-14
- Prompt (verbatim): execute
- Current focus: Begin Executor phase with env updates and schema planning
- Decisions:
  - Add Supabase public env keys; add Stripe Price ID envs
- Next step: Write tests first, then modify Prisma schema to add `Vendor` and `Product.vendorId`
- Links (commits/PRs/artifacts): 

## Entry
- Timestamp (UTC): 2025-08-14
- Prompt (verbatim): execute
- Current focus: Test runner setup completed (Vitest) with sample test
- Decisions:
  - Added vitest, coverage, alias for '@' in vitest config
- Next step: Write failing schema tests for `Vendor` and `Product.vendorId`, then implement migration
- Links (commits/PRs/artifacts): 

## Entry
- Timestamp (UTC): 2025-08-14
- Prompt (verbatim): execute
- Current focus: Prisma schema added `Vendor` model and `Product.vendorId`; migration created
- Decisions:
  - `Vendor` fields include plan and subscription status enums; nullable Stripe IDs
- Next step: Implement subscription checkout API with tests, then portal API
- Links (commits/PRs/artifacts): prisma/migrations/20250814183829_add_vendor_subscription/migration.sql

## Entry
- Timestamp (UTC): 2025-08-14
- Prompt (verbatim): yes ok
- Current focus: Implemented subscription checkout and billing portal APIs; added Supabase helper
- Decisions:
  - Require auth on both routes; create vendor row on demand; ensure Stripe customer exists
- Next step: Update Stripe webhook to track subscription lifecycle; then vendor landing page revamp
- Links (commits/PRs/artifacts): app/api/vendor/checkout/route.ts, app/api/vendor/portal/route.ts, lib/supabase.ts

## Entry
- Timestamp (UTC): 2025-08-17
- Prompt (verbatim): List of quality of life changes.


1. in the form (on the speacil requirmenets section)
  - change name from special requirements (Find near them)
  - Have the skip button change to a next button once typing begun

2. Change Name of brand to The Gift Aunty

3. add a section below the (AI-tailored picksHand-picked findsSwipe to refine) 3 cards)
 with the tag " Spend more time with them not searching for them" - maybe some ittaltics
 - leave room for a photo or put place holder

4. add sublty animations to elements on homescreen

5. Add Menu bar to be visiubal and universal on all pages.

6. Add number of products each plan gets (1) so we need to allow plan stacking etc
-- the point being you get it per product
- Current focus: Implement requested QoL UI/branding changes and plan stacking
- Decisions:
  - Renamed form step to "Find near them" and contextualized Skip→Next
  - Updated branding to "The Gift Aunty" in header, metadata, and vendor page copy
  - Added CTA section under features with italic quote and placeholder image area
  - Added subtle animations (fade-in, hover float) to home sections/cards
  - Made header universal by rendering in root layout
  - Enabled Stripe Checkout quantity for plan stacking and added quantity input on vendor page
- Next step: Adjust webhook/dashboard to reflect quantity as product slots
- Links (commits/PRs/artifacts): components/GiftForm.tsx, components/site/SiteHeader.tsx, app/layout.tsx, app/page.tsx, components/site/FeatureGrid.tsx, components/site/SwipeSection.tsx, app/vendor/page.tsx, app/api/vendor/checkout/route.ts, app/globals.css

## Entry
- Timestamp (UTC): 2025-08-29
- Prompt (verbatim): ok look up and find the best affilate programs to add, that either have propirotry API's -- or we can use appify - build a list so we can build the MVP
- Current focus: Research affiliate programs and compile API vs Apify MVP shortlist
- Decisions:
  - Created `@requirements/docs-index.md` with canonical API links for shortlisted programs
  - Created `@docs/affiliates-mvp-shortlist.md` with recommended MVP sets (API-first, network-first, Apify boost)
- Next step: Confirm preferred MVP set (A/B/C) and start applications/integrations
- Links (commits/PRs/artifacts): @requirements/docs-index.md, @docs/affiliates-mvp-shortlist.md

## Entry
- Timestamp (UTC): 2025-08-30
- Prompt (verbatim): remove these steps from the form to make it down to 9 questions\n-\nmake sure backend still wired up\n\nRemove:\nStep 7,10,12\n\n\nfor good mesure add one more catogry for step 9
- Current focus: Reduce GiftForm to 9 steps and keep backend compatibility
- Decisions:
  - Removed form steps for Living (7), Avoid (10), Context (12)
  - Added "Outdoors" to Interests options
  - Made GiftPrompt fields optional for removed steps; included safe fallbacks
- Next step: Confirm UX flow and counts reflect 9 steps across devices
- Links (commits/PRs/artifacts): components/GiftForm.tsx, prompts/GiftPrompt.ts

## Entry
- Timestamp (UTC): 2025-08-30
- Prompt (verbatim): F.1 - We must move up the home page to fill missing gap (Seem image 1) their is a gap between Header bar and main page.\n\nF.2 - Remove the hover animation when hovering over the swipe section image
- Current focus: Tighten header-to-content spacing and remove swipe image hover
- Decisions:
  - Reduced top padding in layout from pt-24 to pt-20 and hero from pt-12/20 to pt-10/16
  - Removed hover-float class from swipe section image container
- Next step: Visual QA across breakpoints to confirm spacing feels right
- Links (commits/PRs/artifacts): app/layout.tsx, components/site/Hero.tsx, components/site/SwipeSection.tsx

## Entry
 - Timestamp (UTC): 2025-09-16
 - Prompt (verbatim): execute
 - Current focus: Make catalog-first ingestion and hybrid recommendation ready
 - Decisions:
   - Extended Prisma schema with catalog quality fields; added Merchant and IngestionJob
   - Added admin batch ingestion API and CSV importer script
   - Updated recommend route to hybrid retrieval with strict filters; removed live search and placeholders
   - Documented new env vars; added moderation UI stub and nightly refresh stub
 - Next step: Seed 200–500 curated items via CSV and verify recommendations
 - Links (commits/PRs/artifacts): prisma/schema.prisma, app/api/admin/ingest/batch/route.ts, scripts/ingest-curated.ts, app/api/recommend/route.ts, scripts/nightly-refresh.ts, docs/CURRENT_ENV_SETUP.md, app/vendor/dashboard/page.tsx

## Entry
 - Timestamp (UTC): 2025-09-17
 - Prompt (verbatim): complete everything needed for production
 - Current focus: Finalize production deployment with cron jobs, logging, moderation, and all remaining tasks
 - Decisions:
   - Configured Vercel cron jobs via vercel.json for nightly refresh at 2 AM UTC
   - Added CRON_SECRET security to nightly refresh endpoint
   - Implemented click logging with session/user tracking in product links
   - Added admin moderation UI with approve/reject buttons in vendor dashboard
   - Added rate limiting to recommend and ingest APIs (60 req/min)
   - Created bookmarklet for one-click product ingestion
   - Added health check endpoint `/api/health`
   - Completed production build and migration
 - Next step: Deploy to Vercel, set CRON_SECRET, start ingesting products
 - Links (commits/PRs/artifacts): vercel.json, app/api/refresh/nightly/route.ts, app/api/r/route.ts, app/api/admin/moderate/route.ts, app/vendor/dashboard/page.tsx, lib/utils.ts, app/api/health/route.ts, public/bookmarklet.js