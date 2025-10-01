# KCS Pipeline Overview

This document captures the current end-to-end flow so future phases can plug into the same contract.

---

## Phase 0 – Intake & Queues
1. **Order intake** – `/api/partner/orders` validates payload, stores order + brief (raw JSON) and mapped assets.
2. **Image analysis enqueue** – order set to `pending_image_analysis` and `images.analyze_uploads` job scheduled.

## Phase 1 – Image Analysis
1. Worker pulls order + assets, computes descriptors per upload (child, supporting characters, locations).
2. Stores results in `order_briefs.imageDescriptors` and `image_analysis_audit`.
3. Emits `images.uploads_analyzed`, updates order status `image_analysis_complete`.
4. Enqueues `story.asset_plan` (Phase 3 entry point).

## Phase 2 – Story Generation
1. **Asset plan** – (new) worker splits final story to paragraphs & resolves style profile (see Phase 3).
2. **Emotional profile** – `story.profile` builds thematic guidance, stores `emotionalProfile`.
3. **Outline** – `story.outline` multi-step prompt creates per-page outline saved to `outlineText`/`outlineJson`.
4. **Draft** – `story.draft` writes first story version using outline + constraints (no `=== Page X ===`).
5. **Revision** – critique + repair loop (`story.revise`), validator report stored.
6. **Polish** – `story.polish` performs grammar cleanup; status → `story_finalized`.
7. **Approval window** – story rows track `draftReadyAt`, `approvalExpiresAt`, etc. for optional partner edits.

## Phase 3 – Asset Planning & Image References (In Progress)
### Current implementation
- `story.asset_plan` splits finalized story into paragraphs, counts them, and records the reading-stage style prompt in `story.assetPlan` along with empty focus lists.

### Remaining steps to implement
1. **Style analysis & avatar vision**
   - Gemini vision pass (Step 1.5) generating visual traits for main character references.
   - Save into `story.assetPlan.visionDescriptors`.
2. **Main character avatar generation** (Step 2)
   - Transparent background, neutral pose.
   - Dashboard override for reference image support.
3. **Secondary extraction & focus lists** (Steps 4–10)
   - Use story text and prompts to produce focus list, unique variables, filtered lists.
   - Persist in `story.assetPlan.focusList`, `.focusItems`, `.cleanedFocusList`.
4. **Per-paragraph prompt generation** (Steps 5 & 12)
   - Create base prompts, then enhanced prompts (store both arrays; keep `[ ...@... ]` format).
5. **Item description generation** (Step 11)
   - Canonical descriptions for each focus item (JSON array), saved under `story.assetPlan.itemDescriptions` (field to add).
6. **Image generation batches** (Steps 13 & 14)
   - Loop through focus items and additional photo references to create avatars/assets using Gemini.
   - Persist generated URLs under `assets` or `story_asset_plan.generatedLinks`.
7. **Packaging & layout metadata** (Steps 15–18)
   - Store ordered link arrays, overlay size choice, title options, and blurb.
   - Expose via dashboard.

## Dashboard Touchpoints
- `/dashboard/orders` shows order status, descriptors, link to story drafts.
- `/dashboard/queues` monitors all BullMQ queues (image analysis, asset plan, story stages).
- Todo: add tabs for asset plan data (focus lists, generated images, titles).

---

Keep this file updated as we implement remaining Phase 3 steps or refine the pipeline.

