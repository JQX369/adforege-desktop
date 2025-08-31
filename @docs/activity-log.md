# Project Activity Log

## Entry
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
- Timestamp (UTC): 2025-08-30
- Prompt (verbatim): F.1 - Once the gift Form is submited (add a cool/funny loading animation)\n\tMake sure matches style
- Current focus: Add playful loading overlay to GiftForm submit flow
- Decisions:
  - Added animated gradient gift box with sparkles overlay when isLoading
  - Implemented CSS keyframes (gift-bounce, sparkle-pop) and utility classes
  - Avoided inline styles; created reusable sparkle position variants
- Next step: UX verify on mobile and dark mode
- Links (commits/PRs/artifacts): components/GiftForm.tsx, app/globals.css