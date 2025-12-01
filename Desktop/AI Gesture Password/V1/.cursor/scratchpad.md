# AD-Forge SaaS Migration Plan

## 🎯 Vision
Transform Ad-Forge from a local web app into a hosted SaaS platform with:
- **Multi-tenant architecture** with proper data isolation
- **Subscription billing** via Stripe (3 tiers)
- **Supabase Auth** for authentication
- **Vercel + Railway** hosting
- **PostgreSQL** replacing JSON file storage

---

## 📊 Current State Analysis (2025-12-01)

### Architecture Audit
| Component | Current State | Issue |
|-----------|---------------|-------|
| **API** | Single `main.py` (~2700 lines, 46+ endpoints) | Monolithic, unmaintainable |
| **Storage** | JSON file (`analyses.json`) | No multi-tenancy, won't scale |
| **Auth** | None | Anyone can access all data |
| **Billing** | None | No subscription enforcement |
| **Frontend** | Electron + Web hybrid | Unnecessary complexity for SaaS |
| **Hosting** | Local development | No production infrastructure |

### Endpoint Inventory (46+ routes)
- **System**: `/`, `/health`, `/settings` (3)
- **Projects**: `/projects`, `/analyze`, `/results/{id}`, `/videos/{id}` (5)
- **Reactions**: `/reactions/*`, `/analysis/{id}/reactions` (4)
- **Queue**: `/queue/jobs/*`, `/queue/worker/health` (4)
- **Admin**: `/admin/*` (4)
- **Clearcast**: `/clearcast/check`, `/polish`, `/quick-check`, `/pure-check` (4)
- **AI Analysis**: `/analyze/breakdown`, `/similar-ads`, `/chat/persona`, `/qa` (5)
- **Ad Script Lab**: `/ad-script/*` (12)
- **Media Reports**: `/parse-pdf-ai`, `/parse-pdf-vision` (2)
- **PDFs**: `/pdf/breakdown/{id}`, `/pdf/clearcast/{id}` (2)

### External Dependencies
- ✅ Supabase (already used for RAG) → expand for auth + main DB
- ✅ Google Gemini API (video analysis)
- ✅ OpenAI API (embeddings)
- ❌ Stripe (not integrated)
- ❌ Vercel/Railway (not configured)

---

## 🏗️ Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        VERCEL                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              React 19 / Vite Frontend               │    │
│  │  (Removed Electron, Static SPA, Edge Functions)     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        RAILWAY                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              FastAPI Backend                         │    │
│  │  ├── /api/v1/auth/*     (Supabase Auth wrapper)     │    │
│  │  ├── /api/v1/projects/* (CRUD + analysis)           │    │
│  │  ├── /api/v1/clearcast/* (compliance)               │    │
│  │  ├── /api/v1/scripts/*  (Ad Script Lab)             │    │
│  │  ├── /api/v1/billing/*  (Stripe webhooks)           │    │
│  │  └── /api/v1/admin/*    (platform admin)            │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   SUPABASE      │ │    STRIPE       │ │   SUPABASE      │
│   PostgreSQL    │ │    Billing      │ │   Storage       │
│   + Auth        │ │                 │ │   (Videos/PDFs) │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## 💾 Database Schema (Supabase PostgreSQL)

### Core Tables

```sql
-- Organizations (workspaces/teams)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    stripe_customer_id TEXT,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
    subscription_status TEXT DEFAULT 'active',
    monthly_analysis_limit INT DEFAULT 5,
    monthly_analyses_used INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (linked to Supabase Auth)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Video Analyses (main data)
CREATE TABLE analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    video_name TEXT NOT NULL,
    video_url TEXT, -- Supabase Storage URL
    thumbnail_url TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

    -- Analysis results (JSONB for flexibility)
    ai_breakdown JSONB,
    clearcast_check JSONB,
    emotion_summary JSONB,
    emotion_timeline JSONB,

    -- Scores
    avg_engagement FLOAT DEFAULT 0,
    ai_effectiveness FLOAT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reactions (viewer recordings)
CREATE TABLE reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    video_url TEXT,
    status TEXT DEFAULT 'pending',
    emotion_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ad Scripts (from Ad Script Lab)
CREATE TABLE ad_scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    briefing JSONB NOT NULL,
    scripts JSONB, -- Array of generated scripts
    winner_id TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Storyboards
CREATE TABLE storyboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    script_id UUID REFERENCES ad_scripts(id),
    scenes JSONB,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Background Jobs
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL,
    payload JSONB,
    status TEXT DEFAULT 'pending',
    error TEXT,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_analyses_org ON analyses(organization_id);
CREATE INDEX idx_analyses_status ON analyses(status);
CREATE INDEX idx_reactions_analysis ON reactions(analysis_id);
CREATE INDEX idx_jobs_status ON jobs(status, created_at);
```

### Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_scripts ENABLE ROW LEVEL SECURITY;

-- Users can only see their org's data
CREATE POLICY "Users see own org data" ON analyses
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
    );

-- Similar policies for other tables...
```

---

## 💳 Subscription Tiers

| Feature | Free | Pro (£49/mo) | Enterprise (£199/mo) |
|---------|------|--------------|----------------------|
| Video analyses/month | 5 | 50 | Unlimited |
| Ad Script Lab | ❌ | ✅ | ✅ |
| Storyboards | ❌ | ✅ | ✅ |
| Clearcast checks | 5 | Unlimited | Unlimited |
| Media report parsing | ❌ | 10/mo | Unlimited |
| Team members | 1 | 5 | Unlimited |
| API access | ❌ | ❌ | ✅ |
| Priority support | ❌ | Email | Dedicated |
| Data retention | 30 days | 1 year | Unlimited |

---

## 📁 New Directory Structure

```
src/
├── api/
│   ├── main.py                    # FastAPI app setup only
│   ├── deps.py                    # Dependency injection (auth, db)
│   └── routers/
│       ├── __init__.py
│       ├── auth.py                # /api/v1/auth/*
│       ├── projects.py            # /api/v1/projects/*
│       ├── analyses.py            # /api/v1/analyses/*
│       ├── reactions.py           # /api/v1/reactions/*
│       ├── clearcast.py           # /api/v1/clearcast/*
│       ├── scripts.py             # /api/v1/scripts/*
│       ├── storyboards.py         # /api/v1/storyboards/*
│       ├── billing.py             # /api/v1/billing/* (Stripe webhooks)
│       ├── media_reports.py       # /api/v1/media-reports/*
│       └── admin.py               # /api/v1/admin/*
├── app/
│   ├── core/
│   │   ├── config.py              # Settings (Pydantic BaseSettings)
│   │   ├── database.py            # Supabase client singleton
│   │   ├── auth.py                # Auth middleware & helpers
│   │   ├── billing.py             # Stripe integration
│   │   └── storage.py             # Supabase Storage helpers
│   └── features/                  # (existing, largely unchanged)
│       ├── clearcast/
│       ├── ai_breakdown/
│       ├── analytics/
│       └── ...
└── web/                           # React frontend
    ├── src/
    │   ├── lib/
    │   │   ├── supabase.ts        # Supabase client
    │   │   ├── stripe.ts          # Stripe.js
    │   │   └── api.ts             # API client (updated)
    │   ├── features/
    │   │   ├── auth/              # Login, Register, Profile
    │   │   ├── billing/           # Subscription management
    │   │   └── ...                # (existing features)
    │   └── ...
    └── package.json               # Remove electron dependencies
```

---

## 🚀 Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal**: Set up infrastructure without breaking existing functionality

- [ ] **1.1** Create Supabase project & configure Auth
- [ ] **1.2** Design and create database schema (migrations)
- [ ] **1.3** Set up Railway project for backend
- [ ] **1.4** Set up Vercel project for frontend
- [x] **1.5** Configure environment variables across environments ✅ `.env.example` updated
- [x] **1.6** Remove Electron from frontend (web-only build) ✅ `package.json` cleaned

### Phase 2: API Restructure (Week 2-3)
**Goal**: Split monolithic main.py into routers

- [x] **2.1** Create `src/api/routers/` structure ✅ `__init__.py` created
- [ ] **2.2** Extract auth router + Supabase Auth integration
- [ ] **2.3** Extract projects router (CRUD operations)
- [ ] **2.4** Extract analyses router (upload, results)
- [ ] **2.5** Extract reactions router
- [ ] **2.6** Extract clearcast router
- [ ] **2.7** Extract scripts router (Ad Script Lab)
- [ ] **2.8** Extract admin router
- [x] **2.9** Create `deps.py` for dependency injection ✅ Full auth/org/tier deps
- [ ] **2.10** Add API versioning (`/api/v1/`)

### Phase 3: Database Migration (Week 3-4)
**Goal**: Replace JSON storage with PostgreSQL

- [x] **3.1** Create database client (`app/core/database.py`) ✅ Main + RAG clients
- [ ] **3.2** Migrate `VideoAnalysisStorage` → Supabase
- [ ] **3.3** Migrate job queue to database-backed queue
- [ ] **3.4** Update all service classes to use new storage
- [ ] **3.5** Data migration script for existing analyses
- [ ] **3.6** Set up Supabase Storage for videos/PDFs
- [ ] **3.7** Implement file upload to Supabase Storage

### Phase 4: Authentication (Week 4-5)
**Goal**: Secure all endpoints with user auth

- [x] **4.1** Frontend: Add Supabase Auth UI components ✅ `lib/supabase.ts`
- [x] **4.2** Frontend: Protected routes & auth context ✅ `AuthContext.tsx`
- [x] **4.3** Backend: Auth middleware for all routes ✅ `app/core/auth.py`
- [x] **4.4** Backend: User → Organization linking ✅ In auth.py
- [ ] **4.5** Implement Row Level Security policies
- [ ] **4.6** Add organization/team management UI

### Phase 5: Billing Integration (Week 5-6)
**Goal**: Implement Stripe subscription billing

- [ ] **5.1** Create Stripe products & prices (3 tiers)
- [x] **5.2** Backend: Stripe webhook handler ✅ `app/core/billing.py`
- [x] **5.3** Backend: Subscription status checks ✅ In billing.py
- [x] **5.4** Backend: Usage metering & limits ✅ In deps.py
- [ ] **5.5** Frontend: Pricing page
- [ ] **5.6** Frontend: Checkout flow
- [ ] **5.7** Frontend: Subscription management (upgrade/cancel)
- [ ] **5.8** Usage limit enforcement on AI features

### Phase 6: Production Hardening (Week 6-7)
**Goal**: Production-ready deployment

- [ ] **6.1** Error handling & logging (Sentry)
- [ ] **6.2** Rate limiting per tier
- [ ] **6.3** CORS configuration for production domains
- [ ] **6.4** SSL/TLS verification
- [ ] **6.5** Database backups configuration
- [ ] **6.6** Health checks & monitoring
- [ ] **6.7** CI/CD pipeline (GitHub Actions)
- [ ] **6.8** Staging environment setup

### Phase 7: Launch Prep (Week 7-8)
**Goal**: Go-live readiness

- [ ] **7.1** Landing page with pricing
- [ ] **7.2** Documentation / Help center
- [ ] **7.3** Terms of Service & Privacy Policy
- [ ] **7.4** GDPR compliance (data export/delete)
- [ ] **7.5** Load testing
- [ ] **7.6** Beta user onboarding
- [ ] **7.7** Production deployment
- [ ] **7.8** DNS & domain configuration

---

## ⚠️ Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data loss during migration | High | Run parallel systems, incremental migration |
| Breaking existing functionality | High | Feature flags, comprehensive tests |
| Stripe webhook reliability | Medium | Idempotent handlers, retry logic |
| AI API costs exceeding revenue | Medium | Strict usage limits per tier |
| Multi-tenant data leaks | Critical | RLS policies, audit logging |

---

## 📋 Success Criteria

- [ ] All existing features work in hosted version
- [ ] Users can sign up, log in, manage subscription
- [ ] Data is isolated per organization
- [ ] Usage limits are enforced per tier
- [ ] Videos upload to Supabase Storage (not local)
- [ ] Backend runs on Railway without local dependencies
- [ ] Frontend deploys to Vercel
- [ ] < 2s page load time
- [ ] 99.9% uptime target

---

## Previous Context (Archived)

## Key Challenges and Analysis
- **Refactoring Scale**: Extracting logic from the 7.5k line `VideoAnalyzerGUI` without breaking state (user session, current analysis) is high risk.
- **State Management**: Moving to separate View classes requires passing the main `app` controller or a shared `State` object to access `storage`, `user_manager`, etc.
- **CustomTkinter Limitations**: Real shadows and complex animations are limited; we must rely on clean spacing, borders, and color depth.
- **Legacy Cleanup**: Identifying safe-to-delete files (like `gui.py` from the old Gesture Auth) requires verification.
- **Import Hell**: Moving 20+ Python files to subdirectories (`src/app/features/*`) will break imports in `main.py` and `video_analyzer_gui.py`. We must automate or carefully patch these.
- **Reaction Job Reliability**: Background uploads now sometimes stay in `processing` forever, implying the FastAPI background task may fail silently (conversion/analyzer hang) or the job status never reaches `completed`/`failed`. We need instrumentation plus guardrails so the UI and storage never see a stuck status.
- **Webcam Stream Lifecycle**: Browser autoplay policies + stale MediaStreams cause the ReactionRecorder preview `<video>` to stay black until an explicit `.play()` occurs. We must centralize preview/recording control and clean up tracks to avoid muted/ended streams on re-entry.
- **Queue Worker Fragility**: `job_queue.worker_running()` can return false after an exception, causing uploads to spawn fire-and-forget `asyncio.create_task` jobs that still never flip their status. We need watchdog logging, auto-restarts, and stronger storage updates to avoid indefinite `processing`.
- **Storyboard AI Orchestration**: The storyboard flow is multi-step (Analyze -> Clarify -> Generate). We need to persist the state between these steps. The "Clarification" phase requires generating structured questions and accepting user answers before proceeding to image generation.
- **Nano Banana Pro**: This is an external API without documented specs in the repo. I will implement a service interface for it, allowing for easy integration once the API details are provided (or using a mock for now).

### Backend Job Queue Architecture (2025-11-25)
- **Global state & startup**: `job_queue = JobQueue(storage)` is instantiated in `src/api/main.py` alongside `_queue_worker_task` (module-level). FastAPI’s `@app.on_event("startup")` spawns `job_queue.start_worker()` via `asyncio.create_task`, registers `job_queue._on_worker_exit`, assigns both `_queue_worker_task` and `job_queue._worker_task`, sleeps 10 ms, and logs the boot. Shutdown awaits `job_queue.shutdown()` and the stored task handle.
- **Worker lifecycle**: `JobQueue.start_worker()` builds an `asyncio.Queue`, re-queues persisted jobs via `_resume_pending_jobs()`, then loops on job IDs until it receives `None`. `worker_running()` inspects `_worker_task`, logging exceptions and clearing the reference when the task exits. `ensure_worker()` (called before every enqueue) creates a new worker task on the current loop and warns if it had to restart.
- **Handlers & storage**: `VideoAnalysisStorage` persists queue jobs with `status`, `started_at`, `finished_at`, `error`, `retry_count`. `_process_job()` updates statuses, dispatches to the registered handler (`video_analysis`, `reaction`, or `video_transcode`), and classifies exceptions via `classify_error`.
- **Endpoint usage**:
  - `/analyze`: validates uploads, creates an analysis, calls `job_queue.ensure_worker()`, enqueues the `video_analysis` job, and invokes `_schedule_transcode_job()` which itself enqueues a `video_transcode` task if playback isn’t ready.
  - `/reactions/{analysis_id}`: stores the recording, creates a reaction job, calls `job_queue.ensure_worker()`, then checks `worker_running()`. When `True`, it enqueues a `reaction` job and stores the `queue_job_id`; when `False`, it logs a fallback event, launches `_run_reaction_job_async()` via `asyncio.create_task`, and tracks it in `_fallback_reaction_tasks`.
  - `/queue/jobs*`: surfaces the persisted queue job list/detail/retry state so the UI can poll status.
- **Fallback tracking**: `_fallback_reaction_tasks` keeps inline tasks alive and logs any exceptions/cancellations. Structured `REACTION_LOG` events capture every stage (upload received, queued, fallback, job started/completed/failed).
- **Current gaps**: `_queue_worker_task` and `job_queue._worker_task` can desync across reloads, there is no `/queue/worker/health` endpoint, and fallback reaction jobs never update queue job statuses (they bypass the queue entirely). These observations inform the upcoming backend tasks.

### Current Frontend Recording Flow (2025-11-24)
1. **Entry from ProjectView**: The “Record Reaction” CTA in `ProjectView.tsx` (line ~1887) simply `navigate`s to `/record-reaction/:analysisId`, so all capture logic lives in `ReactionRecorder.tsx`.
2. **Preview acquisition (`useWebcam.ts`)**: On mount (and whenever camera permission flips to `granted`), `requestPreview()` calls `startPreview()`, which requests `{ video: true, audio: false }`, stores the stream in `previewStreamRef`, attaches it to `webcamRef.current`, and attempts to `play()` the element. `autoplayBlocked` is toggled if the browser rejects playback, surfacing the “Enable preview” CTA + tap-to-resume overlay.
3. **Start button path (`handleStartRecording`)**:
   - Clears prior blobs/status, then calls `startRecording()` from the hook, which fetches a new `{ video: true, audio: true }` stream, assigns it to `webcamRef`, and tears down the preview stream.
   - Immediately instantiates `MediaRecorder` against that stream, storing chunks into `chunksRef`.
   - Starts the `MediaRecorder`, kicks off a 1s timer for the on-screen counter, and registers `onstop` to assemble a WebM blob, clear `videoRef.srcObject`, and exit fullscreen.
4. **Fullscreen & playback sequencing**: After `MediaRecorder.start()`, the component requests fullscreen on `document.documentElement`. Once the promise resolves (or fails silently), the code waits 150 ms, then calls `.play()` on both the ad `<video>` (`videoRef`) and the webcam PIP `<video>` to recover from browsers that paused them during the transition.
5. **Stopping**: `handleStopRecording()` stops the `MediaRecorder`, clears the interval, calls `stopRecording()` from the hook (stopping the recording stream), seeks the ad video back to 0, and re-requests the preview stream so the user immediately sees themselves again.
6. **Upload path**: After recording, “Upload & Analyze” posts the WebM blob via `api.uploadReaction()`, stores the returned `ReactionJob`, and begins polling both the reaction job (`/reactions/{reaction_id}`) and any queue job (`/queue/jobs/{id}`) every 4s until completion/failure.
7. **Gaps observed**: There is no handshake to ensure the ad video has reached `readyState >= 3` before entering fullscreen; requestFullscreen is run on the entire document instead of the recorder container; and the MediaRecorder + fullscreen actions are not part of an explicit state machine, making it hard to guard against race conditions.

## High-level Task Breakdown
1.  **Deep Clean Plan**: Generate inventory and move maps. (Completed)
2.  **Apply Cleanup**: Delete `video_analyzer_gui_recovered.py`, `debug/*.pdf`, and `temp_*`. Archive `gui.py`. (Completed)
3.  **Apply Structure Moves (Python)**: Move Clearcast and Analytics files to `src/app/features/`. (Completed)
4.  **Fix Python Imports**: Update `main.py`, `video_analyzer_gui.py`, and moved files to fix import paths (e.g., `from app.clearcast_checker` -> `from app.features.clearcast.clearcast_checker`). (Completed)
5.  **Apply Structure Moves (Web)**: Move `services/api.ts` to `lib/` and `context` to `shared/`. (Completed)
6.  **Fix Web Imports**: Update `App.tsx` and components to point to new paths. (Completed)
7.  **Final Verification**: Run tests (if available) or `main.py` to verify startup. (Completed – `pytest` + `npm run build`)
8.  **Repo Inventory & Layout Blueprint**: Capture tree/size inventory, define the target layout, and refresh the migration map for upcoming moves. (Completed)
9.  **Backend Folder Reorg**: Move Python modules into `core/`, `features/`, and `desktop/` packages per the blueprint. (Completed)
10. **Backend Import Fixes**: Update `main.py`, `api/main.py`, and tests after moving files into new namespaces. (Completed)
11. **Web Folder Reorg**: Adopt the `app/`, `features/`, `shared/`, `lib/` structure in `src/web/src` (move pages/components accordingly). (Completed)
12. **Assets & Docs Cleanup**: Migrate stray assets, temp outputs, and markdown notes into `public/` or `_archive/DATE` and refresh docs. (Completed)
13. **Tooling & Verification**: Update lint/test configs, install optional deps (OpenCV, reportlab, pypdf, SpeechRecognition, pygame), rerun `pytest`, and run `npm run build`. (Completed)

## Project Status Board
- [x] **persona-matrix**: Implemented interactive Persona Network Graph with 12 diverse personas, ad element mapping, "What If" simulator, and persona comparison modal with radar chart.
- [x] **storyboards-backend**: Implement `StoryboardService`, `NanoBananaProClient` (placeholder), and API endpoints (`/storyboards/analyze`, `/storyboards/confirm`, `/storyboards/{id}`).
- [x] **storyboards-frontend**: Create `StoryboardView`, `ScriptSelector` (w/ upload + history), `ClarificationModal` (A/B/C), and `StoryboardDisplay`. Add to Sidebar.
- [x] **ad-script-lab** – New sidebar tool for UK TV ad script generation using multi-agent collaboration...
- [x] **ad-script-lab-fixes** – Resolved `video_url` column error, added Back button, and reordered sidebar.
- [x] **compliance-ai-hardening** – Comprehensive hardening plan for both compliance and AI analyzers...
- [x] **clearcast-ui-improvements** – Enhanced Clearcast compliance checker UI...
- [x] **clearcast-constants** – Centralized Clearcast supers thresholds...
- [x] **clearcast-height** – Enforced the ≥30 HD scan-line rule...
- [x] **clearcast-duration** – Added the 0.2s/word +2s/+3s step-change duration rule...
- [x] **clearcast-reporting** – Surfaced the supers failure details...
- [x] **clearcast-docs** – Documented the supers rules...
- [x] **clearcast-regression** – Added synthetic `legal_text_check` regression...
- [x] **upgrade-theme**: Update `ui_theme.py` with 8pt grid...
- [x] **create-components**: Create `src/app/components/` and implement `ModernButton`...
- [x] **implement-layout**: Refactor `VideoAnalyzerGUI` to use a `grid` layout...
- [x] **extract-views**: Move Login, Dashboard, and Project List logic...
- [x] **redesign-analysis**: Implement a Tab-based layout for the Analysis view...
- [x] **web-ui-compliance**: Refactor `ProjectView.tsx`...
- [x] **fine-tune-ui**: Apply subtle polish to Web UI...
- [x] **list-styling-web**: Implement sunken list containers...
- [x] **fix-issues-button**: Implement `/clearcast/polish` endpoint...
- [x] **web-ui-refinements**: Move dropdowns to modal...
- [x] **web-fixes**: Fix Polish button disabled state...
- [x] **web-polish-modal**: Implement full Polish Options modal...
- [x] **repo-cleanup**: Remove corrupt leftovers...
- [x] **python-feature-folders**: Move Clearcast + analytics modules...
- [x] **python-imports**: Update backend + tests...
- [x] **web-structure**: Relocate `api.ts` to `src/web/src/lib/services/`...
- [x] **web-build**: Fix React import paths...
- [x] **repo-inventory-blueprint**: Wrote `.reports/repo-inventory.md`...
- [x] **backend-folder-reorg**: Move `config`, `storage`, `video_analyzer_gui`...
- [x] **backend-import-fix**: Update all Python imports/tests...
- [x] **web-folder-reorg**: Adopt the `app/`, `features/`, `shared/`, `lib/` structure...
- [x] **assets-docs-cleanup**: Relocate `assets/`, `temp_*`...
- [x] **tooling-verification**: Refresh configs, install OpenCV...
- [x] **web-dev-script**: Add a script in `scripts/`...
- [x] **reaction-api-client**: Add `api.uploadReaction` helper...
- [x] **reaction-endpoint**: Implement FastAPI `/reactions/{analysis_id}`...
- [x] **reaction-ui**: Wire `ReactionRecorder` UI...
- [x] **reaction-verification**: Verify the record/upload flow...
- [x] **reaction-processing**: Add EnhancedEmotion-based processing...
- [x] **reaction-metrics**: Surface reaction timelines...
- [x] **reaction-qa**: Expand regression tests...
- [x] **spec-polish-endpoint**: Add FastAPI regression...
- [x] **backend-normalize-options**: Normalize API payload...
- [x] **frontend-sanitize-polish**: Align web polish modal payload...
- [x] **verify-and-doc**: Run targeted tests/build...
- [x] **media-report-consolidator**: Fixed PDF.js worker, planned/delivered impressions extraction, top programmes, and device splits for Sky CSV, Channel 4 Excel, and ITV PDF formats.

## Executor's Feedback or Assistance Requests
- **Completed (2025-11-30)**: UI and Analysis Improvements Plan Implementation
  - **Task 2: Fix OpenAI API Key Loading**
    - Updated `_ensure_openai()` in `ad_qa_service.py` to use `get_openai_api_key()` function
    - Added `get_openai_api_key()` and `get_google_api_key()` helper functions in `config.py`
    - Fixed late dotenv loading issue by always checking environment fresh
    - Updated `ai_video_breakdown.py` and `main.py` to use new getter functions
  - **Task 6: Fix Persona Suggested Questions**
    - Updated AI prompt to clarify questions should be phrased TO the persona, not FROM them
    - Added examples of good vs bad question framing in the prompt
    - Fallback templates already had correctly framed questions
  - **Task 3: Clickable Stat Breakdowns with Info Tooltips**
    - Added `METRIC_DEFINITIONS` object with title, description, and interpretation for each score
    - Created `StatDetailModal` component with score display and metric explanation
    - Added `key` field to each stat in the grid for lookup
    - Added click handler, info icon, and "Click for details" hint on stat cards
    - Modal shows score with rating pill, metric definition, interpretation guide, and AI analysis
  - **Task 4: Creative Analysis Page Improvements**
    - Removed engagement timeline chart (now in Emotional Timeline slide)
    - Replaced with 6-panel grid: Hook, Creative Tactics, Audio Profile, Cinematography, Brand Presence, Visual Patterns
    - Added Product Focus and Key Moments panels in bottom row
    - Data pulled from `hero_analysis`, `brand_asset_timeline`, `audio_fingerprint`, `creative_profile`
  - **Task 1: Brain Balance Section**
    - Added `brain_balance` field to AI prompt with emotional_score, rational_score, dominant_mode, drivers
    - Created `BrainBalanceChart.tsx` component with split-bar visualization
    - Shows emotional vs rational balance with driver tags for each
    - Added to Creative Analysis slide
  - **Task 7: Canvas Pan/Zoom on Persona Matrix**
    - Added pan state (x, y) and zoom state (scale) to PersonaNetworkGraph
    - Implemented mouse wheel zoom handler
    - Implemented mouse drag panning with proper event handling
    - Added zoom controls (Zoom In, Zoom Out, Reset) in top-right corner
    - Shows current zoom percentage and pan hint when zoomed
    - Increased canvas size to 1000x800 and persona radius to 320 for more spread
  - **Task 5: Frame Extraction Accuracy**
    - Added `_compute_frame_hash()` for perceptual frame hashing
    - Added `_sequential_read_to_frame()` fallback for when seeking fails
    - Added seek position verification in both extraction functions
    - Implemented duplicate frame detection via hash comparison
    - Added logging warnings for seek failures and duplicate frames
    - Summary logging shows total seek failures and duplicates at end
- **Completed (2025-11-30)**: TellyAds Schema Alignment and Enhanced Analysis System
  - **Phase 1: Core Data Schema Alignment**
    - Added video technical metadata (width, height, fps, aspect_ratio) to `frame_analyzer.py`
    - Created `generate_external_id()` for TellyAds-style IDs
    - Expanded AI prompt with hero_analysis section (audio_profile, emotional_arc, cinematography, visual_patterns, creative_tactics)
    - Added storyboard shot-by-shot extraction with 15+ fields per shot
    - Added brand_asset_timeline with logo appearances, mentions, and branding metrics
    - Added audio_fingerprint with music, voiceover, dialogue, SFX analysis
    - Expanded content_indicators with 9 new flags (humor, animals, children, nostalgia, cultural_moment, music_with_lyrics, story_arc, regulator_sensitive, regulator_categories)
  - **Phase 2: Enhanced Emotion System**
    - Created `emotional_timeline.py` with 15 emotions (6 new: excitement, nostalgia, tension, relief, pride, empathy)
    - Implemented EmotionReading, EmotionalTransition, EmotionalMetrics dataclasses
    - Added trigger tracking (visual/audio/dialogue/music/pacing/reveal)
    - Implemented arc shape detection (peak_early/peak_middle/peak_late/flat/roller_coaster)
    - Updated AI prompt for granular readings every 1-2 seconds
  - **Phase 3: UI - Enhanced Emotional Timeline**
    - Created `EmotionalTimelineChart.tsx` with interactive SVG visualization
    - Added emotion color coding, hover tooltips, transition markers
    - Integrated into AIBreakdownSlideshow as new "Emotional Timeline" slide
  - **Phase 4: GPT-5.1 Q&A Feature with RAG**
    - Created `AdQAService` with GPT-5.1 integration and RAG context
    - Added 4 Q&A modes: general, compare, improve, brainstorm
    - Added `/analyze/{id}/qa` and `/analyze/{id}/qa/suggestions` API endpoints
    - Created `AdQAPanel.tsx` chat interface with mode selection and suggestions
    - Integrated into AIBreakdownSlideshow as new "Ad Q&A" slide
- **Completed**: Storyboard feature implementation complete (backend + frontend).
- **Completed**: Ad Script Lab fixes (Back button, database query fix, menu order).
- **Completed**: Asset request flow for Storyboards - AI now asks for logos, products, brand guides, etc.
- **Completed (2025-11-28)**: Storyboards QOL Improvements
  - Added Previous Storyboards section to display and re-view completed storyboards (`StoryboardHistory.tsx`)
  - Created script picker modal for campaigns with multiple scripts (`ScriptPickerModal.tsx`)
  - Verified NanoBananaProClient returns valid placeholder images for MVP
  - Ensured logo and product asset requests are ALWAYS included in clarification (via `_ensure_essential_assets()`)
- **Nano Banana Pro**: Implemented as a stub client with placeholder images for MVP.
- **Clarification**: Implemented A/B/C question flow with custom answer support.
- **Asset Uploads**: ClarificationModal now supports file uploads for brand assets (logos, products, etc.).
- **Frontend**: Added Storyboard view with history/upload selection, modal clarification, asset uploads, and scene grid display.
- **Completed (2025-11-28)**: UI Metrics Expansion and Slide Restructure
  - Expanded impact scores grid from 3 to 8 metrics (Overall Impact, Pulse Score, Echo Score, Hook Power, Brand Integration, Emotional Resonance, Clarity Score, Distinctiveness)
  - Removed redundant expected_metrics widget (engagement_rate, conversion_potential, shareability, memorability)
  - Removed Slide 4 "Outcome & Strategy" entirely
  - Moved Optimization Opportunities to Slide 3 "SWOT Analysis"
  - Updated SWOT section to use effectiveness_drivers as primary data source
  - Wired supers_texts from OCR to AI breakdown in main.py
  - Removed expected_metrics from backend prompt schema and defaults
  - Fixed orphaned _ensure_response_defaults implementation
  - All 40 tests passing
- **Completed (2025-11-28)**: Persona Matrix Enhancement
  - Removed compare button and PersonaCompareModal from frontend
  - Updated AI prompt to generate detailed, location-specific named personas (UK personas for UK ads)
  - New persona schema: full_name, occupation, background_story, interests, daily_routine, pain_points, suggested_questions
  - Removed social_share_likelihood and watch_completion_estimate metrics
  - Implemented missing /chat/persona API endpoint in main.py
  - Updated persona detail panel with rich background information and suggested questions
  - Enhanced chat_with_persona system prompt with full persona context
  - Updated PersonaChat component to use new persona fields
  - Graph now shows persona first names instead of archetypes
- **Completed (2025-11-28)**: Ad Script Lab Timeout Fix
  - Root cause: Gemini API calls in agents had no timeout enforcement, causing indefinite hangs
  - Added `generate_with_timeout()` async wrapper in `gemini_utils.py` using `asyncio.wait_for()` + `asyncio.to_thread()`
  - Updated all 8 agents to use timeout-wrapped calls (ideate, polish, amazon_start, selector, braintrust, compliance, finalize, brand_discovery)
  - Parallelized polish and compliance stages with `asyncio.gather()` for 3x speedup
  - Enhanced orchestrator logging with per-stage timing and expected timeout info
  - All 27 Ad Script Lab tests passing
- **Completed (2025-11-28)**: Ad Script Lab UI Match
  - Refined `ConceptNavigator` with card-like styling, winner badges, and clearer duration indicators.
  - Styled `ScriptEditor` for better readability with monospaced fonts and cleaner padding.
  - Enhanced `AnalysisRail` with circular progress score, simplified feedback cards, and tabbed navigation to match the design screenshot.
- **Completed (2025-11-28)**: Media Report Consolidator Fixes
  - Fixed PDF.js worker error by configuring Vite to copy worker file and use correct path for v5.x
  - Added `vite-plugin-static-copy` to copy `pdf.worker.min.mjs` to dist/assets
  - Implemented Channel 4 Excel parsing: Target Imps (planned), Delivered Impressions, Platform Mix (device splits), Top Ten Programmes
  - Implemented Sky CSV parsing: daily impressions sum, Top 10 Shows extraction with estimated impressions
  - Improved ITV PDF parsing: Target/Delivered extraction, device type splits from percentages, programme extraction from "Delivery by programme" section
  - Added `parseChannel4Excel()` and `parseSkyCSV()` helper functions for cleaner code organization
  - Updated `SmartParser.detectTable()` to accept optional startRow parameter for targeted table detection
  - Verified all parsers work correctly with MediaReportExamples/ sample files
- **Completed (2025-11-28)**: Media Report Consolidator v2 Enhancement
  - **UX Improvement**: Moved client/campaign info above supplier tabs for better hierarchy
  - **Visual Overhaul**: Applied glass card styling with dark gradients, neon accents, and hover effects
  - **Data Model**: Added `BuyingLine` interface and `buying_lines` array to `PlatformData`
  - **Channel 4 LINE ITEMS**: Extract detailed buying breakdown (e.g., "DIRECT DEMO ABC1ME") with impressions/clicks
  - **Expandable Rows**: Platform table now shows collapsible buying breakdown when LINE ITEMS exist
  - **AI PDF Parsing**: Added backend `/parse-pdf-ai` endpoint using Gemini to extract structured data from PDFs
  - **AI Toggle**: Frontend toggle to enable/disable AI-powered PDF extraction with fallback to basic parsing
  - **Loading State**: Visual indicator when AI is processing PDFs (purple animation)
- **Completed (2025-11-29)**: Media Report Consolidator v3 - Sorting, Sky Demographic Inference, Editable Names
  - **Sortable Buying Types Table**: Added clickable sort headers to the Buying Types table with sort icons (default: desc by delivered impressions)
  - **Sky Demographic Inference**: Added `inferDemographicFromShows()` function to infer vague demographics (e.g., "ABC1 Adults", "ABC1 Men") from show names instead of using campaign filenames
  - **Editable Buying Type Names**: Double-click on any buying type name to edit inline; changes are saved back to platform data
  - **Enhanced ITV PDF AI Extraction**: Added ITV-specific prompting with detailed instructions for extracting Target/Delivered impressions, device splits, top programmes, and buying lines from ITV Historical Analysis PDFs; increased text context sent to AI from 15K to 20K characters
- **Completed (2025-11-29)**: Media Report Consolidator v4 - Inferred Data Indicators, Device Mix Sliders, PDF Export, Vision Parsing
  - **Inferred Data Flags**: Added `is_inferred` to DeviceSplit and BuyingLine interfaces; parsers now mark data as inferred when estimated (Sky device split, inferred demographics)
  - **Inferred UI Badges**: Added amber "Inferred" badge and pencil edit icon to buying types table and device mix chart when data is estimated
  - **Device Mix Inline Sliders**: Click edit icon to reveal 3 sliders (Mobile/Desktop/Big Screen) with auto-normalize to 100%; saves updates to platforms
  - **Improved PDF Export**: New multi-page structure:
    - Cover page with client/campaign info
    - Executive Summary with all KPIs, device mix, top 5 content, platform overview
    - Per-supplier sections with supplier-specific metrics, device mix, buying lines, and top content
  - **Vision-Based PDF Parsing**: New `/parse-pdf-vision` endpoint using PyMuPDF + Gemini Vision to analyze PDF page screenshots; better extraction for PDFs with charts/complex layouts
  - **Frontend Vision Integration**: PDF processing now tries vision parsing first, falls back to text-based AI, then basic regex extraction
- **Completed (2025-11-29)**: Media Report Consolidator v5 - Daily/Daypart Data, Improved ITV Extraction
  - **Device Mix Edit Persistence**: Edit icon now always visible (Inferred badge remains conditional)
  - **DailyImpression & DaypartSplit Interfaces**: New data structures for day-by-day and time-of-day breakdowns
  - **Daily Impressions Extraction**: Sky CSV extracts dates from daily table; Channel 4 Excel looks for DAILY IMPRESSIONS section
  - **Daypart Extraction**: Channel 4 Excel extracts from DAYPART/TIME BREAKDOWN section; API prompts updated to request daypart data
  - **Daily Impressions Graph**: AreaChart showing day-by-day impressions with gradient fill and responsive tooltips
  - **Daypart Distribution Chart**: Horizontal BarChart showing time-of-day breakdown (Morning, Daytime, Early Peak, Late Peak, Post Peak, Late Night)
  - **Improved ITV Buying Type Names**: Enhanced `normalizeBuyingTypeName()` with ITV-specific patterns; handles underscore-separated names like "Tom Ford_Bois Pacifique_ITV_Masthead" -> "ITV Masthead"
  - **API Schema Updates**: MediaReportParseResult now includes daily_impressions and daypart_split fields

## Lessons
- **Neuron Propagation Explosion**: In simulation loops (like `NeuralBrain`), exponential branching (connections * probability > 1) guarantees a crash. Always dampen propagation probability inversely to the active queue size or use a strict global cap on active agents.
- **OpenCV Seeking Reliability**: `cv2.set(CV2.CAP_PROP_POS_FRAMES)` is unreliable on some backends/files. Always verify the position using `CAP_PROP_POS_MSEC` after reading. If precise seeking is critical, use a robust library like `ffmpeg` (via command line or bindings) or implement a fallback to sequential reads (skip-reading) for critical frames.
- **Gemini Model Names**: Do not hallucinate future model versions like `gemini-3-pro`. Stick to the official release names (`gemini-1.5-pro`, `gemini-1.5-flash`) to avoid silent fallbacks to legacy models or API errors.
- **Queue workers that spin up asynchronously need a staging buffer**; persist job IDs until the underlying asyncio queue exists so early enqueues aren’t dropped.
- **Queue worker task management**: The CALLER must store the task reference in `queue._worker_task` and register the exit callback.
- **Webcam PIP during fullscreen**: The `<video>` element with `autoPlay` JSX attribute doesn't guarantee playback when the stream is attached programmatically. Always call `videoElement.play()` explicitly.
- **Legal text bbox units**: Gemini returns bbox coordinates on a 0–1000 scale, so convert to HD scan lines via `(ymax - ymin)/1000 * 1080` and allow a tiny tolerance.
- **Reaction fallback UX**: When the worker is offline, set reaction jobs to `processing_fallback`/`processing_mode="fallback"` up front.
- **Video cache busting**: Whenever a backend generates new binary content (like a playback MP4), append a monotonically increasing query param to `<video src>`.
- **Subjective compliance flags**: Health claims and wording issues that depend on Clearcast discretion should be classified as warnings (amber_flags), not critical (red_flags).
- **Shared module extraction**: When multiple analyzers share similar logic (frame extraction, flag structures), extract to `core/` modules.
- **Semantic search for RAG**: For regulatory knowledge bases like Clearcast guidelines, semantic search with embeddings significantly improves retrieval quality.
- **Industry-specific profiles**: Pre-defined rule profiles for common ad categories (alcohol, gambling, finance, etc.) enable faster compliance checks.
- **Modular RAG client design**: When building features that require external databases (like Supabase), create an abstract base class with stub implementation first.
- **Supabase + pgvector pattern**: For semantic search, use OpenAI's `text-embedding-3-large` with `dimensions=1536` to match the vector column schema.
- **Emotion tracker fallback detection**: When `EnhancedEmotionTracker` fails (empty timeline) it silently falls back to the primitive analyzer.
- **Recharts chart click events**: The onClick callback receives `data.activePayload[0].payload` for clicked point data, not `data.activeLabel`.
- **Native dropdown styling**: Browser `<option>` elements ignore CSS styling on most platforms. Replace native `<select>` with custom dropdown components.
- **Database schema mismatch**: When querying external databases (like Supabase), always verify the actual column values exist.
- **OpenCV frame extraction for large files**: Sequential `cap.read()` in a loop reads EVERY frame from the start, which is extremely slow for large MOV/ProRes files. Use seek-based extraction with `cap.set(cv2.CAP_PROP_POS_FRAMES, position)`.
- **API endpoint and frontend client sync**: When frontend code calls an API endpoint that doesn't exist, the feature silently fails. Always verify both ends are implemented before shipping.
- **Gemini SDK timeout enforcement**: The `model.generate_content()` call is synchronous and has no built-in timeout. Wrap in `asyncio.wait_for(asyncio.to_thread(...), timeout=N)` to prevent indefinite hangs. Define timeouts in config but ensure they're actually applied in code.
- **PDF.js worker with Vite**: pdfjs-dist v5.x uses ESM modules with different file paths (`.mjs` instead of `.js`). Use `vite-plugin-static-copy` to copy the worker file to dist/assets, and configure the worker path dynamically based on `import.meta.env.DEV` for dev vs production builds.
