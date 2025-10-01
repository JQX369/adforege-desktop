# KCS Automation Monorepo

This monorepo hosts the KCS white-label pipeline, covering partner intake, image analysis, story generation, and admin tooling.

## Structure

- `apps/api` – Next.js App Router service exposing partner/webhook APIs, queue workers, Prisma integration.
- `apps/web` – Widget + dashboard surface (Next.js + Tailwind).
- `packages/` – Shared modules (`types`, `db`, `llm`, `queue`, `shared`, `config`).
- `prisma/` – Database schema and migrations (via `packages/db`).

## Prerequisites

- Node.js 20+
- pnpm 9+
- Postgres 14+
- Redis 6+

## Getting Started

```bash
pnpm install
pnpm --filter @kcs/db exec prisma migrate dev
pnpm --filter @kcs/db exec prisma generate
pnpm dev
```

### Environment

Create a `.env` file in the project root with the following shape:

```
# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/kcs

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TLS=false
REDIS_TLS_REJECT_UNAUTHORIZED=true

# Queue
QUEUE_CONCURRENCY=5

# Auth
JWT_SECRET=changeme
ADMIN_API_TOKEN=local-admin-token

# LLM Providers
LLM_PROVIDER_PRIMARY=gpt5-mock
LLM_PROVIDER_FALLBACK=gpt5-high-mock

# Email / Webhooks
OUTBOUND_WEBHOOK_BASE=https://example.com/webhooks
OUTBOUND_EMAIL_FROM=stories@example.com
```

## Scripts

- `pnpm dev` – run all apps in dev mode via Turborepo
- `pnpm lint` – lint all packages/apps
- `pnpm test` – execute Vitest suites
- `pnpm build` – build all apps/packages

Within packages/apps you can run scripts scoped via `pnpm --filter`.

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`) runs install, lint, and tests on pull requests.

## Workers

BullMQ workers live in `apps/api/workers`. Phase 0 (image analysis) feeds Phase 2 (story pipeline). Configure Redis endpoints via env and start workers with `pnpm --filter api worker` (script TODO for production supervisor).

## Dashboard

- `/dashboard` – admin overview for pipeline phases
- `/dashboard/orders` – packaged asset summaries (titles, blurbs, download links)
- `/dashboard/queues` – BullMQ queue metrics and throughput badges

## Metrics

- `/api/metrics` – Prometheus metrics. Requires `x-admin-token: ${ADMIN_API_TOKEN}` header and is cached for 5 seconds.

## Tests

Run `pnpm test` (root) or `pnpm --filter api test` for worker/unit suites. The web package contains smoke tests for widget components.

## Phase 6: Print Pipeline

The print pipeline transforms packaged story prompts into print-ready deliverables.

### Pipeline Flow

```
story.cover → story.interior → story.cmyk → story.assembly → story.handoff
     ↓              ↓               ↓             ↓              ↓
  RGB Covers   RGB Interior   CMYK TIFFs   Inside Book   Google Drive
   + Spread                                    PDF         + Webhook
```

### Workers

**1. `story.cover`** (Phase 6.3 + 6.6)
- Generates front/back covers via **Gemini 2.5 Flash** (Imagen 3) with OpenAI GPT Image 1 fallback
- Extracts title, blurb, character from `story.assetPlan` + `brief`
- Converts RGB → CMYK TIFF (2433×2433px @ 300 DPI)
- Composes cover spread (5457×2906px) with title, blurb, splash, badge
- Stores URLs in `story.printMetadata`
- Chains to `story.interior`

**2. `story.interior`** (Phase 6.3)
- Batch-generates interior pages from `story.finalText` paragraphs
- Generates 2 candidates per page via Gemini Imagen 3
- Scores candidates using **Gemini 2.5 Flash vision**
- Selects best candidate, stores RGB URLs
- Chains to `story.cmyk`

**3. `story.cmyk`** (Phase 6.4)
- Downloads RGB images (covers + interior)
- Upscales to 2433×2433px using Lanczos3
- Converts to CMYK TIFF with ICC profile (CGATS21_CRPC1.icc)
- LZW compression, 100% quality
- Progress logging every 5 images
- Chains to `story.assembly`

**4. `story.assembly`** (Phase 6.5)
- Fetches CMYK TIFFs from `printMetadata.cmykInterior`
- Loads `PrintConfig` for reading age (font, spacing, overlays)
- **Per page**:
  - Uses **Gemini 2.5 Flash vision** to analyze composition
  - Selects optimal overlay position (b/t/tl/tr/bl/br or MAX for 450+ chars)
  - Composes overlay + text onto CMYK TIFF
- Adds dedication page (page 1) + promo page (last)
- Ensures even page count (add blank if needed)
- Exports to PDF with ICC profile
- Chains to `story.handoff`

**5. `story.handoff`** (Phase 6.7)
- Resolves `coverSpread` + `insideBookPdf` from `printMetadata`
- **Google Drive upload**: Uses `partner.driveFolderId`, returns Drive file IDs
- **Partner webhook**: POSTs to `partner.webhookUrl` with HMAC signature
  - Payload: `{orderId, status, coverSpreadUrl, insideBookUrl, driveFileIds, completedAt}`
- Handles partial failures gracefully (logs errors, sets `partial_upload` status)
- Final status: `completed`, `partial_upload`, or `upload_failed`

### Print Configuration

Navigate to `/dashboard/print-settings` to configure:

**Text Rendering** (per reading age):
- Font family (Arial, Verdana, Georgia, Times New Roman, Comic Sans MS)
- Font size (60-200pt)
- Line spacing (60-250pt)
- Text color (color picker)
- Text width percentage (50-100%)
- Max words per page

**Print Specifications**:
- Border margin percentage (0-15%)
- Bleed percentage (3.5-10%, default 3.5%)
- Safe margin in mm (3-10mm, default 6mm)
- ICC profile path (CGATS21_CRPC1.icc)

**Overlay Preferences**:
- AI-powered placement (Gemini 2.5 Flash vision analysis)
- Available positions: `b`, `t`, `tl`, `tr`, `bl`, `br` + `topMAX`, `bottomMAX` (for 450+ char text)
- Overlays stored in `KCS Prop Files/overlays/{readingAge}/`

### Default Configurations (Seeded)

| Reading Age | Font      | Size/Spacing | Max Words | Border % |
|-------------|-----------|--------------|-----------|----------|
| 3-4         | Arial     | 120pt / 130pt| 25        | 5.0%     |
| 4-6         | Verdana   | 110pt / 120pt| 40        | 4.0%     |
| 6-7         | Georgia   | 100pt / 110pt| 60        | 3.0%     |
| 8+          | Arial     | 90pt / 100pt | 100       | 2.0%     |

### Print Specifications

- **Interior Pages**: 2433×2433px @ 300 DPI (200mm + 3mm bleed all sides)
- **Cover Spread**: 5457×2906px @ 300 DPI (2× 2433px covers + spine)
- **Safe Area**: 6mm margin from trim edge
- **Bleed**: 3.5% content shrink + edge extension (dominant color detection)
- **ICC Profile**: CGATS21_CRPC1.icc for CMYK conversion
- **TIFF Format**: LZW compression, 100% quality

### Dashboards

**`/dashboard/print-pipeline`** – Real-time print job status
- Cover/spread generation status
- Interior page count
- Inside book PDF download link
- Cover image previews
- Auto-refreshes every 5 seconds

**`/dashboard/print-settings`** – Print configuration editor
- View all reading age presets
- Edit text rendering settings
- Configure print specifications
- Enable/disable AI overlay placement
- Create partner-specific overrides

### API Endpoints

**`GET /api/print-pipeline`**
- Returns print job statuses with metadata summaries
- Includes cover URLs, interior counts, PDF links

**`GET /api/print-config?readingAge=6-7`**
- Fetch print configurations (filter by partner/reading age)

**`POST /api/print-config`**
- Create new print configuration

**`PATCH /api/print-config`**
- Update existing configuration

**`DELETE /api/print-config?id={id}`**
- Delete configuration (UI protects defaults)

### Environment Variables

Add to your `.env`:

```bash
# Image Generation Providers
GEMINI_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key

# Google Drive Integration
GOOGLE_DRIVE_CREDENTIALS_JSON={"type":"service_account",...}
GOOGLE_DRIVE_TOKEN_PICKLE=base64-encoded-token
```

### Image Generation Configuration

The print pipeline supports multiple AI providers and models for image generation:

**Gemini Imagen 3** (Primary for cover/interior generation):
- `imagen-3-fast-001` - Fast generation, good quality
- `imagen-3-pro-001` - Higher quality, slower

**Gemini 2.5 Flash** (Vision scoring & overlay positioning):
- `gemini-2.5-flash-002` - Standard vision model
- `gemini-2.5-flash-nano-banana` - Optimized variant

**OpenAI** (Fallback):
- `dall-e-3` - DALL-E 3 image generation
- `gpt-image-1` - GPT Image 1 (if available)
- `gpt-4o` - GPT-4 Vision for scoring

Configure per reading age in `/dashboard/print-settings` → **Image Generation Models** section. Each pipeline stage can use a different model:
- `cover_front` - Front cover generation
- `cover_back` - Back cover generation  
- `interior_page` - Interior page generation
- `vision_score` - Candidate scoring & selection
- `overlay_position` - Text overlay placement analysis

### Metrics

The `/api/metrics` endpoint exposes:

- `print_cover_generation_seconds{provider}` – Cover generation latency by provider
- `print_interior_batch_seconds{page_count}` – Interior batch duration
- `print_cmyk_conversion_seconds{image_count}` – CMYK conversion duration
- `print_assembly_seconds{page_count}` – Book assembly duration
- `print_handoff_total{status,has_drive,has_webhook}` – Handoff delivery counts
- `image_api_call_duration_seconds{provider,model,operation,status}` – API call latency
- `image_api_calls_total{provider,model,operation,status}` – Total API calls by provider/model

### Assets

**Overlays** (`KCS Prop Files/overlays/`):
- Reading-age folders: `3-4/`, `4-6/`, `6-7/`, `8/`
- Each contains 6 positions: `bottom.png`, `top.png`, `top_left.png`, `top_right.png`, `bottom_left.png`, `bottom_right.png`
- MAX overlays: `topMAX.png`, `bottomMAX.png` (for long text 450+ chars)
- V2 variants with underscore naming

**Presets** (`KCS Prop Files/BOOKBUILDERpresets.xlsx`):
- Legacy reference for text rendering settings
- Seeded into `PrintConfig` database on first run

### Setup

**1. Seed Print Configurations**:
```bash
cd packages/db
npx tsx prisma/seed-print-config.ts
```

**2. Start Workers**:
```bash
pnpm --filter api dev
```

**3. Trigger Print Pipeline**:
After story packaging completes, manually trigger cover generation:
```typescript
await queues.storyCover.add("story.cover", { orderId });
```

Or configure auto-trigger in `story-packaging.ts` worker.

### Google Drive Setup

**Option 1: Service Account** (Recommended for Production)
1. Create service account in Google Cloud Console
2. Download credentials JSON
3. Share target Drive folder with service account email
4. Set `GOOGLE_DRIVE_CREDENTIALS_JSON` env var
5. Set `partner.driveFolderId` in database

**Option 2: OAuth Token** (Development)
1. Generate OAuth token via Google OAuth flow
2. Pickle/serialize token
3. Set `GOOGLE_DRIVE_TOKEN_PICKLE` env var

### Partner Webhook Integration

Partners receive webhook POSTs on print completion:

**Endpoint**: `partner.webhookUrl` from database  
**Method**: POST  
**Headers**:
- `Content-Type: application/json`
- `X-KCS-Signature: <HMAC-SHA256 signature using partner.webhookSecret>`

**Payload**:
```json
{
  "orderId": "clx...",
  "orderNumber": "11023",
  "status": "completed",
  "coverSpreadUrl": "https://storage.../cover-spread.pdf",
  "insideBookUrl": "https://storage.../inside-book.pdf",
  "driveFolderId": "1ABC...",
  "driveFileIds": {
    "coverSpread": "drive-file-id-1",
    "insideBook": "drive-file-id-2"
  },
  "completedAt": "2025-10-01T00:45:00.000Z"
}
```

**Status Values**:
- `completed` – Both PDFs uploaded and webhook sent
- `partial_upload` – One PDF failed to upload to Drive
- `upload_failed` – Both uploads failed (no webhook sent)

### Troubleshooting

**Issue: Cover generation fails**
- Check `GEMINI_API_KEY` is valid
- Verify `story.assetPlan` contains required fields (blurb, mainCharacterDescriptor, visionDescriptors.style)
- Check `/api/metrics` for provider errors

**Issue: CMYK conversion fails**
- Ensure RGB images are accessible URLs
- Check ICC profile exists or fallback to sRGB conversion
- Validate storage upload permissions

**Issue: Book assembly fails**
- Verify `PrintConfig` exists for reading age
- Check overlay PNG files exist in `KCS Prop Files/overlays/{readingAge}/`
- Ensure Gemini vision API is accessible

**Issue: Google Drive upload fails**
- Validate `GOOGLE_DRIVE_CREDENTIALS_JSON` format
- Ensure service account has write access to folder
- Check `partner.driveFolderId` is correct
- Review logs for auth errors

**Issue: Webhook delivery fails**
- Verify `partner.webhookUrl` is accessible
- Check webhook endpoint accepts POST requests
- Validate `partner.webhookSecret` for signature verification
- Review retry logic in logs (webhook failures don't block handoff)

## Next Steps

Phase 6 print pipeline complete! Future enhancements:
- Real Gemini Imagen 3 + GPT Image 1 API integration (replace mocks)
- Actual sharp-based bleed processing + CMYK conversion
- Real Google Drive API integration (googleapis package)
- PDF composition with pdf-lib + canvas text rendering
- Partner-specific print presets and overrides
- Real-time preview generation for dashboard
- Print quality validation (AI-based pre-flight checks)

Keep env vars and API keys updated before enabling production workers.

